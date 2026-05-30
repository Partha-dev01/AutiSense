/**
 * GET /api/auth/desktop/callback
 *
 * Google OAuth callback for the DESKTOP flow. Mirrors the token-exchange +
 * profile-fetch + user-upsert of /api/auth/callback/google, but instead of
 * setting a session cookie it mints a short-lived, PKCE-bound hand-off code and
 * bounces the SYSTEM browser back into the desktop app via `autisense://`.
 * NO session cookie is set in the system browser.
 *
 * Kept intentionally separate from the web callback so the live web auth path
 * is byte-unchanged. The token-exchange block below mirrors that route — keep
 * them in sync if Google's token/profile contract ever changes.
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";
import { upsertGoogleUser } from "@/app/lib/auth/dynamodb";
import { signHandoff, handoffConfigured, renderHandoffReturnPage } from "@/app/lib/auth/desktopHandoff";
import { DESKTOP_CH_COOKIE } from "../start/route";
import { logger } from "@/app/lib/logger";

const log = logger("auth/desktop-callback");

function loginError(appUrl: string, err: string) {
  return NextResponse.redirect(`${appUrl}/auth/login?error=${encodeURIComponent(err)}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const { appUrl, google, oauthStateCookieName, pkceCookieName } = AUTH_CONFIG;

  if (error) {
    log.error("Desktop OAuth error", { error });
    return loginError(appUrl, error);
  }
  if (!code || !state) return loginError(appUrl, "missing_params");

  // CSRF
  const storedState = request.cookies.get(oauthStateCookieName)?.value;
  if (!storedState || storedState !== state) return loginError(appUrl, "invalid_state");

  // Desktop hand-off challenge (set by /api/auth/desktop/start). Re-validate the
  // shape before it enters a signed code (belt-and-suspenders).
  const handoffChallenge = request.cookies.get(DESKTOP_CH_COOKIE)?.value;
  if (!handoffChallenge || !/^[A-Za-z0-9_-]{20,128}$/.test(handoffChallenge)) {
    return loginError(appUrl, "desktop_no_challenge");
  }
  if (!handoffConfigured()) {
    log.error("Desktop hand-off key not configured");
    return loginError(appUrl, "server_error");
  }

  try {
    // ─── Exchange code for tokens (mirrors web callback) ──────────────
    const tokenParams = new URLSearchParams({
      code,
      client_id: AUTH_CONFIG.googleClientId,
      client_secret: AUTH_CONFIG.googleClientSecret,
      redirect_uri: `${appUrl}/api/auth/desktop/callback`,
      grant_type: "authorization_code",
    });
    const codeVerifier = request.cookies.get(pkceCookieName)?.value;
    if (codeVerifier) tokenParams.set("code_verifier", codeVerifier);

    const tokenResponse = await fetch(google.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams,
    });
    if (!tokenResponse.ok) {
      log.error("Desktop token exchange failed", { error: await tokenResponse.text() });
      return loginError(appUrl, "token_exchange_failed");
    }
    const tokens = (await tokenResponse.json()) as { access_token: string };

    // ─── Fetch + verify profile ───────────────────────────────────────
    const profileResponse = await fetch(google.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) {
      log.error("Desktop profile fetch failed", { error: profileResponse.status });
      return loginError(appUrl, "profile_fetch_failed");
    }
    const profile = (await profileResponse.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
      verified_email?: boolean;
    };
    if (!profile.verified_email) return loginError(appUrl, "email_not_verified");

    // ─── Upsert user, mint hand-off code (no session cookie here) ──────
    const user = await upsertGoogleUser({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    const handoffCode = signHandoff(user.id, handoffChallenge);
    const deepLink = `autisense://auth?code=${encodeURIComponent(handoffCode)}`;

    const response = new NextResponse(renderHandoffReturnPage(deepLink), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
    // Clear one-time cookies; deliberately do NOT set a session in the system browser.
    response.cookies.delete(oauthStateCookieName);
    response.cookies.delete(pkceCookieName);
    response.cookies.delete(DESKTOP_CH_COOKIE);
    return response;
  } catch (err) {
    log.error("Desktop callback unexpected error", { error: err });
    return loginError(appUrl, "server_error");
  }
}
