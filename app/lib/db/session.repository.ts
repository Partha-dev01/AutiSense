import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";

export async function createSession(data: {
  id: string;
  childName: string;
  age: number;
}) {
  const userId = getCurrentUserId();

  await db.sessions.add({
    ...data,
    userId,
    createdAt: Date.now(),
    synced: false,
  });

  await db.syncQueue.add({
    sessionId: data.id,
  });
}
