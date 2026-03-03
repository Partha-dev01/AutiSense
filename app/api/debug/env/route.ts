/**
 * GET /api/debug/env
 * Diagnostic endpoint — shows which env vars the Lambda runtime can see.
 * Returns only presence/length, never actual values.
 * DELETE THIS FILE after debugging is complete.
 */
import { NextResponse } from "next/server";

const ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "BEDROCK_REGION",
  "DYNAMODB_SESSIONS_TABLE",
  "DYNAMODB_USERS_TABLE",
  "POLLY_REGION",
  "NODE_ENV",
];

export async function GET() {
  const report: Record<string, string> = {};
  for (const key of ENV_KEYS) {
    const val = process.env[key];
    report[key] = val ? `SET (${val.length} chars)` : "MISSING";
  }
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envReport: report,
    totalProcessEnvKeys: Object.keys(process.env).length,
  });
}
