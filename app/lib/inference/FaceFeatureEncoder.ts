/**
 * FaceFeatureEncoder — TypeScript port of the Python face feature encoder.
 *
 * Transforms FER+ emotion probabilities, MediaPipe blendshapes, and
 * gaze features into a 64-dimensional feature vector per frame.
 *
 * MUST produce identical outputs to the Python version.
 */

// ── Blendshape indices (MediaPipe Face Landmarker, alphabetical order) ──
const BS_browDownLeft = 0;
const BS_browDownRight = 1;
const BS_browInnerUp = 2;
const BS_browOuterUpLeft = 3;
const BS_browOuterUpRight = 4;
const BS_cheekSquintLeft = 6;
const BS_cheekSquintRight = 7;
const BS_eyeBlinkLeft = 8;
const BS_eyeBlinkRight = 9;
const BS_eyeSquintLeft = 18;
const BS_eyeSquintRight = 19;
const BS_jawLeft = 23;
const BS_jawOpen = 24;
const BS_jawRight = 25;
const BS_mouthPucker = 37;
const BS_mouthSmileLeft = 43;
const BS_mouthSmileRight = 44;

// ── MediaPipe landmark indices ──
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const LEFT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const LEFT_IRIS_CENTER = 468;
const RIGHT_IRIS_CENTER = 473;
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_MOUTH_CORNER = 61;
const RIGHT_MOUTH_CORNER = 291;
const LEFT_BROW_INNER = 107;
const RIGHT_BROW_INNER = 336;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const UPPER_LIP_TOP = 13;
const LOWER_LIP_BOTTOM = 14;

const TOTAL_FACE_DIM = 64;

