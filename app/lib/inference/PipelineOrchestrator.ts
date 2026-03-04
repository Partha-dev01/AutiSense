/**
 * PipelineOrchestrator — ties the full inference pipeline together:
 *
 *   Webcam frame  ->  YoloEngine (pose detection)
 *                 ->  FeatureEncoder (86-dim features)
 *                 ->  TcnEngine (ring buffer + classification)
 *                 ->  PipelineResult
 */

import { YoloEngine } from "./YoloEngine";
import { TcnEngine } from "./TcnEngine";
import { FeatureEncoder } from "./FeatureEncoder";
import type { PipelineResult } from "../../types/inference";
import { BEHAVIOR_CLASSES } from "../../types/inference";

/** Default model paths — absolute URLs required for Web Worker context. */
const YOLO_MODEL_PATH = `${self.location.origin}/models/yolo26n-pose-int8.onnx`;
const TCN_MODEL_PATH = `${self.location.origin}/models/pose-tcn-int8.onnx`;

export class PipelineOrchestrator {
  private yolo = new YoloEngine();
  private tcn = new TcnEngine();
  private encoder = new FeatureEncoder();

  /** Exponentially-smoothed FPS counter. */
  private fpsSmooth = 0;
  private lastFrameTime = 0;

  /** The ONNX runtime backend in use. */
  get backend(): "webgpu" | "wasm" {
    return this.yolo.activeBackend;
  }

  /**
   * Initialise both ONNX models.
   *
   * @param yoloPath  Optional override for the YOLO model URL.
   * @param tcnPath   Optional override for the TCN model URL.
   */
  async init(
    yoloPath: string = YOLO_MODEL_PATH,
    tcnPath: string = TCN_MODEL_PATH,
  ): Promise<void> {
    await Promise.all([this.yolo.init(yoloPath), this.tcn.init(tcnPath)]);
    this.encoder.reset();
    this.tcn.reset();
    this.lastFrameTime = performance.now();
  }

  /**
   * Process a single camera frame end-to-end.
   *
   * @param imageData Raw RGBA pixel data from the webcam canvas.
   * @returns Full pipeline result including keypoints, classification (when
   *          available), FPS and latency.
   */
  async processFrame(imageData: ImageData): Promise<PipelineResult> {
    const t0 = performance.now();

    // ── 1. Pose detection ────────────────────────────────────────
    const detection = await this.yolo.detect(imageData);

    // ── 2. Feature encoding ──────────────────────────────────────
    const features = this.encoder.encodeFrame(
      detection.keypoints,
      detection.confidence,
    );

    // ── 3. TCN classification ────────────────────────────────────
    const tcnResult = await this.tcn.classify(features);

    // ── 4. Timing ────────────────────────────────────────────────
    const t1 = performance.now();
    const latencyMs = t1 - t0;
    const dt = t1 - this.lastFrameTime;
    this.lastFrameTime = t1;

    // Exponential moving average for FPS (alpha = 0.1)
    const instantFps = dt > 0 ? 1000 / dt : 0;
    this.fpsSmooth = this.fpsSmooth === 0
      ? instantFps
      : this.fpsSmooth * 0.9 + instantFps * 0.1;

    // ── 5. Build result ──────────────────────────────────────────
    const result: PipelineResult = {
      keypoints: detection.keypoints,
      confidence: detection.confidence,
      bbox: detection.bbox,
      fps: Math.round(this.fpsSmooth * 10) / 10,
      latencyMs: Math.round(latencyMs * 10) / 10,
    };

    if (tcnResult) {
      result.behavior = {
        probabilities: tcnResult.probabilities,
        predictedClass: tcnResult.predictedClass,
        className: BEHAVIOR_CLASSES[tcnResult.predictedClass],
      };
    }

    return result;
  }

  /** Reset all internal state (feature encoder history, ring buffer). */
  reset(): void {
    this.encoder.reset();
    this.tcn.reset();
    this.fpsSmooth = 0;
  }
}
