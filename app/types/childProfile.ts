export interface ChildProfile {
  id: string; // UUID
  userId: string; // From identity
  name: string;
  ageMonths: number;
  language: string;
  gender: string;
  createdAt: number;
  lastSessionId?: string;
  lastSessionDate?: number;
}
