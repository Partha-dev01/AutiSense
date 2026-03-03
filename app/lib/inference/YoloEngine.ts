/**
 * YoloEngine — runs YOLO26n-pose ONNX model to detect a person and extract
 * 17 COCO keypoints from a single camera frame.
 *
 * Pipeline:
 *   ImageData -> preprocess (resize + normalize + HWC->CHW) -> ONNX inference
 *   -> decode YOLO output -> NMS -> top person keypoints
 */

import * as ort from "onnxruntime-web";
import { detectBestBackend, getSessionOptions } from "./backendDetector";

/** YOLO input image size (320 for speed; model exported at imgsz=320). */
const INPUT_SIZE = 320;
/** Number of COCO keypoints. */
const NUM_KP = 17;

export interface YoloDetection {
  /** Flat array of 17 x 2 keypoint coordinates in the original image space. */
  keypoints: Float32Array;
  /** 17 per-keypoint confidence scores. */
  confidence: Float32Array;
  /** [x_center, y_center, width, height] bounding box in original image space. */
  bbox: number[];
}

export class YoloEngine {
  private session: ort.InferenceSession | null = null;
  private backend: "webgpu" | "wasm" = "wasm";

  /** Reusable canvases for hardware-accelerated preprocessing. */
  private preprocessCanvas: OffscreenCanvas;
  private preprocessCtx: OffscreenCanvasRenderingContext2D;
  private srcCanvas: OffscreenCanvas | null = null;
  private srcCtx: OffscreenCanvasRenderingContext2D | null = null;
  private lastSrcW = 0;
  private lastSrcH = 0;

  /** Reusable CHW buffer to avoid 1.2MB allocation per frame. */
  private chwBuffer = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  /** Cached input tensor wrapping chwBuffer (reused across frames). */
  private inputTensor: ort.Tensor | null = null;

  constructor() {
    this.preprocessCanvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    this.preprocessCtx = this.preprocessCanvas.getContext("2d")!;
  }

  /** The backend used for this session. */
  get activeBackend(): "webgpu" | "wasm" {
    return this.backend;
  }

  /**
   * Load the YOLO ONNX model.
   * @param modelPath URL or path to the .onnx file (e.g. "/models/yolo26n-pose-int8.onnx").
   */
  async init(modelPath: string): Promise<void> {
    this.backend = await detectBestBackend();
    this.session = await ort.InferenceSession.create(
      modelPath,
      getSessionOptions(this.backend),
    );
  }

