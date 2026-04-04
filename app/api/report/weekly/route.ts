/**
 * POST /api/report/weekly
 *   Weekly report generation placeholder.
 *   Actual generation happens client-side (Dexie/IndexedDB).
 *   This route returns a 501 since server-side IndexedDB is unavailable.
 *
 * GET /api/report/weekly?childId=xxx
 *   Same — weekly reports are stored client-side in IndexedDB.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  // Weekly report generation uses Dexie (IndexedDB) which is browser-only.
  // This logic must run client-side. See kid-dashboard/reports/page.tsx.
  return NextResponse.json(
    {
      error: "Weekly reports are generated client-side. Use the reports page directly.",
      hint: "Call generateWeeklyReport() from the client, not via this API route.",
    },
    { status: 501 },
  );
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      error: "Weekly reports are stored client-side in IndexedDB.",
      hint: "Query db.weeklyReports from the client directly.",
    },
    { status: 501 },
  );
}
