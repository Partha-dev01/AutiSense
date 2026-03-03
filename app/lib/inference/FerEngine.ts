/**
 * FerEngine — runs the FER+ ONNX model for 8-class emotion classification.
 *
 * Input: grayscale 64x64 face image
 * Output: 8 emotion probabilities [neutral, happiness, surprise, sadness,
 *         anger, disgust, fear, contempt]
 */

import * as ort from "onnxruntime-web";
import { detectBestBackend, getSessionOptions } from "./backendDetector";

export const EMOTION_CLASSES = [
  "neutral",
  "happiness",
  "surprise",
  "sadness",
  "anger",
  "disgust",
  "fear",
  "contempt",
] as const;

export type EmotionClass = (typeof EMOTION_CLASSES)[number];

export class FerEngine {
  private session: ort.InferenceSession | null = null;

  /**
   * Load the FER+ ONNX model.
   * @param modelPath URL / path to the emotion-ferplus-8 .onnx file.
   */
  async init(modelPath: string): Promise<void> {
    const backend = await detectBestBackend();
    this.session = await ort.InferenceSession.create(
      modelPath,
      getSessionOptions(backend),
    );
  }

  /**
   * Classify a 64x64 grayscale face image.
   *
   * @param grayscale Float32Array of length 4096 (64*64), values in [0, 1]
   * @returns Float32Array of 8 emotion probabilities
   */
  async classify(grayscale: Float32Array): Promise<Float32Array> {
    if (!this.session) {
      throw new Error("FerEngine not initialised — call init() first.");
    }

    // FER+ expects input shape [1, 1, 64, 64] (batch, channel, height, width)
    const tensor = new ort.Tensor("float32", grayscale, [1, 1, 64, 64]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensor;

    const results = await this.session.run(feeds);
    const outputName = this.session.outputNames[0];
    const logits = results[outputName].data as Float32Array;

    return this.softmax(logits);
  }

  /** Get emotion class name by index. */
  static emotionName(index: number): string {
    return EMOTION_CLASSES[index] ?? "unknown";
  }

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
