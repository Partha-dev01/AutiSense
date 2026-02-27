import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";
import type {
  Biomarker,
  BiomarkerAggregate,
  TaskId,
} from "../../types/biomarker";

//Create
export async function addBiomarker(
  sessionId: string,
  taskId: TaskId,
  reading: {
    gazeScore: number;
    motorScore: number;
    vocalizationScore: number;
    responseLatencyMs?: number | null;
  },
): Promise<void> {
  const userId = getCurrentUserId();

  await db.biomarkers.add({
    sessionId,
    userId,
    taskId,
    gazeScore: clamp(reading.gazeScore),
    motorScore: clamp(reading.motorScore),
    vocalizationScore: clamp(reading.vocalizationScore),
    responseLatencyMs: reading.responseLatencyMs ?? null,
    timestamp: Date.now(),
  });
}

//Read
export async function getBiomarkersBySession(
  sessionId: string,
): Promise<Biomarker[]> {
  return db.biomarkers.where("sessionId").equals(sessionId).sortBy("timestamp");
}

export async function getBiomarkersByTask(
  sessionId: string,
  taskId: TaskId,
): Promise<Biomarker[]> {
  return db.biomarkers
    .where("sessionId")
    .equals(sessionId)
    .filter((b) => b.taskId === taskId)
    .sortBy("timestamp");
}

export async function aggregateBiomarkers(
  sessionId: string,
): Promise<BiomarkerAggregate | null> {
  const rows = await getBiomarkersBySession(sessionId);
  if (rows.length === 0) return null;

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const latencies = rows
    .map((r) => r.responseLatencyMs)
    .filter((v): v is number => v !== null);

  const avgGaze = avg(rows.map((r) => r.gazeScore));
  const avgMotor = avg(rows.map((r) => r.motorScore));
  const avgVocal = avg(rows.map((r) => r.vocalizationScore));
  const avgLatency = latencies.length > 0 ? avg(latencies) : null;

  // Composite score: weighted average (gaze 40%, motor 30%, vocal 30%)
  const overallScore = Math.round(
    (avgGaze * 0.4 + avgMotor * 0.3 + avgVocal * 0.3) * 100,
  );

  return {
    sessionId,
    avgGazeScore: round(avgGaze),
    avgMotorScore: round(avgMotor),
    avgVocalizationScore: round(avgVocal),
    avgResponseLatencyMs: avgLatency !== null ? Math.round(avgLatency) : null,
    sampleCount: rows.length,
    overallScore,
    flags: {
      // DSM-5 domain: Social Communication & Interaction
      socialCommunication: avgGaze < 0.4 || avgVocal < 0.35,
      // DSM-5 domain: Restricted & Repetitive Behaviours
      restrictedBehavior:
        avgMotor < 0.35 || (avgLatency !== null && avgLatency > 3000),
    },
  };
}

//Delete
export async function deleteBiomarkersForSession(
  sessionId: string,
): Promise<void> {
  await db.biomarkers.where("sessionId").equals(sessionId).delete();
}

//Helpers
function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
