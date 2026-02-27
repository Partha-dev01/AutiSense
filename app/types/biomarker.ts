//Type definitions for AI-derived biomarker data.
//These are purely numerical no raw media is ever stored.
export type TaskId =
  | "gaze_tracking"
  | "motor_tap"
  | "sound_match"
  | "social_attention"
  | "response_latency";

export interface Biomarker {
  id?: number;
  sessionId: string;
  //Anonymous user identifier (mirrors Session.userId)
  userId: string;
  //Gaze consistency score — 0.0 to 1.0 and motor score 0.0 to 1.0
  //Higher = more consistent eye contact / gaze direction toward stimulus
  gazeScore: number;
  //Derived from keypoint velocity and tap accuracy
  motorScore: number;
  vocalizationScore: number;
  //Time between stimulus appearing and first observable response.
  responseLatencyMs: number | null;
  //Which task screen produced this reading
  taskId: TaskId;
  timestamp: number;
}
export interface BiomarkerAggregate {
  sessionId: string;
  avgGazeScore: number;
  avgMotorScore: number;
  avgVocalizationScore: number;
  avgResponseLatencyMs: number | null;
  sampleCount: number;
  overallScore: number;
  //DSM-5 domain flags based on thresholds
  flags: {
    socialCommunication: boolean; // gazeScore < 0.4 or vocalization < 0.35
    restrictedBehavior: boolean; // motorScore < 0.35 or latency > 3000ms
  };
}
