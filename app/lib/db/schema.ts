import Dexie, { Table } from "dexie";
import { Session } from "../../types/session";
import { Biomarker } from "../../types/biomaker";

export class AutiSenseDB extends Dexie {
  sessions!: Table<Session>;
  biomarkers!: Table<Biomarker>;
  syncQueue!: Table<{ id?: number; sessionId: string }>;

  constructor() {
    super("AutiSenseDB");

    this.version(1).stores({
      sessions: "id, userId, createdAt, synced",
      biomarkers: "++id, sessionId, userId, timestamp",
      syncQueue: "++id, sessionId",
    });
  }
}

export const db = new AutiSenseDB();
