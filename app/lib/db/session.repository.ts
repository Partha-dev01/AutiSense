import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";
import type {
  Session,
  SessionStatus,
  SessionSyncPayload,
} from "../../types/session";

//Creates a new session and adds it to syncQueue
export async function createSession(data: {
  id: string;
  childName: string;
  ageMonths: number;
  language: string;
  gender: string;
}): Promise<void> {
  const userId = getCurrentUserId();
  const now = Date.now();

  await db.transaction("rw", db.sessions, db.syncQueue, async () => {
    await db.sessions.add({
      ...data,
      userId,
      createdAt: now,
      completedAt: null,
      status: "in_progress",
      synced: false,
    });

    await db.syncQueue.add({
      sessionId: data.id,
      queuedAt: now,
      retryCount: 0,
    });
  });
}
//Read
export async function getSession(
  sessionId: string,
): Promise<Session | undefined> {
  return db.sessions.get(sessionId);
}

export async function listSessions(): Promise<Session[]> {
  const userId = getCurrentUserId();
  return db.sessions
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("createdAt");
}

/**
 * Returns sessions that are complete but not yet synced to DynamoDB.
 * Used by the sync bridge flush logic.
 */
export async function getUnsyncedSessions(): Promise<Session[]> {
  const userId = getCurrentUserId();
  return db.sessions
    .where("[userId+synced]")
    .equals([userId, 0]) // Dexie stores booleans as 0/1 in compound indexes
    .toArray()
    .catch(() =>
      db.sessions
        .filter((s) => s.userId === userId && s.synced === false)
        .toArray(),
    );
}

//Update- Marks a session as completed (all task screens done).
export async function completeSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, {
    completedAt: Date.now(),
    status: "completed" satisfies SessionStatus,
  });
}

//Marks a session as successfully synced to DynamoDB.
//Called by the sync bridge after a successful POST to /api/sync.
export async function markSessionSynced(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, {
    synced: true,
    status: "synced" satisfies SessionStatus,
  });
}

//childname is intentionally not included
export async function buildSyncPayload(
  sessionId: string,
): Promise<SessionSyncPayload | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  // Destructure out childName — it must not be sent
  const { childName, ...payload } = session;
  return payload;
}

//Delete
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction(
    "rw",
    db.sessions,
    db.biomarkers,
    db.syncQueue,
    async () => {
      await db.sessions.delete(sessionId);
      await db.biomarkers.where("sessionId").equals(sessionId).delete();
      await db.syncQueue.where("sessionId").equals(sessionId).delete();
    },
  );
}
