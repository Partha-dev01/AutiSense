export type SessionStatus = "in_progress" | "completed" | "synced";

export interface Session {
  //Client-generated UUID — used as DynamoDB partition key
  id: string;
  // Anonymous user identifier from localStorage (never PII)
  userId: string;
  //Child's first name — stored locally only, stripped before cloud sync
  childName: string;
  //Child's age in months at time of session creation
  ageMonths: number;
  language: string;
  gender: string;
  createdAt: number;
  completedAt: number | null;
  status: SessionStatus;
  //Whether this session has been uploaded to DynamoDB
  synced: boolean;
}

export type SessionSyncPayload = Omit<Session, "childName">;
