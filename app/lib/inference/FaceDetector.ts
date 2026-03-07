/**
 * FaceDetector — extracts face ROI from YOLO person bounding box or from
 * the center of the frame (face-only mode).
 *
 * Instead of running a separate face detection model, we use the top ~35%
 * of the YOLO person bbox as the face region. In face-only mode, we crop
 * the center ~40% of the frame. This avoids loading an extra model.
 */

export interface FaceROI {
  /** Face crop as ImageData (resized to target dimensions). */
  imageData: ImageData;
  /** Face bounding box in original image space [x, y, w, h]. */
  bbox: number[];
}

export class FaceDetector {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  /** Reusable source canvas to avoid allocations every frame. */
  private srcCanvas: OffscreenCanvas;
  private srcCtx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.canvas = new OffscreenCanvas(128, 128);
    this.ctx = this.canvas.getContext("2d")!;
    this.srcCanvas = new OffscreenCanvas(320, 240);
    this.srcCtx = this.srcCanvas.getContext("2d")!;
  }

  /** Resize the cached srcCanvas only when dimensions change. */
  private ensureSrcCanvas(w: number, h: number): void {
    if (this.srcCanvas.width !== w || this.srcCanvas.height !== h) {
      this.srcCanvas.width = w;
      this.srcCanvas.height = h;
    }
  }

  /**
   * Extract face ROI from the person bounding box.
   *
   * @param frame Full video frame as ImageData
   * @param personBbox Person bounding box [cx, cy, w, h] from YOLO
   * @param headRatio Top portion of bbox to use as face (default 0.35)
   * @returns FaceROI or null if bbox is too small
   */
  extractFaceROI(
    frame: ImageData,
    personBbox: number[],
    headRatio: number = 0.35,
  ): FaceROI | null {
    const [cx, cy, w, h] = personBbox;

    // Face region: top portion of the person bbox
    const faceH = h * headRatio;
    const faceW = Math.min(w, faceH * 1.2); // Face is roughly as wide as tall
    const faceX = cx - faceW / 2;
    const faceY = cy - h / 2; // Top of person bbox

    // Validate and clamp bounds
    if (faceW < 20 || faceH < 20) return null; // Too small
    const clampX = Math.max(0, faceX);
    const clampY = Math.max(0, faceY);
    const clampW = Math.min(faceW, frame.width - clampX);
    const clampH = Math.min(faceH, frame.height - clampY);
    if (clampW < 10 || clampH < 10) return null;

    // Draw the source frame onto the cached canvas, then extract the face crop
    this.ensureSrcCanvas(frame.width, frame.height);
    this.srcCtx.putImageData(frame, 0, 0);

    // Resize face crop to 128x128 for landmark detection
    this.canvas.width = 128;
    this.canvas.height = 128;
    this.ctx.drawImage(
      this.srcCanvas,
      clampX, clampY, clampW, clampH,
      0, 0, 128, 128,
    );

    const faceImageData = this.ctx.getImageData(0, 0, 128, 128);

    return {
      imageData: faceImageData,
      bbox: [clampX + clampW / 2, clampY + clampH / 2, clampW, clampH],
    };
  }

  /**
   * Extract face ROI from the center of the frame (face-only mode).
   * No YOLO person bbox needed — assumes face is roughly centered.
   *
   * @param frame Full video frame as ImageData
   * @param ratio Fraction of frame to crop (default 0.4)
   * @returns FaceROI or null if frame is too small
   */
  extractFaceFromFrame(
    frame: ImageData,
    ratio: number = 0.4,
  ): FaceROI | null {
    const faceW = frame.width * ratio;
    const faceH = frame.height * ratio;
    // Slightly above center — faces tend to be in the upper half
    const faceX = Math.max(0, (frame.width - faceW) / 2);
    const faceY = Math.max(0, (frame.height - faceH) / 2 - frame.height * 0.05);

    if (faceW < 20 || faceH < 20) return null;

    const clampedW = Math.min(faceW, frame.width - faceX);
    const clampedH = Math.min(faceH, frame.height - faceY);

    this.ensureSrcCanvas(frame.width, frame.height);
    this.srcCtx.putImageData(frame, 0, 0);

    this.canvas.width = 128;
    this.canvas.height = 128;
    this.ctx.drawImage(
      this.srcCanvas,
      faceX, faceY, clampedW, clampedH,
      0, 0, 128, 128,
    );

    const faceImageData = this.ctx.getImageData(0, 0, 128, 128);

    return {
      imageData: faceImageData,
      bbox: [faceX + clampedW / 2, faceY + clampedH / 2, clampedW, clampedH],
    };
  }

  /**
   * Extract a 64x64 grayscale face crop for FER+ model.
   *
   * @param faceROI Face region from extractFaceROI
   * @returns 64x64 grayscale Float32Array normalized to [0, 1], or null
   */
  extractGrayscaleCrop(faceROI: FaceROI): Float32Array | null {
    // Resize to 64x64
    this.canvas.width = 64;
    this.canvas.height = 64;

    this.ensureSrcCanvas(faceROI.imageData.width, faceROI.imageData.height);
    this.srcCtx.putImageData(faceROI.imageData, 0, 0);

    this.ctx.drawImage(this.srcCanvas, 0, 0, 64, 64);
    const pixels = this.ctx.getImageData(0, 0, 64, 64).data;

    // Convert to grayscale and normalize
    const gray = new Float32Array(64 * 64);
    for (let i = 0; i < 64 * 64; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    }

    return gray;
  }
}
