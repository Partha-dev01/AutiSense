/**
 * Biomarker sanitization for LLM prompt safety.
 *
 * Strips unknown fields and validates types/ranges before biomarker data
 * is interpolated into Bedrock prompts. Prevents prompt injection via
 * malicious string fields (e.g. dominantBodyBehavior containing override
 * instructions).
 */

const BODY_BEHAVIOR_CLASSES = [
  "hand_flapping", "body_rocking", "head_banging",
  "spinning", "toe_walking", "non_autistic",
] as const;

const FACE_BEHAVIOR_CLASSES = [
  "typical_expression", "flat_affect",
  "atypical_expression", "gaze_avoidance",
] as const;

function clampScore(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function clampPositive(v: unknown, fallback: number | null): number | null {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

function sanitizeEnum(v: unknown, allowed: readonly string[], fallback: string): string {
  if (typeof v !== "string") return fallback;
  return allowed.includes(v) ? v : fallback;
}

/**
 * Sanitize a BiomarkerAggregate object for safe LLM prompt interpolation.
 * Returns a clean object with only known fields, validated types and ranges.
 */
export function sanitizeBiomarkers(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") {
    return { error: "invalid_biomarker_data" };
  }

  const b = raw as Record<string, unknown>;

  const clean: Record<string, unknown> = {
    sessionId: typeof b.sessionId === "string" ? b.sessionId.slice(0, 100) : "",
    avgGazeScore: clampScore(b.avgGazeScore),
    avgMotorScore: clampScore(b.avgMotorScore),
    avgVocalizationScore: clampScore(b.avgVocalizationScore),
    avgResponseLatencyMs: clampPositive(b.avgResponseLatencyMs, null),
    sampleCount: Math.max(0, Math.min(10000, Number(b.sampleCount) || 0)),
    overallScore: clampScore(b.overallScore),
    flags: {
      socialCommunication: b.flags && typeof b.flags === "object" ? Boolean((b.flags as Record<string, unknown>).socialCommunication) : false,
      restrictedBehavior: b.flags && typeof b.flags === "object" ? Boolean((b.flags as Record<string, unknown>).restrictedBehavior) : false,
    },
  };

  // Optional extended fields — validate strictly
  if (b.avgAsdRisk !== undefined) {
    clean.avgAsdRisk = clampScore(b.avgAsdRisk);
  }
  if (b.dominantBodyBehavior !== undefined) {
    clean.dominantBodyBehavior = sanitizeEnum(b.dominantBodyBehavior, BODY_BEHAVIOR_CLASSES, "non_autistic");
  }
  if (b.dominantFaceBehavior !== undefined) {
    clean.dominantFaceBehavior = sanitizeEnum(b.dominantFaceBehavior, FACE_BEHAVIOR_CLASSES, "typical_expression");
  }
  if (b.behaviorClassDistribution !== undefined && typeof b.behaviorClassDistribution === "object" && b.behaviorClassDistribution !== null) {
    const dist: Record<string, number> = {};
    for (const cls of BODY_BEHAVIOR_CLASSES) {
      const val = (b.behaviorClassDistribution as Record<string, unknown>)[cls];
      if (val !== undefined) dist[cls] = clampScore(val);
    }
    clean.behaviorClassDistribution = dist;
  }

  return clean;
}
