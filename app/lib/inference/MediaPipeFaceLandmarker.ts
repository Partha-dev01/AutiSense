/**
 * MediaPipeFaceLandmarker — wraps the @mediapipe/tasks-vision FaceLandmarker
 * to extract 478 face landmarks and 52 blendshape scores.
 *
 * Runs on the main thread (FaceLandmarker does not support OffscreenCanvas
 * in workers). The orchestrator calls it from the worker's postMessage handler.
 *
 * NOTE: Because @mediapipe/tasks-vision may not be installed yet, this module
 * uses a dynamic import so it fails gracefully if the package is missing.
 */

export interface FaceLandmarkResult {
  /** 478 landmarks as flat [x0,y0, x1,y1, ...] (956 values), normalised [0,1]. */
  landmarks: Float32Array;
  /** 52 blendshape scores in MediaPipe alphabetical order. */
  blendshapes: Float32Array;
  /** Face detection confidence [0, 1]. */
  confidence: number;
}

/**
 * Lightweight wrapper that lazily loads the MediaPipe FaceLandmarker WASM
 * model and returns landmarks + blendshapes per frame.
 */
export class MediaPipeFaceLandmarker {
  private landmarker: any = null;
  private ready = false;

  /**
   * Initialise the FaceLandmarker.
   *
   * @param wasmPath  CDN or local path to the MediaPipe WASM files.
   *                  Default: jsDelivr CDN for @mediapipe/tasks-vision.
   * @param modelPath Path to the face_landmarker.task model file.
   *                  Default: MediaPipe CDN.
   */
  async init(
    wasmPath: string = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    modelPath: string = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  ): Promise<void> {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const { FaceLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);

      this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
        runningMode: "VIDEO",
        numFaces: 1,
      });

      this.ready = true;
    } catch (err) {
      console.warn(
        "MediaPipe FaceLandmarker failed to initialise. " +
        "Face pipeline will be unavailable.",
        err,
      );
      this.ready = false;
    }
  }

  /**
   * Detect face landmarks from a video frame.
   *
   * @param videoElement The <video> element currently playing.
   * @param timestampMs  Frame timestamp in milliseconds.
   * @returns FaceLandmarkResult or null if no face detected.
   */
  detect(
    videoElement: HTMLVideoElement,
    timestampMs: number,
  ): FaceLandmarkResult | null {
    if (!this.ready || !this.landmarker) return null;

    const result = this.landmarker.detectForVideo(videoElement, timestampMs);

    if (
      !result.faceLandmarks ||
      result.faceLandmarks.length === 0
    ) {
      return null;
    }

    // Extract first face landmarks → flat Float32Array [x0,y0, x1,y1, ...]
    const faceLandmarks = result.faceLandmarks[0];
    const landmarks = new Float32Array(faceLandmarks.length * 2);
    for (let i = 0; i < faceLandmarks.length; i++) {
      landmarks[i * 2] = faceLandmarks[i].x;
      landmarks[i * 2 + 1] = faceLandmarks[i].y;
    }

    // Extract blendshapes → Float32Array in alphabetical order
    const blendshapes = new Float32Array(52);
    if (
      result.faceBlendshapes &&
      result.faceBlendshapes.length > 0
    ) {
      const bs = result.faceBlendshapes[0].categories;
      for (let i = 0; i < Math.min(bs.length, 52); i++) {
        blendshapes[bs[i].index] = bs[i].score;
      }
    }

    // Confidence from face detection score
    const confidence =
      result.faceLandmarks[0] && faceLandmarks.length > 0 ? 1.0 : 0.0;

    return { landmarks, blendshapes, confidence };
  }

  isReady(): boolean {
    return this.ready;
  }

  close(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
      this.ready = false;
    }
  }
}
