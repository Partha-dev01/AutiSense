/**
 * TcnEngine — runs the Pose-TCN ONNX classifier on a ring buffer of
 * 64 frames of 86-dim feature vectors.
 *
 * The model expects input shape [1, 64, 86] (batch, sequence, features)
 * and outputs [1, 6] logits (one per behavior class).
 */

import * as ort from "onnxruntime-web";
import { detectBestBackend, getSessionOptions } from "./backendDetector";
import { BEHAVIOR_CLASSES } from "../../types/inference";

/** Number of frames the TCN expects as a sliding window. */
const WINDOW_SIZE = 64;
/** Dimensionality of each feature vector. */
const FEATURE_DIM = 86;
/** Number of behavior classes. */
const NUM_CLASSES = 6;

export interface TcnResult {
  /** Softmax probabilities for each class. */
  probabilities: Float32Array;
  /** Index of the class with the highest probability. */
  predictedClass: number;
}

export class TcnEngine {
  private session: ort.InferenceSession | null = null;

  /**
   * Ring buffer storing the last WINDOW_SIZE feature vectors.
   * Layout: column-major for direct TCN input — shape [FEATURE_DIM, WINDOW_SIZE].
   * ringBuffer[f * WINDOW_SIZE + t] = feature f at time step t.
   */
  private ringBuffer: Float32Array = new Float32Array(FEATURE_DIM * WINDOW_SIZE);
  /** Current write index (wraps around WINDOW_SIZE). */
  private writeIdx = 0;
  /** Total number of frames that have been pushed. */
  private frameCount = 0;

  /**
   * Load the Pose-TCN ONNX model.
   * @param modelPath URL / path to the .onnx file.
   */
  async init(modelPath: string): Promise<void> {
    const backend = await detectBestBackend();
    this.session = await ort.InferenceSession.create(
      modelPath,
      getSessionOptions(backend),
    );
  }

  /**
   * Push a new 86-dim feature vector into the ring buffer and, once the
   * buffer is full, run the TCN classifier.
   *
   * @param features Float32Array of length 86.
   * @returns Classification result, or `null` if the buffer is not yet full.
   */
  async classify(features: Float32Array): Promise<TcnResult | null> {
    if (!this.session) {
      throw new Error("TcnEngine not initialised — call init() first.");
    }

    // Write features into the ring buffer (column-major).
    const t = this.writeIdx;
    for (let f = 0; f < FEATURE_DIM; f++) {
      this.ringBuffer[f * WINDOW_SIZE + t] = features[f];
    }
    this.writeIdx = (this.writeIdx + 1) % WINDOW_SIZE;
    this.frameCount++;

    if (!this.isReady()) {
      return null;
    }

    // Build the input tensor — reorder the ring buffer so that the oldest
    // frame comes first (chronological order).
    // Output layout: [WINDOW_SIZE, FEATURE_DIM] (sequence-first) to match
    // the model's expected shape [1, 64, 86].
    const input = new Float32Array(WINDOW_SIZE * FEATURE_DIM);
    const oldest = this.writeIdx; // points to the oldest slot after wrap
    for (let i = 0; i < WINDOW_SIZE; i++) {
      const srcT = (oldest + i) % WINDOW_SIZE;
      for (let f = 0; f < FEATURE_DIM; f++) {
        input[i * FEATURE_DIM + f] = this.ringBuffer[f * WINDOW_SIZE + srcT];
      }
    }

    const tensor = new ort.Tensor("float32", input, [1, WINDOW_SIZE, FEATURE_DIM]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensor;

    const results = await this.session.run(feeds);
    const outputName = this.session.outputNames[0];
    const logits = results[outputName].data as Float32Array;

    const probabilities = this.softmax(logits);

    let predictedClass = 0;
    let maxProb = probabilities[0];
    for (let i = 1; i < NUM_CLASSES; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        predictedClass = i;
      }
    }

    return { probabilities, predictedClass };
  }

  /** Whether the ring buffer contains at least WINDOW_SIZE frames. */
  isReady(): boolean {
    return this.frameCount >= WINDOW_SIZE;
  }

  /** Clear the ring buffer and frame counter. */
  reset(): void {
    this.ringBuffer.fill(0);
    this.writeIdx = 0;
    this.frameCount = 0;
  }

  /** Get the class name for a predicted index. */
  static className(index: number): string {
    return BEHAVIOR_CLASSES[index] ?? "unknown";
  }

  // ────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────

  /** Numerically-stable softmax. */
  private softmax(logits: Float32Array): Float32Array {
    const out = new Float32Array(logits.length);
    let maxVal = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxVal) maxVal = logits[i];
    }
    let sumExp = 0;
    for (let i = 0; i < logits.length; i++) {
      out[i] = Math.exp(logits[i] - maxVal);
      sumExp += out[i];
    }
    for (let i = 0; i < logits.length; i++) {
      out[i] /= sumExp;
    }
    return out;
  }
}
