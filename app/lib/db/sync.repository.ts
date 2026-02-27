//Operations for the syncQueue table in IndexedDB.
//The syncQueue holds session IDs that need to be uploaded to DynamoDB.
import { db, type SyncQueueEntry } from "./schema";

//Read
export async function getPendingSyncEntries(): Promise<SyncQueueEntry[]> {
  return db.syncQueue.orderBy("queuedAt").toArray();
}

export async function getSyncQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

//Update
export async function incrementRetryCount(queueEntryId: number): Promise<void> {
  const entry = await db.syncQueue.get(queueEntryId);
  if (!entry) return;
  await db.syncQueue.update(queueEntryId, {
    retryCount: entry.retryCount + 1,
  });
}

//Delete
export async function removeFromSyncQueue(sessionId: string): Promise<void> {
  await db.syncQueue.where("sessionId").equals(sessionId).delete();
}

//All clear only for dev
export async function clearSyncQueue(): Promise<void> {
  await db.syncQueue.clear();
}
