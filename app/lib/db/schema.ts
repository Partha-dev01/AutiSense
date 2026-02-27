import Dexie, { type Table } from "dexie";
import type { Session } from "../../types/session";
import type { Biomarker } from "../../types/biomarker";

//sessions     — one row per screening session
//biomarkers   — multiple rows per session (one per task screen pass)
//syncQueue    — pending session IDs waiting to be uploaded to DynamoDB

export interface SyncQueueEntry {
  id?: number;
  sessionId: string;
  queuedAt: number;
  retryCount: number;
}

export class AutiSenseDB extends Dexie {
  sessions!: Table<Session>;
  biomarkers!: Table<Biomarker>;
  syncQueue!: Table<SyncQueueEntry>;

  constructor() {
    super("AutiSenseDB");
    this.version(1).stores({
      sessions: "id, userId, createdAt, synced, status",
      biomarkers: "++id, sessionId, userId, timestamp, taskId",
      syncQueue: "++id, sessionId, queuedAt, retryCount",
    });
  }
}

export const db = new AutiSenseDB(); //singleton db instance
