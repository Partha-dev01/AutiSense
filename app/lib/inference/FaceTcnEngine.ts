/**
 * FaceTcnEngine — runs the Face-TCN ONNX classifier on a ring buffer of
 * 64 frames of 64-dim face feature vectors.
 *
 * The model expects input shape [1, 64, 64] (batch, sequence, features)
 * and outputs [1, 4] logits (one per face behavior class).
 *
 * Mirrors the TcnEngine pattern but for face-specific features and classes.
 */

import * as ort from "onnxruntime-web";
import { detectBestBackend, getSessionOptions } from "./backendDetector";
import { FACE_BEHAVIOR_CLASSES } from "../../types/inference";

const WINDOW_SIZE = 64;
const FEATURE_DIM = 64;
const NUM_CLASSES = 4;

export interface FaceTcnResult {
  /** Softmax probabilities for each face class. */
  probabilities: Float32Array;
  /** Index of the class with the highest probability. */
  predictedClass: number;
}

export class FaceTcnEngine {
  private session: ort.InferenceSession | null = null;
  private ringBuffer: Float32Array = new Float32Array(FEATURE_DIM * WINDOW_SIZE);
  private writeIdx = 0;
  private frameCount = 0;

  async init(modelPath: string): Promise<void> {
    const backend = await detectBestBackend();
    this.session = await ort.InferenceSession.create(
      modelPath,
      getSessionOptions(backend),
    );
  }

  async classify(features: Float32Array): Promise<FaceTcnResult | null> {
    if (!this.session) {
      throw new Error("FaceTcnEngine not initialised — call init() first.");
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

    // Build input tensor (reorder to chronological, sequence-first layout)
    // Output layout: [WINDOW_SIZE, FEATURE_DIM] to match model shape [1, 64, 64].
    const input = new Float32Array(WINDOW_SIZE * FEATURE_DIM);
    const oldest = this.writeIdx;
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

  isReady(): boolean {
    return this.frameCount >= WINDOW_SIZE;
  }

  reset(): void {
    this.ringBuffer.fill(0);
    this.writeIdx = 0;
    this.frameCount = 0;
  }

  static className(index: number): string {
    return FACE_BEHAVIOR_CLASSES[index] ?? "unknown";
  }

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
