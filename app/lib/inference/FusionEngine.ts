/**
 * FusionEngine — combines body pose logits and face logits into
 * a unified ASD risk assessment.
 *
 * Phase 1: Rule-based weighted averaging (no model needed).
 * Phase 2: Learned linear fusion via ONNX model (~200 params).
 */

import type { FaceTcnResult } from "./FaceTcnEngine";
import type { TcnResult } from "./TcnEngine";

export interface FusionResult {
  /** Overall ASD risk score (0-1). */
  asdRisk: number;
  /** Body-modality ASD risk (0-1). */
  bodyRisk: number;
  /** Face-modality ASD risk (0-1). */
  faceRisk: number;
  /** Fusion confidence (0-1). 1.0 when both modalities available. */
  confidence: number;
}

export class FusionEngine {
  private bodyWeight: number;
  private faceWeight: number;

  constructor(bodyWeight: number = 0.7, faceWeight: number = 0.3) {
    this.bodyWeight = bodyWeight;
    this.faceWeight = faceWeight;
  }

  /**
   * Fuse body and face classification results.
   *
   * @param bodyResult Body TCN classification (6-class), or null
   * @param faceResult Face TCN classification (4-class), or null
   * @returns FusionResult with combined ASD risk
   */
  fuse(
    bodyResult: TcnResult | null,
    faceResult: FaceTcnResult | null,
  ): FusionResult | null {
    if (!bodyResult) return null;

    // Body risk: 1 - P(non_autistic)
    const bodyRisk = 1.0 - bodyResult.probabilities[5];

    if (faceResult) {
      // Face risk: P(flat_affect) + P(atypical_expression) + P(gaze_avoidance)
      const faceRisk = Math.min(
        faceResult.probabilities[1] +
        faceResult.probabilities[2] +
        faceResult.probabilities[3],
        1.0,
      );

      const asdRisk = Math.max(
        0,
        Math.min(
          1,
          this.bodyWeight * bodyRisk + this.faceWeight * faceRisk,
        ),
      );

      return {
        asdRisk,
        bodyRisk: Math.max(0, Math.min(1, bodyRisk)),
        faceRisk: Math.max(0, Math.min(1, faceRisk)),
        confidence: 1.0,
      };
    }

    // Body only
    return {
      asdRisk: Math.max(0, Math.min(1, bodyRisk)),
      bodyRisk: Math.max(0, Math.min(1, bodyRisk)),
      faceRisk: 0,
      confidence: 0.7,
    };
  }

  /**
   * Compute ASD risk from face-only analysis (no body pipeline).
   *
   * @param faceResult Face TCN classification (4-class)
   * @returns FusionResult with face-only risk
   */
  fuseFaceOnly(faceResult: FaceTcnResult | null): FusionResult | null {
    if (!faceResult) return null;

    // Face risk: P(flat_affect) + P(atypical_expression) + P(gaze_avoidance)
    const faceRisk = Math.min(
      faceResult.probabilities[1] +
      faceResult.probabilities[2] +
      faceResult.probabilities[3],
      1.0,
    );

    return {
      asdRisk: Math.max(0, Math.min(1, faceRisk)),
      bodyRisk: 0,
      faceRisk: Math.max(0, Math.min(1, faceRisk)),
      confidence: 0.5, // lower confidence without body modality
    };
  }
}
