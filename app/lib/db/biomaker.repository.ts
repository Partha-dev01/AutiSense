import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";

export async function addBiomarker(
  sessionId: string,
  biomarker: {
    gazeScore: number;
    motorScore: number;
    vocalizationScore: number;
  },
) {
  const userId = getCurrentUserId();

  await db.biomarkers.add({
    sessionId,
    userId,
    ...biomarker,
    timestamp: Date.now(),
  });
}
