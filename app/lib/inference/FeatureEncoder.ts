/**
 * FeatureEncoder — numerically-identical TypeScript port of feature_encoder.py.
 *
 * Converts 17 COCO keypoints into an 86-dimensional feature vector per frame.
 *
 * Feature layout (86 dims total):
 *   [0..33]  Normalized keypoint coordinates (17 x 2)
 *   [34..67] Velocity vectors (34)
 *   [68..77] Joint angles (10), each divided by PI
 *   [78..85] Limb distances (8)
 */

// ── COCO 17 keypoint indices ────────────────────────────────────────
const NOSE = 0;
// LEFT_EYE = 1, RIGHT_EYE = 2 (not directly referenced)
const LEFT_EAR = 3;
const RIGHT_EAR = 4;
const LEFT_SHOULDER = 5;
const RIGHT_SHOULDER = 6;
const LEFT_ELBOW = 7;
const RIGHT_ELBOW = 8;
const LEFT_WRIST = 9;
const RIGHT_WRIST = 10;
const LEFT_HIP = 11;
const RIGHT_HIP = 12;
const LEFT_KNEE = 13;
const RIGHT_KNEE = 14;
const LEFT_ANKLE = 15;
const RIGHT_ANKLE = 16;

const NUM_KEYPOINTS = 17;
const NUM_FEATURES = 86;
/** Minimum confidence to keep a keypoint (match Python confidence_threshold=0.3). */
const CONFIDENCE_THRESHOLD = 0.3;

/**
 * Computes the angle at vertex **b** between rays b->a and b->c.
 *
 * @returns angle in radians [0, PI].
 */
function computeAngle(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
): number {
  const bax = ax - bx;
  const bay = ay - by;
  const bcx = cx - bx;
  const bcy = cy - by;

  const dot = bax * bcx + bay * bcy;
  const magBA = Math.sqrt(bax * bax + bay * bay);
  const magBC = Math.sqrt(bcx * bcx + bcy * bcy);

  const cosine = dot / (magBA * magBC + 1e-8);
  // Clamp to [-1, 1] to avoid NaN from floating-point imprecision.
  const clamped = Math.max(-1, Math.min(1, cosine));
  return Math.acos(clamped);
}

/**
 * Encodes raw COCO keypoints into an 86-dim feature vector suitable for
 * the Pose-TCN classifier.
 *
 * **Important**: this class is stateful — it retains the previous frame's
 * normalized keypoints to compute velocities. Call `reset()` when starting
 * a new sequence.
 */
export class FeatureEncoder {
  /**
   * Previous frame's normalized keypoint coordinates (34-dim, i.e. 17 x 2).
   * `null` until the first frame has been processed.
   */
  private prevNormalized: Float32Array | null = null;

  /**
   * Encode a single frame's keypoints into an 86-dim feature vector.
   *
   * @param keypoints  Flat Float32Array of length 34 (17 keypoints x 2 [x, y]).
   * @param confidence Float32Array of length 17 (per-keypoint confidence).
   * @returns          Float32Array of length 86.
   */
  encodeFrame(keypoints: Float32Array, confidence: Float32Array): Float32Array {
    const out = new Float32Array(NUM_FEATURES);

    // ── 0. Confidence masking (match Python feature_encoder.py lines 218-221)
    // Zero out keypoints with confidence below threshold BEFORE normalization.
    const maskedKps = new Float32Array(keypoints.length);
    for (let i = 0; i < NUM_KEYPOINTS; i++) {
      if (confidence[i] >= CONFIDENCE_THRESHOLD) {
        maskedKps[i * 2] = keypoints[i * 2];
        maskedKps[i * 2 + 1] = keypoints[i * 2 + 1];
      }
      // else: remains 0.0 (Float32Array default) — matches Python kps[mask] = 0.0
    }

    // ── 1. Normalized keypoint coordinates (dims 0-33) ──────────
    const normalized = this.normalizeSkeleton(maskedKps);
    out.set(normalized, 0);

    // ── 2. Velocity vectors (dims 34-67) ────────────────────────
    const velocity = this.computeVelocities(normalized);
    out.set(velocity, 34);

    // ── 3. Joint angles (dims 68-77) ────────────────────────────
    const angles = this.computeJointAngles(normalized);
    out.set(angles, 68);

    // ── 4. Limb distances (dims 78-85) ──────────────────────────
    const distances = this.computeLimbDistances(normalized);
    out.set(distances, 78);

    // Update state for next frame.
    this.prevNormalized = normalized;

    return out;
  }

  /** Clear internal state so the next frame is treated as frame 0. */
  reset(): void {
    this.prevNormalized = null;
  }

  // ────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────

