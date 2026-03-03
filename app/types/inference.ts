/**
 * Shared type definitions for the multimodal autism detector inference pipeline.
 *
 * Ported from the standalone detector app (Autism_code/web/src/types.ts)
 * for integration with AutiSense. All inference runs client-side in a
 * Web Worker — no video or audio ever leaves the device.
 */

// ── Modality ─────────────────────────────────────────────────────────

/** Active analysis modality. */
export type Modality = "body" | "face" | "both";

// ── Body behaviour classes (6-class Pose-TCN) ──────────────────────

/** The 6 behavior classes recognized by the Pose-TCN model. */
export const BEHAVIOR_CLASSES = [
  "hand_flapping",
  "body_rocking",
  "head_banging",
  "spinning",
  "toe_walking",
  "non_autistic",
] as const;

export type BehaviorClass = (typeof BEHAVIOR_CLASSES)[number];

/** Human-readable labels for the 6 classes. */
export const BEHAVIOR_LABELS: Record<BehaviorClass, string> = {
  hand_flapping: "Hand Flapping",
  body_rocking: "Body Rocking",
  head_banging: "Head Banging",
  spinning: "Spinning",
  toe_walking: "Toe Walking",
  non_autistic: "Non-Autistic",
};

/** Color palette adapted for AutiSense sage green theme. */
export const BEHAVIOR_COLORS: Record<BehaviorClass, string> = {
  hand_flapping: "var(--peach-300, #f5c0a0)",
  body_rocking: "#d97756",
  head_banging: "var(--lavender-300, #9b8ec4)",
  spinning: "var(--sky-300, #7dd3fc)",
  toe_walking: "var(--sage-400, #6b9a76)",
  non_autistic: "var(--sage-500, #3a6344)",
};

// ── Face behaviour classes (4-class Face-TCN) ──────────────────────

/** The 4 face behaviour classes recognized by the Face-TCN model. */
export const FACE_BEHAVIOR_CLASSES = [
  "typical_expression",
  "flat_affect",
  "atypical_expression",
  "gaze_avoidance",
] as const;

export type FaceBehaviorClass = (typeof FACE_BEHAVIOR_CLASSES)[number];

/** Human-readable labels for the 4 face classes. */
export const FACE_BEHAVIOR_LABELS: Record<FaceBehaviorClass, string> = {
  typical_expression: "Typical Expression",
  flat_affect: "Flat Affect",
  atypical_expression: "Atypical Expression",
  gaze_avoidance: "Gaze Avoidance",
};

/** Color palette for face behaviour classes (AutiSense theme). */
export const FACE_BEHAVIOR_COLORS: Record<FaceBehaviorClass, string> = {
  typical_expression: "var(--sage-500, #3a6344)",
  flat_affect: "var(--peach-300, #f5c0a0)",
  atypical_expression: "var(--lavender-300, #9b8ec4)",
  gaze_avoidance: "#d97756",
};

// ── Face analysis result ───────────────────────────────────────────

/** Result from the face analysis sub-pipeline. */
export interface FaceResult {
  /** 8 FER+ emotion probabilities. */
  emotions: Float32Array;
  /** Face behaviour class probabilities (4 classes). */
  faceBehavior?: {
    probabilities: Float32Array;
    predictedClass: number;
    className: string;
  };
  /** Face bounding box [cx, cy, w, h] in image space. */
  faceBbox: number[];
  /** Gaze direction: horizontal offset (-1 left to +1 right). */
  gazeH: number;
  /** Gaze direction: vertical offset (-1 up to +1 down). */
  gazeV: number;
  /** Gaze deviation from center (0 = centered, higher = more off-center). */
  gazeDeviation: number;
  /** Face detection confidence [0, 1]. */
  faceConfidence: number;
}

// ── Multimodal / fusion result ─────────────────────────────────────

/** Combined result from body + face pipelines. */
export interface MultimodalResult {
  /** Overall ASD risk score (0-1). */
  asdRisk: number;
  /** Body-modality ASD risk (0-1). */
  bodyRisk: number;
  /** Face-modality ASD risk (0-1). */
  faceRisk: number;
  /** Fusion confidence (1.0 when both modalities available). */
  confidence: number;
}

// ── Pipeline result ────────────────────────────────────────────────

/** Result of a single pipeline invocation. */
export interface PipelineResult {
  /** 17x2 normalized keypoint positions (flat). Undefined in face-only mode. */
  keypoints?: Float32Array;
  /** 17 confidence scores for each keypoint. Undefined in face-only mode. */
  confidence?: Float32Array;
  /** [x, y, w, h] bounding box in the original image space. Undefined in face-only mode. */
  bbox?: number[];
  /** Classification result (only present once the ring buffer is full). */
  behavior?: {
    probabilities: Float32Array;
    predictedClass: number;
    className: string;
  };
  /** Face analysis result (only present when face pipeline is enabled). */
  face?: FaceResult;
  /** Multimodal fusion result (only present when face pipeline is enabled). */
  multimodal?: MultimodalResult;
  /** Frames per second (smoothed). */
  fps: number;
  /** End-to-end latency of the last frame in milliseconds. */
  latencyMs: number;
  /** Body pipeline latency in milliseconds. */
  bodyLatencyMs?: number;
  /** Face pipeline latency in milliseconds. */
  faceLatencyMs?: number;
}

/** Messages sent **to** the InferenceWorker. */
export type WorkerInMessage =
  | { type: "init" }
  | { type: "processFrame"; imageData: ImageData }
  | { type: "toggleFace"; enabled: boolean }
  | { type: "setModality"; modality: Modality }
  | { type: "reset" };

/** Messages sent **from** the InferenceWorker. */
export type WorkerOutMessage =
  | { type: "initialized" }
  | { type: "result"; data: PipelineResult }
  | { type: "error"; message: string };
