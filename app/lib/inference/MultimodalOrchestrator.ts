/**
 * MultimodalOrchestrator — coordinates the body-pose and face analysis
 * pipelines, running them in sequence and fusing results.
 *
 * Architecture:
 *   Frame → [BodyPipeline (body / both mode)]
 *         → [FacePipeline (face / both mode, every 2nd frame)]
 *         → [FusionEngine]
 *         → PipelineResult
 *
 * Supports three modalities: "body", "face", "both".
 */

import { PipelineOrchestrator } from "./PipelineOrchestrator";
import { FaceDetector } from "./FaceDetector";
import { FerEngine } from "./FerEngine";
import { FaceFeatureEncoder } from "./FaceFeatureEncoder";
import { FaceTcnEngine } from "./FaceTcnEngine";
import { FusionEngine } from "./FusionEngine";
import type { FaceTcnResult } from "./FaceTcnEngine";
import type { PipelineResult, FaceResult, Modality } from "../../types/inference";
import { FACE_BEHAVIOR_CLASSES } from "../../types/inference";

/** Model paths — absolute URLs required for Web Worker context. */
const FER_MODEL_PATH = `${self.location.origin}/models/emotion-ferplus-8.onnx`;
const FACE_TCN_MODEL_PATH = `${self.location.origin}/models/face-tcn-int8.onnx`;

export class MultimodalOrchestrator {
  /** Body-pose pipeline. */
  private bodyPipeline = new PipelineOrchestrator();

  /** Face sub-pipeline components. */
  private faceDetector = new FaceDetector();
  private ferEngine = new FerEngine();
  private faceEncoder = new FaceFeatureEncoder();
  private faceTcn = new FaceTcnEngine();
  private fusionEngine = new FusionEngine();

  /** Current analysis modality. */
  private modality: Modality = "body";
  /** Whether face models are loaded. */
  private faceModelsLoaded = false;

  /** Run face pipeline every Nth frame for performance. */
  private faceSkipRate = 3;
  private frameCounter = 0;

  /** Cached face result from the last face-processed frame. */
  private lastFaceResult: FaceResult | null = null;
  private lastFaceTcnResult: FaceTcnResult | null = null;

  /** Exponentially-smoothed FPS counter. */
  private fpsSmooth = 0;
  private lastFrameTime = 0;

  get backend(): "webgpu" | "wasm" {
    return this.bodyPipeline.backend;
  }

  /**
   * Initialise the body pipeline. Face models are loaded lazily
   * when a face-requiring modality is first selected.
   */
  async init(yoloPath?: string, tcnPath?: string): Promise<void> {
    await this.bodyPipeline.init(yoloPath, tcnPath);
    this.lastFrameTime = performance.now();
  }

  /**
   * Set the analysis modality.
   * Lazily loads face models when switching to "face" or "both".
   */
  async setModality(modality: Modality): Promise<void> {
    this.modality = modality;

    if ((modality === "face" || modality === "both") && !this.faceModelsLoaded) {
      await this.loadFaceModels();
    }

    if (modality === "body") {
      this.lastFaceResult = null;
      this.lastFaceTcnResult = null;
      this.faceEncoder.reset();
    }
  }

  /**
   * Toggle the face analysis pipeline (legacy compat).
   */
  async setFaceEnabled(enabled: boolean): Promise<void> {
    await this.setModality(enabled ? "both" : "body");
  }

  get isFaceEnabled(): boolean {
    return this.modality === "face" || this.modality === "both";
  }