  /**
   * Normalise keypoints by hip-center and shoulder-hip scale.
   *
   * Center = midpoint of left_hip (11) and right_hip (12).
   * Scale  = ||shoulder_mid - hip_mid||, fallback to 1.0 if near-zero.
   *
   * @returns Float32Array of length 34 (17 x 2).
   */
  private normalizeSkeleton(kps: Float32Array): Float32Array {
    const result = new Float32Array(NUM_KEYPOINTS * 2);

    // Hip center
    const hipCx = (kps[LEFT_HIP * 2] + kps[RIGHT_HIP * 2]) / 2;
    const hipCy = (kps[LEFT_HIP * 2 + 1] + kps[RIGHT_HIP * 2 + 1]) / 2;

    // Shoulder midpoint
    const shoulderMx = (kps[LEFT_SHOULDER * 2] + kps[RIGHT_SHOULDER * 2]) / 2;
    const shoulderMy = (kps[LEFT_SHOULDER * 2 + 1] + kps[RIGHT_SHOULDER * 2 + 1]) / 2;

    // Scale = ||shoulder_mid - hip_mid||, fallback to 1.0 (match Python)
    const dx = shoulderMx - hipCx;
    const dy = shoulderMy - hipCy;
    let scale = Math.sqrt(dx * dx + dy * dy);
    if (scale < 1e-6) scale = 1.0;

    for (let i = 0; i < NUM_KEYPOINTS; i++) {
      result[i * 2] = (kps[i * 2] - hipCx) / scale;
      result[i * 2 + 1] = (kps[i * 2 + 1] - hipCy) / scale;
    }

    return result;
  }

  /**
   * Compute velocity (delta between current and previous normalised keypoints).
   * First frame returns zeros.
   *
   * @returns Float32Array of length 34.
   */
  private computeVelocities(normalized: Float32Array): Float32Array {
    const velocity = new Float32Array(NUM_KEYPOINTS * 2);
    if (this.prevNormalized !== null) {
      for (let i = 0; i < NUM_KEYPOINTS * 2; i++) {
        velocity[i] = normalized[i] - this.prevNormalized[i];
      }
    }
    return velocity;
  }

  /**
   * Compute 10 joint angles, each divided by PI to normalise to [0, 1].
   *
   * Order:
   *   0: left_elbow   (shoulder5 -> elbow7  -> wrist9)
   *   1: right_elbow  (shoulder6 -> elbow8  -> wrist10)
   *   2: left_shoulder (elbow7   -> shoulder5 -> hip11)
   *   3: right_shoulder(elbow8   -> shoulder6 -> hip12)
   *   4: left_knee     (hip11    -> knee13  -> ankle15)
   *   5: right_knee    (hip12    -> knee14  -> ankle16)
   *   6: left_hip      (shoulder5 -> hip11  -> knee13)
   *   7: right_hip     (shoulder6 -> hip12  -> knee14)
   *   8: torso lean    (angle at hip_mid between shoulder_mid and hip_mid+[0,-1])
   *   9: head tilt     (angle at NOSE between ear_mid and shoulder_mid)
   *
   * @returns Float32Array of length 10.
   */
  private computeJointAngles(n: Float32Array): Float32Array {
    const angles = new Float32Array(10);
    /** Shorthand to get (x, y) of keypoint i from the normalized array. */
    const x = (i: number) => n[i * 2];
    const y = (i: number) => n[i * 2 + 1];

    // 0: left elbow
    angles[0] =
      computeAngle(
        x(LEFT_SHOULDER), y(LEFT_SHOULDER),
        x(LEFT_ELBOW), y(LEFT_ELBOW),
        x(LEFT_WRIST), y(LEFT_WRIST),
      ) / Math.PI;

    // 1: right elbow
    angles[1] =
      computeAngle(
        x(RIGHT_SHOULDER), y(RIGHT_SHOULDER),
        x(RIGHT_ELBOW), y(RIGHT_ELBOW),
        x(RIGHT_WRIST), y(RIGHT_WRIST),
      ) / Math.PI;

    // 2: left shoulder
    angles[2] =
      computeAngle(
        x(LEFT_ELBOW), y(LEFT_ELBOW),
        x(LEFT_SHOULDER), y(LEFT_SHOULDER),
        x(LEFT_HIP), y(LEFT_HIP),
      ) / Math.PI;

    // 3: right shoulder
    angles[3] =
      computeAngle(
        x(RIGHT_ELBOW), y(RIGHT_ELBOW),
        x(RIGHT_SHOULDER), y(RIGHT_SHOULDER),
        x(RIGHT_HIP), y(RIGHT_HIP),
      ) / Math.PI;

    // 4: left knee
    angles[4] =
      computeAngle(
        x(LEFT_HIP), y(LEFT_HIP),
        x(LEFT_KNEE), y(LEFT_KNEE),
        x(LEFT_ANKLE), y(LEFT_ANKLE),
      ) / Math.PI;

    // 5: right knee
    angles[5] =
      computeAngle(
        x(RIGHT_HIP), y(RIGHT_HIP),
        x(RIGHT_KNEE), y(RIGHT_KNEE),
        x(RIGHT_ANKLE), y(RIGHT_ANKLE),
      ) / Math.PI;

    // 6: left hip
    angles[6] =
      computeAngle(
        x(LEFT_SHOULDER), y(LEFT_SHOULDER),
        x(LEFT_HIP), y(LEFT_HIP),
        x(LEFT_KNEE), y(LEFT_KNEE),
      ) / Math.PI;

    // 7: right hip
    angles[7] =
      computeAngle(
        x(RIGHT_SHOULDER), y(RIGHT_SHOULDER),
        x(RIGHT_HIP), y(RIGHT_HIP),
        x(RIGHT_KNEE), y(RIGHT_KNEE),
      ) / Math.PI;

    // 8: torso lean — angle at hip_mid between shoulder_mid and (hip_mid + [0, -1])
    const hipMx = (x(LEFT_HIP) + x(RIGHT_HIP)) / 2;
    const hipMy = (y(LEFT_HIP) + y(RIGHT_HIP)) / 2;
    const shoulderMx = (x(LEFT_SHOULDER) + x(RIGHT_SHOULDER)) / 2;
    const shoulderMy = (y(LEFT_SHOULDER) + y(RIGHT_SHOULDER)) / 2;
    angles[8] =
      computeAngle(
        shoulderMx, shoulderMy,
        hipMx, hipMy,
        hipMx, hipMy - 1,
      ) / Math.PI;

    // 9: head tilt — angle at NOSE between ear_mid and shoulder_mid
    const earMx = (x(LEFT_EAR) + x(RIGHT_EAR)) / 2;
    const earMy = (y(LEFT_EAR) + y(RIGHT_EAR)) / 2;
    angles[9] =
      computeAngle(
        earMx, earMy,
        x(NOSE), y(NOSE),
        shoulderMx, shoulderMy,
      ) / Math.PI;

    return angles;
  }