function dist2d(a: number[], b: number[]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export class FaceFeatureEncoder {
  private prevStaticFeatures: Float32Array | null = null;

  reset(): void {
    this.prevStaticFeatures = null;
  }

  /**
   * Encode one frame's facial data into a 64-dim feature vector.
   *
   * @param emotions 8 FER+ emotion probabilities
   * @param blendshapes 52 MediaPipe blendshape scores
   * @param landmarks 478 landmarks as flat [x0,y0, x1,y1, ...] (956 values)
   * @param faceConfidence face detection confidence [0, 1]
   * @returns 64-dim face feature vector
   */
  encodeFrame(
    emotions: Float32Array,
    blendshapes: Float32Array,
    landmarks: Float32Array,
    faceConfidence: number = 1.0,
  ): Float32Array {
    const features = new Float32Array(TOTAL_FACE_DIM);

    // Helper: get landmark [x, y] at index
    const lm = (idx: number): number[] => [landmarks[idx * 2], landmarks[idx * 2 + 1]];

    // ── Dims 0-7: Emotions (8) ──
    for (let i = 0; i < 8; i++) features[i] = emotions[i];

    // ── Dims 8-15: Key AUs (8) ──
    features[8] = blendshapes[BS_browInnerUp];  // AU1
    features[9] = (blendshapes[BS_browOuterUpLeft] + blendshapes[BS_browOuterUpRight]) / 2;  // AU2
    features[10] = (blendshapes[BS_browDownLeft] + blendshapes[BS_browDownRight]) / 2;  // AU4
    features[11] = (blendshapes[BS_cheekSquintLeft] + blendshapes[BS_cheekSquintRight]) / 2;  // AU6
    features[12] = (blendshapes[BS_mouthSmileLeft] + blendshapes[BS_mouthSmileRight]) / 2;  // AU12
    features[13] = blendshapes[BS_jawOpen];  // AU25/26
    features[14] = (blendshapes[BS_eyeSquintLeft] + blendshapes[BS_eyeSquintRight]) / 2;  // AU7
    features[15] = (blendshapes[BS_eyeBlinkLeft] + blendshapes[BS_eyeBlinkRight]) / 2;  // AU45

    // ── Dims 16-19: Gaze features (4) ──
    const leftEyeCenter = [(lm(LEFT_EYE_INNER)[0] + lm(LEFT_EYE_OUTER)[0]) / 2,
                           (lm(LEFT_EYE_INNER)[1] + lm(LEFT_EYE_OUTER)[1]) / 2];
    const leftEyeW = dist2d(lm(LEFT_EYE_OUTER), lm(LEFT_EYE_INNER)) + 1e-8;
    const leftEyeH = dist2d(lm(LEFT_EYE_TOP), lm(LEFT_EYE_BOTTOM)) + 1e-8;
    const leftIris = lm(LEFT_IRIS_CENTER);

    const rightEyeCenter = [(lm(RIGHT_EYE_INNER)[0] + lm(RIGHT_EYE_OUTER)[0]) / 2,
                            (lm(RIGHT_EYE_INNER)[1] + lm(RIGHT_EYE_OUTER)[1]) / 2];
    const rightEyeW = dist2d(lm(RIGHT_EYE_OUTER), lm(RIGHT_EYE_INNER)) + 1e-8;
    const rightIris = lm(RIGHT_IRIS_CENTER);

    const leftHOff = (leftIris[0] - leftEyeCenter[0]) / leftEyeW;
    const rightHOff = (rightIris[0] - rightEyeCenter[0]) / rightEyeW;
    features[16] = (leftHOff + rightHOff) / 2;  // Horizontal gaze

    const leftVOff = (leftIris[1] - leftEyeCenter[1]) / leftEyeH;
    const rightVOff = (rightIris[1] - rightEyeCenter[1]) / leftEyeH;
    features[17] = (leftVOff + rightVOff) / 2;  // Vertical gaze

    features[18] = Math.sqrt(features[16] ** 2 + features[17] ** 2);  // Deviation
    features[19] = 1.0 - Math.abs(leftHOff - rightHOff);  // Convergence

    // ── Dims 20-23: Symmetry features (4) ──
    const nose = lm(NOSE_TIP);
    const faceHeight = dist2d(lm(FOREHEAD), lm(CHIN)) + 1e-8;
    features[20] = Math.abs(lm(LEFT_MOUTH_CORNER)[1] - lm(RIGHT_MOUTH_CORNER)[1]) / faceHeight;
    features[21] = Math.abs(lm(LEFT_BROW_INNER)[1] - lm(RIGHT_BROW_INNER)[1]) / faceHeight;
    const leftCheekDist = dist2d(lm(LEFT_CHEEK), nose);
    const rightCheekDist = dist2d(lm(RIGHT_CHEEK), nose);
    features[22] = Math.abs(leftCheekDist - rightCheekDist) / (leftCheekDist + rightCheekDist + 1e-8);
    features[23] = 1.0 - (features[20] + features[21] + features[22]) / 3.0;

    // ── Dims 24-27: Mouth features (4) ──
    const mouthH = dist2d(lm(UPPER_LIP_TOP), lm(LOWER_LIP_BOTTOM));
    const mouthW = dist2d(lm(LEFT_MOUTH_CORNER), lm(RIGHT_MOUTH_CORNER)) + 1e-8;
    features[24] = mouthH / mouthW;  // Openness
    features[25] = blendshapes[BS_mouthPucker];  // Lip pursing
    features[26] = blendshapes[BS_jawLeft] - blendshapes[BS_jawRight];  // Jaw deviation
    const faceW = dist2d(lm(LEFT_CHEEK), lm(RIGHT_CHEEK)) + 1e-8;
    features[27] = mouthW / faceW;  // Mouth width ratio

    // ── Dims 28-31: Brow features (4) ──
    features[28] = (blendshapes[BS_browInnerUp] + blendshapes[BS_browOuterUpLeft] + blendshapes[BS_browOuterUpRight]) / 3;
    features[29] = Math.abs(blendshapes[BS_browDownLeft] - blendshapes[BS_browDownRight]);
    features[30] = blendshapes[BS_browInnerUp];
    features[31] = (blendshapes[BS_browDownLeft] + blendshapes[BS_browDownRight]) / 2;

    // ── Dims 32-51: Velocity features (20) ──
    const staticFeatures = features.slice(0, 32);
    if (this.prevStaticFeatures) {
      for (let i = 0; i < 20; i++) {
        features[32 + i] = staticFeatures[i] - this.prevStaticFeatures[i];
      }
    }
    // else: zeros (already initialized)

    this.prevStaticFeatures = new Float32Array(staticFeatures);

    // ── Dims 52-55: Eye features (4) ──
    const leftEAR = dist2d(lm(LEFT_EYE_TOP), lm(LEFT_EYE_BOTTOM)) / (dist2d(lm(LEFT_EYE_OUTER), lm(LEFT_EYE_INNER)) + 1e-8);
    const rightEAR = dist2d(lm(RIGHT_EYE_TOP), lm(RIGHT_EYE_BOTTOM)) / (dist2d(lm(RIGHT_EYE_OUTER), lm(RIGHT_EYE_INNER)) + 1e-8);
    features[52] = leftEAR;
    features[53] = rightEAR;
    features[54] = Math.abs(leftEAR - rightEAR);
    features[55] = (blendshapes[BS_eyeBlinkLeft] + blendshapes[BS_eyeBlinkRight]) / 2;

    // ── Dims 56-63: Composite metrics (8) ──
    const eps = 1e-8;
    let entropy = 0;
    for (let i = 0; i < 8; i++) {
      const p = Math.max(emotions[i], eps);
      entropy -= p * Math.log(p);
    }
    features[56] = entropy / Math.log(8);  // Normalized entropy

    let auSum = 0;
    for (let i = 8; i < 16; i++) auSum += features[i];
    features[57] = auSum / 8;  // Expressivity

    features[58] = 1.0 / (features[18] + 0.1);  // Gaze stability

    features[59] = 0.5;  // Face-body sync placeholder

    // Affect flatness: neutral - max(other emotions)
    let maxOther = 0;
    for (let i = 1; i < 8; i++) {
      if (emotions[i] > maxOther) maxOther = emotions[i];
    }
    features[60] = emotions[0] - maxOther;

    // Valence proxy
    features[61] = (emotions[1] + emotions[2]) - (emotions[3] + emotions[4]);

    // Arousal proxy
    features[62] = auSum / 8;

    // Face confidence
    features[63] = faceConfidence;

    return features;
  }
}