  /**
   * Process a single camera frame through the active pipeline(s).
   */
  async processFrame(imageData: ImageData): Promise<PipelineResult> {
    const t0 = performance.now();
    const runBody = this.modality === "body" || this.modality === "both";
    const runFace = (this.modality === "face" || this.modality === "both") && this.faceModelsLoaded;

    // ── 1. Body pipeline ─────────────────────────────────────────
    let bodyResult: PipelineResult | null = null;
    let bodyLatencyMs = 0;

    if (runBody) {
      const bodyT0 = performance.now();
      bodyResult = await this.bodyPipeline.processFrame(imageData);
      bodyLatencyMs = performance.now() - bodyT0;
    }

    // ── 1b. Body noise gate — suppress sub-5% behavior classes (camera shake)
    if (bodyResult?.behavior) {
      const probs = bodyResult.behavior.probabilities;
      const NOISE_FLOOR = 0.05;
      let redistributed = 0;
      for (let i = 0; i < 5; i++) {
        if (probs[i] < NOISE_FLOOR) {
          redistributed += probs[i];
          probs[i] = 0;
        }
      }
      probs[5] += redistributed;
    }

    // ── 2. Face pipeline ─────────────────────────────────────────
    let faceLatencyMs = 0;

    if (runFace) {
      this.frameCounter++;
      const shouldRunFace = this.frameCounter % this.faceSkipRate === 0;

      if (shouldRunFace) {
        const faceT0 = performance.now();
        if (this.modality === "face") {
          // Face-only: extract from center of frame (no YOLO bbox)
          await this.runFacePipelineFromFrame(imageData);
        } else if (bodyResult?.bbox) {
          // Both: extract from YOLO person bbox
          await this.runFacePipeline(imageData, bodyResult.bbox);
        } else {
          // Fallback: no person bbox available, use center-of-frame
          await this.runFacePipelineFromFrame(imageData);
        }
        faceLatencyMs = performance.now() - faceT0;
      }
    }

    // ── 3. Fusion ────────────────────────────────────────────────
    let multimodal = undefined;

    if (this.modality === "both" && bodyResult?.behavior) {
      const bodyTcnResult = {
        probabilities: bodyResult.behavior.probabilities,
        predictedClass: bodyResult.behavior.predictedClass,
      };
      const fusionResult = this.fusionEngine.fuse(bodyTcnResult, this.lastFaceTcnResult);
      if (fusionResult) multimodal = fusionResult;
    } else if (this.modality === "face" && this.lastFaceTcnResult) {
      const fusionResult = this.fusionEngine.fuseFaceOnly(this.lastFaceTcnResult);
      if (fusionResult) multimodal = fusionResult;
    }

    // ── 4. Timing ────────────────────────────────────────────────
    const t1 = performance.now();
    const latencyMs = t1 - t0;
    const dt = t1 - this.lastFrameTime;
    this.lastFrameTime = t1;

    const instantFps = dt > 0 ? 1000 / dt : 0;
    this.fpsSmooth = this.fpsSmooth === 0
      ? instantFps
      : this.fpsSmooth * 0.9 + instantFps * 0.1;

    // ── 5. Build result ──────────────────────────────────────────
    const result: PipelineResult = {
      keypoints: bodyResult?.keypoints,
      confidence: bodyResult?.confidence,
      bbox: bodyResult?.bbox,
      behavior: bodyResult?.behavior,
      fps: Math.round(this.fpsSmooth * 10) / 10,
      latencyMs: Math.round(latencyMs * 10) / 10,
    };

    if (bodyLatencyMs > 0) {
      result.bodyLatencyMs = Math.round(bodyLatencyMs * 10) / 10;
    }

    if (runFace) {
      result.face = this.lastFaceResult ?? undefined;
      result.multimodal = multimodal;
      result.faceLatencyMs = Math.round(faceLatencyMs * 10) / 10;
    }

    return result;
  }

  reset(): void {
    this.bodyPipeline.reset();
    this.faceEncoder.reset();
    this.lastFaceResult = null;
    this.lastFaceTcnResult = null;
    this.frameCounter = 0;
    this.fpsSmooth = 0;
  }

  // ── Private helpers ────────────────────────────────────────────

  /**
   * Rebalance Face-TCN probabilities using FER+ emotion signal.
   *
   * The Face-TCN receives mostly-zero features (blendshapes/landmarks unavailable)
   * causing it to default to flat_affect. This post-processor uses the valid
   * FER+ emotions to correct that bias via temperature scaling + emotion modulation.
   *
   * Face classes: 0=typical_expression, 1=flat_affect, 2=atypical_expression, 3=gaze_avoidance
   * FER+ emotions: 0=neutral, 1=happiness, 2=surprise, 3=sadness, 4=anger, 5=disgust, 6=fear, 7=contempt
   */
  private rebalanceFaceProbs(
    probs: Float32Array,
    emotions: Float32Array,
  ): Float32Array {
    const adjusted = new Float32Array(4);

    // 1. Temperature scaling (T=0.5) — make softmax sharper
    const T = 0.5;
    let sumExp = 0;
    for (let i = 0; i < 4; i++) {
      const logit = Math.log(Math.max(probs[i], 1e-8));
      adjusted[i] = Math.exp(logit / T);
      sumExp += adjusted[i];
    }
    for (let i = 0; i < 4; i++) adjusted[i] /= sumExp;

    // 2. Emotion-driven modulation: if FER+ sees non-neutral expression,
    //    transfer probability from flat_affect to typical_expression
    const maxNonNeutral = Math.max(
      emotions[1], emotions[2], emotions[3],
      emotions[4], emotions[5], emotions[6], emotions[7],
    );
    if (maxNonNeutral > 0.15) {
      const emotionSignal = Math.min(maxNonNeutral * 2, 0.8);
      const transfer = adjusted[1] * emotionSignal * 0.5;
      adjusted[1] -= transfer;
      adjusted[0] += transfer;
    }

    // 3. Cap flat_affect at 60% to prevent overwhelming display
    if (adjusted[1] > 0.6) {
      const excess = adjusted[1] - 0.6;
      adjusted[1] = 0.6;
      const otherSum = adjusted[0] + adjusted[2] + adjusted[3];
      if (otherSum > 0) {
        for (const i of [0, 2, 3]) {
          adjusted[i] += excess * (adjusted[i] / otherSum);
        }
      } else {
        adjusted[0] += excess;
      }
    }

    // 4. Normalize
    let total = 0;
    for (let i = 0; i < 4; i++) total += adjusted[i];
    if (total > 0) {
      for (let i = 0; i < 4; i++) adjusted[i] /= total;
    }

    return adjusted;
  }

