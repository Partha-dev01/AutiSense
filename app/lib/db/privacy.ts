import { db } from "./schema";

/**
 * Local-data privacy controls.
 *
 * This app keeps personal / health-adjacent data (child profiles, screening
 * biomarkers, ASD-risk scores, chat transcripts) on-device in IndexedDB +
 * localStorage. These helpers give the user control over that data and bound
 * how long it lingers in the browser.
 */

/**
 * Delete ALL locally-stored AutiSense data on this device: every IndexedDB
 * table plus localStorage/sessionStorage. Irreversible. Backs the
 * "Delete my data (this device)" control. (Server-side data, if any, is
 * unaffected.)
 */
export async function clearAllLocalData(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
  try { localStorage.clear(); } catch { /* storage may be unavailable */ }
  try { sessionStorage.clear(); } catch { /* storage may be unavailable */ }
}

/**
 * Retention purge: best-effort deletion of on-device records older than
 * `maxAgeDays` (default 180) so stale personal data doesn't accumulate
 * indefinitely. Runs once per browser session on load. Per-table failures are
 * swallowed so a schema/type quirk can never break the app.
 */
export async function purgeOldLocalData(maxAgeDays = 180): Promise<void> {
  const cutoff = Date.now() - maxAgeDays * 86_400_000;
  const safe = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch { /* best-effort */ }
  };
  await safe(() => db.chatHistory.where("createdAt").below(cutoff).delete());
  await safe(() => db.sessions.where("createdAt").below(cutoff).delete());
  await safe(() => db.biomarkers.where("timestamp").below(cutoff).delete());
}