  /**
   * Compute 8 limb / body-proportion distance features.
   *
   * Order:
   *   0: ||left_wrist  - left_shoulder||
   *   1: ||right_wrist - right_shoulder||
   *   2: left_shoulder[y]  - left_wrist[y]
   *   3: right_shoulder[y] - right_wrist[y]
   *   4: ||left_ankle - right_ankle|| / (||left_hip - right_hip|| + 1e-8)
   *   5: avg(ankles[y]) - avg(hips[y])
   *   6: ||left_wrist - right_wrist|| / (||left_shoulder - right_shoulder|| + 1e-8)
   *   7: avg(hips[y]) - nose[y]
   *
   * @returns Float32Array of length 8.
   */
  private computeLimbDistances(n: Float32Array): Float32Array {
    const d = new Float32Array(8);
    const x = (i: number) => n[i * 2];
    const y = (i: number) => n[i * 2 + 1];

    const dist = (i: number, j: number) => {
      const dx = x(i) - x(j);
      const dy = y(i) - y(j);
      return Math.sqrt(dx * dx + dy * dy);
    };

    // 0: ||left_wrist - left_shoulder||
    d[0] = dist(LEFT_WRIST, LEFT_SHOULDER);

    // 1: ||right_wrist - right_shoulder||
    d[1] = dist(RIGHT_WRIST, RIGHT_SHOULDER);

    // 2: left_shoulder[y] - left_wrist[y]
    d[2] = y(LEFT_SHOULDER) - y(LEFT_WRIST);

    // 3: right_shoulder[y] - right_wrist[y]
    d[3] = y(RIGHT_SHOULDER) - y(RIGHT_WRIST);

    // 4: ||left_ankle - right_ankle|| / (||left_hip - right_hip|| + 1e-8)
    d[4] = dist(LEFT_ANKLE, RIGHT_ANKLE) / (dist(LEFT_HIP, RIGHT_HIP) + 1e-8);

    // 5: avg(ankles[y]) - avg(hips[y])
    const avgAnkleY = (y(LEFT_ANKLE) + y(RIGHT_ANKLE)) / 2;
    const avgHipY = (y(LEFT_HIP) + y(RIGHT_HIP)) / 2;
    d[5] = avgAnkleY - avgHipY;

    // 6: ||left_wrist - right_wrist|| / (||left_shoulder - right_shoulder|| + 1e-8)
    d[6] = dist(LEFT_WRIST, RIGHT_WRIST) / (dist(LEFT_SHOULDER, RIGHT_SHOULDER) + 1e-8);

    // 7: avg(hips[y]) - nose[y]
    d[7] = avgHipY - y(NOSE);

    return d;
  }
}