  /**
   * Run inference on a single frame.
   *
   * @param imageData Raw RGBA pixel data from a canvas.
   * @returns The best person detection (highest confidence) or a zeroed result
   *          if no person is found.
   */
  async detect(imageData: ImageData): Promise<YoloDetection> {
    if (!this.session) {
      throw new Error("YoloEngine not initialised — call init() first.");
    }

    const inputTensor = this.preprocessImage(imageData);
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = this.session.inputNames[0];
    feeds[inputName] = inputTensor;

    const results = await this.session.run(feeds);
    const outputName = this.session.outputNames[0];
    const output = results[outputName];

    return this.decodeOutput(
      output.data as Float32Array,
      output.dims as number[],
      imageData.width,
      imageData.height,
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Resize the RGBA ImageData to INPUT_SIZE×INPUT_SIZE, normalise to [0, 1],
   * and convert from HWC to CHW.
   *
   * Uses OffscreenCanvas drawImage for hardware-accelerated letterbox resize,
   * then a single loop for HWC→CHW + normalisation.
   */
  private preprocessImage(imageData: ImageData): ort.Tensor {
    const { width: srcW, height: srcH } = imageData;
    const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padX = Math.round((INPUT_SIZE - newW) / 2);
    const padY = Math.round((INPUT_SIZE - newH) / 2);

    // Reuse or create the source canvas (holds raw ImageData)
    if (!this.srcCanvas || this.lastSrcW !== srcW || this.lastSrcH !== srcH) {
      this.srcCanvas = new OffscreenCanvas(srcW, srcH);
      this.srcCtx = this.srcCanvas.getContext("2d")!;
      this.lastSrcW = srcW;
      this.lastSrcH = srcH;
    }
    this.srcCtx!.putImageData(imageData, 0, 0);

    // Hardware-accelerated letterbox resize
    const ctx = this.preprocessCtx;
    ctx.fillStyle = "rgb(114, 114, 114)";
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(this.srcCanvas, 0, 0, srcW, srcH, padX, padY, newW, newH);

    // Extract pixels and convert HWC→CHW + normalize (reuse cached buffer)
    const pixels = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
    const chw = this.chwBuffer;
    const planeSize = INPUT_SIZE * INPUT_SIZE;
    for (let i = 0; i < planeSize; i++) {
      const j = i * 4;
      chw[i] = pixels[j] / 255;
      chw[planeSize + i] = pixels[j + 1] / 255;
      chw[2 * planeSize + i] = pixels[j + 2] / 255;
    }

    // Reuse tensor wrapper (same buffer reference, same shape every frame)
    if (!this.inputTensor) {
      this.inputTensor = new ort.Tensor("float32", this.chwBuffer, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    }
    return this.inputTensor;
  }

  /**
   * Decode the raw YOLO pose output tensor.
   *
   * YOLO-pose output shape: [1, 56, num_detections]
   *   - rows 0-3: x_center, y_center, width, height (in 640-space)
   *   - row 4: objectness / confidence
   *   - rows 5..55: 17 keypoints x 3 (x, y, conf)
   *
   * We select the detection with the highest confidence, then convert
   * coordinates back to the original image space.
   */
  private decodeOutput(
    data: Float32Array,
    dims: number[],
    origW: number,
    origH: number,
  ): YoloDetection {
    // dims: [1, 56, N]
    const numFeatures = dims[1];
    const numDetections = dims[2];

    // Scale factors for converting back from 640-space to original
    const scale = Math.min(INPUT_SIZE / origW, INPUT_SIZE / origH);
    const padX = (INPUT_SIZE - Math.round(origW * scale)) / 2;
    const padY = (INPUT_SIZE - Math.round(origH * scale)) / 2;

    let bestIdx = -1;
    let bestConf = -1;

    // Find the detection with the highest confidence
    for (let i = 0; i < numDetections; i++) {
      const conf = data[4 * numDetections + i];
      if (conf > bestConf) {
        bestConf = conf;
        bestIdx = i;
      }
    }

    // Build the zero result used when nothing is detected
    const zeroResult: YoloDetection = {
      keypoints: new Float32Array(NUM_KP * 2),
      confidence: new Float32Array(NUM_KP),
      bbox: [0, 0, 0, 0],
    };

    if (bestIdx < 0 || bestConf < 0.25) {
      return zeroResult;
    }

    // Bounding box (in 640-space -> original space)
    const bx = (data[0 * numDetections + bestIdx] - padX) / scale;
    const by = (data[1 * numDetections + bestIdx] - padY) / scale;
    const bw = data[2 * numDetections + bestIdx] / scale;
    const bh = data[3 * numDetections + bestIdx] / scale;

    // Keypoints
    const keypoints = new Float32Array(NUM_KP * 2);
    const confidence = new Float32Array(NUM_KP);

    for (let k = 0; k < NUM_KP; k++) {
      const baseRow = 5 + k * 3; // Adjusted for typical YOLO-pose layout
      // Check we are within bounds
      if (baseRow + 2 < numFeatures) {
        const kx = (data[(baseRow + 0) * numDetections + bestIdx] - padX) / scale;
        const ky = (data[(baseRow + 1) * numDetections + bestIdx] - padY) / scale;
        const kc = data[(baseRow + 2) * numDetections + bestIdx];
        keypoints[k * 2] = kx;
        keypoints[k * 2 + 1] = ky;
        confidence[k] = kc;
      }
    }

    return {
      keypoints,
      confidence,
      bbox: [bx, by, bw, bh],
    };
  }
}
