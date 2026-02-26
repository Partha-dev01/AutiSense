export interface Biomarker {
  id?: number;
  sessionId: string;
  userId: string;
  gazeScore: number;
  motorScore: number;
  vocalizationScore: number;
  timestamp: number;
}
