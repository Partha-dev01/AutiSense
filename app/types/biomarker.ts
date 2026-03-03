/**
 * Type definitions for AI-derived biomarker data.
 * These are purely numerical — no raw media is ever stored.
 *
 * v2: Extended with Stage 4-10 task IDs and multimodal detector fields
 * for body behavior classification, face analysis, and ASD risk scoring.
 */
export type TaskId =
  | "gaze_tracking"
  | "motor_tap"
  | "sound_match"
  | "social_attention"
  | "response_latency"
  | "communication_responsiveness"
  | "social_visual_engagement"
  | "behavioral_observation"
  | "preparation_interactive"
  | "motor_assessment"
  | "audio_assessment"
  | "behavioral_video";

export interface Biomarker {
  id?: number;
  sessionId: string;
  /** Anonymous user identifier (mirrors Session.userId) */
  userId: string;
  /** Gaze consistency score — 0.0 to 1.0 */
  gazeScore: number;
  /** Motor coordination score — 0.0 to 1.0 */
  motorScore: number;
  /** Vocalization quality score — 0.0 to 1.0 */
  vocalizationScore: number;
  /** Time between stimulus and first observable response */
  responseLatencyMs: number | null;
  /** Which task screen produced this reading */
  taskId: TaskId;
  timestamp: number;

  // ── Extended fields (Stage 10 — behavioral_video only) ──────────
  /** Overall ASD risk score from FusionEngine (0-1) */
  asdRiskScore?: number;
  /** Predicted body behavior class (e.g. "hand_flapping") */
  bodyBehaviorClass?: string;
  /** Predicted face behavior class (e.g. "flat_affect") */
  faceBehaviorClass?: string;
  /** Body TCN class probabilities [6] */
  bodyProbabilities?: number[];
  /** Face TCN class probabilities [4] */
  faceProbabilities?: number[];
  /** FER+ emotion distribution [8] */
  emotionDistribution?: number[];
}

export interface BiomarkerAggregate {
  sessionId: string;
  avgGazeScore: number;
  avgMotorScore: number;
  avgVocalizationScore: number;
  avgResponseLatencyMs: number | null;
  sampleCount: number;
  overallScore: number;
  /** DSM-5 domain flags based on thresholds */
  flags: {
    socialCommunication: boolean;
    restrictedBehavior: boolean;
  };

  // ── Extended aggregate fields (populated when behavioral_video data exists) ──
  /** Average ASD risk from detector fusion */
  avgAsdRisk?: number;
  /** Most frequent body behavior class */
  dominantBodyBehavior?: string;
  /** Most frequent face behavior class */
  dominantFaceBehavior?: string;
  /** Distribution of body behavior classes over the session */
  behaviorClassDistribution?: Record<string, number>;
}
