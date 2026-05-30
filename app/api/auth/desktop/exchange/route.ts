/**
 * GET /api/auth/desktop/exchange?code=<handoff-code>&v=<desktop-verifier>
 *
 * Called by the desktop app's OWN BrowserWindow (so Set-Cookie lands in
 * Electron's cookie jar, over HTTPS to the prod host → __Host- prefix valid).
 * Verifies the signed, PKCE-bound hand-off code, then creates a real session
 * and sets the standard session cookie — same cookie the web flow uses.
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";
import { verifyHandoff, handoffConfigured } from "@/app/lib/auth/desktopHandoff";
import { createSessionForUser, deleteAuthSession } from "@/app/lib/auth/dynamodb";
import { logger } from "@/app/lib/logger";

const log = logger("auth/desktop-exchange");

export async function GET(request: NextRequest) {
  const { appUrl, sessionCookieName, sessionMaxAgeSeconds } = AUTH_CONFIG;

  // Fail loud (not silently) if the signing secret is missing in prod — otherwise
  // every desktop login would just verify-fail with a generic error.
  if (!handoffConfigured()) {
    log.error("Desktop hand-off key not configured (set DESKTOP_HANDOFF_SECRET or GOOGLE_CLIENT_SECRET)");
    return NextResponse.redirect(`${appUrl}/auth/login?error=desktop_handoff_failed`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";
  const verifier = searchParams.get("v") || "";

  const result = verifyHandoff(code, verifier);
  if (!result.ok) {
    log.error("Desktop hand-off verification failed", { reason: result.reason });
    return NextResponse.redirect(`${appUrl}/auth/login?error=desktop_handoff_failed`);
  }

  // Rotate any session already bound to this client (session-fixation defense).
  const previousToken = request.cookies.get(sessionCookieName)?.value;
  if (previousToken) {
    try { await deleteAuthSession(previousToken); } catch { /* best-effort */ }
  }

  const sessionToken = await createSessionForUser(result.uid);

  const response = NextResponse.redirect(`${appUrl}/kid-dashboard`);
  response.cookies.set(sessionCookieName, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: sessionMaxAgeSeconds,
    path: "/",
  });
  return response;
}