  private async loadFaceModels(): Promise<void> {
    try {
      await Promise.all([
        this.ferEngine.init(FER_MODEL_PATH),
        this.faceTcn.init(FACE_TCN_MODEL_PATH),
      ]);
      this.faceModelsLoaded = true;
    } catch (err) {
      console.warn("Face models failed to load:", err);
      this.faceModelsLoaded = false;
      this.modality = "body"; // fallback
    }
  }

  /** Run face pipeline using YOLO person bbox (body+face mode). */
  private async runFacePipeline(
    imageData: ImageData,
    personBbox: number[],
  ): Promise<void> {
    try {
      const faceROI = this.faceDetector.extractFaceROI(imageData, personBbox);
      if (!faceROI) {
        this.lastFaceResult = null;
        return;
      }
      await this.processFaceROI(faceROI);
    } catch (err) {
      console.warn("Face pipeline error:", err);
      this.lastFaceResult = null;
    }
  }

  /** Run face pipeline using center-of-frame extraction (face-only mode). */
  private async runFacePipelineFromFrame(imageData: ImageData): Promise<void> {
    try {
      const faceROI = this.faceDetector.extractFaceFromFrame(imageData);
      if (!faceROI) {
        this.lastFaceResult = null;
        return;
      }
      await this.processFaceROI(faceROI);
    } catch (err) {
      console.warn("Face pipeline (frame-based) error:", err);
      this.lastFaceResult = null;
    }
  }

  /** Shared face processing: FER → encode → TCN → build result. */
  private async processFaceROI(faceROI: { imageData: ImageData; bbox: number[] }): Promise<void> {
    const grayscale = this.faceDetector.extractGrayscaleCrop(faceROI);
    if (!grayscale) {
      this.lastFaceResult = null;
      return;
    }

    const emotions = await this.ferEngine.classify(grayscale);

    const blendshapes = new Float32Array(52);
    const landmarks = new Float32Array(956); // 478 * 2
    const faceConfidence = 1.0;

    const features = this.faceEncoder.encodeFrame(
      emotions,
      blendshapes,
      landmarks,
      faceConfidence,
    );

    const faceTcnResult = await this.faceTcn.classify(features);

    // Post-process: rebalance face probs using FER+ emotions to correct
    // flat_affect bias caused by zero blendshapes/landmarks
    if (faceTcnResult) {
      faceTcnResult.probabilities = this.rebalanceFaceProbs(
        faceTcnResult.probabilities, emotions,
      );
      let maxP = 0, maxI = 0;
      for (let i = 0; i < 4; i++) {
        if (faceTcnResult.probabilities[i] > maxP) {
          maxP = faceTcnResult.probabilities[i]; maxI = i;
        }
      }
      faceTcnResult.predictedClass = maxI;
    }

    this.lastFaceTcnResult = faceTcnResult;

    const gazeH = features[16];
    const gazeV = features[17];
    const gazeDeviation = features[18];

    this.lastFaceResult = {
      emotions,
      faceBbox: faceROI.bbox,
      gazeH,
      gazeV,
      gazeDeviation,
      faceConfidence,
    };

    if (faceTcnResult) {
      this.lastFaceResult.faceBehavior = {
        probabilities: faceTcnResult.probabilities,
        predictedClass: faceTcnResult.predictedClass,
        className: FACE_BEHAVIOR_CLASSES[faceTcnResult.predictedClass],
      };
    }
  }
}
