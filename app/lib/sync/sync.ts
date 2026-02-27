/**
 * Network Information API listener and syncQueue flush logic.
 *
 * Usage (call once from a top-level client component or layout):
 *
 *   import { startSyncListener } from "@/lib/sync/sync";
 *   useEffect(() => startSyncListener(), []);
 *
 * How it works:
 *   1. On mount, check if online → flush queue immediately if so
 *   2. Listen for "online" events → flush queue when connectivity returns
 *   3. Each flush iterates the syncQueue, POSTs to /api/sync, and on
 *      success removes the entry from the queue + marks the session synced
 */

import {
  getPendingSyncEntries,
  incrementRetryCount,
  removeFromSyncQueue,
} from "../db/sync.repository";
import { buildSyncPayload, markSessionSynced } from "../db/session.repository";
import { aggregateBiomarkers } from "../db/biomarker.repository";

// Maximum retry attempts before a session is left in the queue
const MAX_RETRIES = 5;

// Tracks whether a flush is already in progress (prevents parallel flushes)
let isFlushing = false;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Registers network event listeners and performs an initial flush.
 * Returns a cleanup function — use this as the return value of useEffect.
 */
export function startSyncListener(): () => void {
  // Flush immediately if already online
  if (navigator.onLine) {
    flushSyncQueue();
  }

  const handleOnline = () => {
    console.log("[AutiSense Sync] Connectivity restored — flushing queue");
    flushSyncQueue();
  };

  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}

/**
 * Returns the current online/offline status.
 * Wraps navigator.onLine for use in React components.
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.onLine;
}

// ─── Flush Logic ───────────────────────────────────────────────────────────

/**
 * Iterates the syncQueue and attempts to upload each session.
 * Skips entries that have exceeded MAX_RETRIES.
 * Safe to call multiple times — uses isFlushing guard.
 */
export async function flushSyncQueue(): Promise<void> {
  if (isFlushing || !navigator.onLine) return;
  isFlushing = true;

  try {
    const entries = await getPendingSyncEntries();
    if (entries.length === 0) return;

    console.log(
      `[AutiSense Sync] Flushing ${entries.length} pending session(s)`,
    );

    for (const entry of entries) {
      if (entry.retryCount >= MAX_RETRIES) {
        console.warn(
          `[AutiSense Sync] Session ${entry.sessionId} exceeded max retries — skipping`,
        );
        continue;
      }

      await uploadSession(entry.sessionId, entry.id!);
    }
  } finally {
    isFlushing = false;
  }
}

// ─── Internal ──────────────────────────────────────────────────────────────

async function uploadSession(
  sessionId: string,
  queueEntryId: number,
): Promise<void> {
  // Build the anonymised session payload (no childName)
  const sessionPayload = await buildSyncPayload(sessionId);
  if (!sessionPayload) {
    console.warn(
      `[AutiSense Sync] Session ${sessionId} not found in IndexedDB — removing from queue`,
    );
    await removeFromSyncQueue(sessionId);
    return;
  }

  // Compute aggregated biomarker scores
  const biomarkerAggregate = await aggregateBiomarkers(sessionId);

  const body = {
    session: sessionPayload,
    biomarkers: biomarkerAggregate,
  };

  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // Success — remove from queue and mark session as synced
    await removeFromSyncQueue(sessionId);
    await markSessionSynced(sessionId);
    console.log(`[AutiSense Sync] Session ${sessionId} synced successfully`);
  } catch (err) {
    console.error(
      `[AutiSense Sync] Failed to upload session ${sessionId}:`,
      err,
    );
    await incrementRetryCount(queueEntryId);
  }
}
