/**
 * Client-side report generation for the FOSS build.
 *
 * Mirrors the Bedrock-unavailable template fallbacks in the server routes:
 *   - buildTemplateSummary()  <- app/api/report/summary/route.ts
 *   - buildTemplateReport()   <- app/api/report/clinical/route.ts
 * The FOSS / static-export build has no server routes, so it generates the same
 * template output on the client. Kept byte-identical to the server copies —
 * update both if either changes. Only used when IS_FOSS_BUILD.
 */
import type { BiomarkerAggregate } from "../../types/biomarker";

export interface ClinicalResponse {
  report: string;
  sections: {
    criterionA: string;
    criterionB: string;
    motor: string;
    recommendations: string;
  };
}

export function buildTemplateSummary(biomarkers: BiomarkerAggregate): string {
  const risk = biomarkers.overallScore < 50 ? "elevated" : "low";
  return [
    `Based on the screening session (${biomarkers.sampleCount} data points collected), your child's overall developmental score is ${biomarkers.overallScore}/100. This places them in the ${risk}-risk category for further evaluation.`,
    `In the area of social communication, your child scored ${(biomarkers.avgGazeScore * 100).toFixed(0)}% on gaze tracking and ${(biomarkers.avgVocalizationScore * 100).toFixed(0)}% on vocalization quality. ${biomarkers.flags.socialCommunication ? "These scores suggest some differences in social communication patterns that align with DSM-5 Criterion A indicators. This does not mean a diagnosis, but it does suggest a conversation with your pediatrician would be beneficial." : "These scores are within the typical developmental range for social communication, which is encouraging."}`,
    `Motor coordination was measured at ${(biomarkers.avgMotorScore * 100).toFixed(0)}%. ${biomarkers.flags.restrictedBehavior ? "Some patterns in motor behavior were observed that may correspond to restricted or repetitive behaviors described in DSM-5 Criterion B. A specialist can help determine whether these patterns are developmentally significant." : "Motor patterns appear typical for this developmental stage."}${biomarkers.dominantBodyBehavior ? ` The most frequently observed body behavior was "${biomarkers.dominantBodyBehavior.replace(/_/g, " ")}".` : ""}`,
    `We recommend sharing this summary with your child's pediatrician or a developmental specialist. This screening is not a diagnosis -- it is a starting point for a conversation about your child's unique developmental profile. Early identification and support can make a meaningful difference in a child's developmental trajectory.`,
  ].join("\n\n");
}

export function buildTemplateReport(
  biomarkers: BiomarkerAggregate,
  childAge?: number,
): ClinicalResponse {
  const ageStr = childAge
    ? `${Math.floor(childAge / 12)} years and ${childAge % 12} months`
    : "age not specified";

  const criterionA = `CRITERION A -- SOCIAL COMMUNICATION & INTERACTION

The child (${ageStr}) was assessed across multiple social communication domains during this screening session.

Gaze Tracking & Joint Attention:
The child demonstrated a gaze consistency score of ${(biomarkers.avgGazeScore * 100).toFixed(1)}%. ${biomarkers.avgGazeScore < 0.4 ? "This score falls below the typical developmental threshold (40%), suggesting potential differences in social visual engagement. Reduced gaze consistency may indicate difficulties with joint attention, a core feature of DSM-5 Criterion A.1 (deficits in social-emotional reciprocity) and A.3 (deficits in developing, maintaining, and understanding relationships)." : "This score is within the typical range, suggesting age-appropriate social visual engagement patterns."}

Vocalization & Communication:
Vocalization quality was measured at ${(biomarkers.avgVocalizationScore * 100).toFixed(1)}%. ${biomarkers.avgVocalizationScore < 0.35 ? "This is below the developmental threshold, which may reflect differences in verbal and nonverbal communicative behaviors as described in Criterion A.2." : "This falls within normal parameters for the assessed age range."}${biomarkers.dominantFaceBehavior ? `\n\nFacial Affect Analysis:\nThe dominant facial expression pattern observed was "${biomarkers.dominantFaceBehavior.replace(/_/g, " ")}". ${biomarkers.dominantFaceBehavior === "flat_affect" ? "A predominantly flat affect may be associated with reduced social-emotional reciprocity." : biomarkers.dominantFaceBehavior === "gaze_avoidance" ? "Gaze avoidance patterns were noted, which may be relevant to Criterion A.1 assessment." : "This pattern is noted for clinical context."}` : ""}

Social Communication Flag: ${biomarkers.flags.socialCommunication ? "FLAGGED -- scores indicate potential differences warranting specialist evaluation." : "Within typical range."}`;

  const criterionB = `CRITERION B -- RESTRICTED & REPETITIVE BEHAVIOURS

Motor Pattern Assessment:
Motor coordination scored ${(biomarkers.avgMotorScore * 100).toFixed(1)}%. ${biomarkers.avgMotorScore < 0.35 ? "This is below the typical threshold, which may indicate differences in motor planning or the presence of stereotyped motor movements as described in Criterion B.1." : "Motor coordination appears within the typical developmental range."}${biomarkers.avgResponseLatencyMs !== null ? `\n\nResponse Latency:\nAverage response latency was ${biomarkers.avgResponseLatencyMs}ms. ${biomarkers.avgResponseLatencyMs > 3000 ? "Extended response latency (>3000ms) may suggest insistence on sameness or inflexible adherence to routines (Criterion B.2), though this requires clinical interpretation." : "This is within the expected range."}` : ""}${biomarkers.dominantBodyBehavior ? `\n\nBehavior Classification (Computer-Assisted):\nThe predominant body behavior pattern detected during video analysis was "${biomarkers.dominantBodyBehavior.replace(/_/g, " ")}". ${["hand_flapping", "body_rocking", "spinning"].includes(biomarkers.dominantBodyBehavior) ? "This behavior pattern aligns with stereotyped or repetitive motor movements described in Criterion B.1." : biomarkers.dominantBodyBehavior === "toe_walking" ? "Toe walking may be associated with sensory processing differences described in Criterion B.4 (hyper- or hyporeactivity to sensory input)." : "This pattern is noted for clinical context."}` : ""}${biomarkers.behaviorClassDistribution ? `\n\nBehavior Distribution:\n${Object.entries(biomarkers.behaviorClassDistribution).map(([cls, count]) => `  - ${cls.replace(/_/g, " ")}: ${count} observations`).join("\n")}` : ""}

Restricted Behavior Flag: ${biomarkers.flags.restrictedBehavior ? "FLAGGED -- patterns suggest potential restricted or repetitive behaviors warranting further assessment." : "Within typical range."}`;

  const motor = `MOTOR DEVELOPMENT ASSESSMENT

Overall motor coordination score: ${(biomarkers.avgMotorScore * 100).toFixed(1)}%
${biomarkers.avgMotorScore < 0.5 ? "Below-average motor coordination was observed. Motor differences are commonly co-occurring with autism spectrum conditions and may benefit from occupational therapy assessment." : "Motor coordination appears age-appropriate based on the screening tasks administered."}

${biomarkers.dominantBodyBehavior && biomarkers.dominantBodyBehavior !== "non_autistic" ? `Notable motor pattern: "${biomarkers.dominantBodyBehavior.replace(/_/g, " ")}" was the most frequently observed body behavior during the video analysis component.` : "No atypical motor patterns were prominently detected during the video analysis component."}

Note: This motor assessment is based on computer-assisted behavioral observation and should be supplemented with a formal motor development evaluation (e.g., Movement ABC-2 or BOT-2) by a qualified occupational therapist.`;

  const recommendations = `RECOMMENDATIONS

Overall Screening Score: ${biomarkers.overallScore}/100
${biomarkers.avgAsdRisk !== undefined ? `AI-Estimated ASD Risk: ${(biomarkers.avgAsdRisk * 100).toFixed(1)}%` : ""}

Based on this screening:

${biomarkers.flags.socialCommunication || biomarkers.flags.restrictedBehavior ? `1. REFERRAL RECOMMENDED: This screening identified potential indicators in ${[biomarkers.flags.socialCommunication ? "social communication (Criterion A)" : "", biomarkers.flags.restrictedBehavior ? "restricted/repetitive behaviors (Criterion B)" : ""].filter(Boolean).join(" and ")}. We recommend a comprehensive developmental evaluation by:
   - A developmental pediatrician
   - A clinical psychologist specializing in autism assessment
   - A multidisciplinary team using standardized diagnostic instruments (ADOS-2, ADI-R)

2. EARLY INTERVENTION: Regardless of diagnostic outcome, early intervention services may support your child's development:
   - Speech-language therapy (if communication differences noted)
   - Occupational therapy (for motor and sensory processing support)
   - Applied behavior analysis (ABA) or naturalistic developmental behavioral interventions (NDBI)

3. MONITORING: Continue monitoring developmental milestones and repeat screening in 3-6 months to track progress.` : `1. CONTINUE MONITORING: Current screening scores are within the typical range. Continue monitoring developmental milestones at regular pediatric visits.

2. RESCREEN: Consider repeating this screening in 6-12 months or if new concerns arise.

3. WELL-CHILD VISITS: Maintain regular pediatric check-ups and discuss any emerging concerns with your child's doctor.`}

IMPORTANT DISCLAIMER: This report is generated by a computer-assisted screening tool and is NOT a clinical diagnosis. Autism spectrum disorder can only be diagnosed by qualified healthcare professionals through comprehensive evaluation. This screening is intended to support -- not replace -- clinical judgment.`;

  const report = [criterionA, criterionB, motor, recommendations].join(
    "\n\n---\n\n",
  );

  return { report, sections: { criterionA, criterionB, motor, recommendations } };
}
