/**
 * GET /api/auth/desktop/start?ch=<handoff-challenge>
 *
 * Desktop (Electron) sign-in entry point. Identical to /api/auth/google except:
 *  - it is opened in the user's SYSTEM browser (Electron shell.openExternal),
 *    sidestepping Google's `disallowed_useragent` block on embedded webviews;
 *  - it carries `ch`, the SHA-256 challenge of a verifier the desktop app keeps
 *    in memory, stored in an httpOnly cookie for the desktop callback;
 *  - it uses the desktop redirect URI `/api/auth/desktop/callback`.
 *
 * The live WEB flow (/api/auth/google + /api/auth/callback/google) is untouched.
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";

export const DESKTOP_CH_COOKIE = "autisense-desktop-ch";

/** URL-safe base64 (no padding) of raw bytes. */
function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(request: NextRequest) {
  const { googleClientId, appUrl, google, oauthStateCookieName, pkceCookieName } = AUTH_CONFIG;

  if (!googleClientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID." },
      { status: 500 },
    );
  }

  // Hand-off challenge from the desktop app (base64url SHA-256 of its verifier).
  const ch = new URL(request.url).searchParams.get("ch") || "";
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(ch)) {
    return NextResponse.redirect(`${appUrl}/auth/login?error=desktop_bad_challenge`);
  }

  // CSRF state + PKCE (for the Google leg) — same as the web start.
  const state = crypto.randomUUID();
  const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(new Uint8Array(digest));

  const redirectUri = `${appUrl}/api/auth/desktop/callback`;

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: google.scopes,
    state,
    access_type: "offline",
    prompt: "select_account",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(`${google.authUrl}?${params.toString()}`);

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600, // 10 minutes
    path: "/",
  };
  response.cookies.set(oauthStateCookieName, state, cookieOpts);
  response.cookies.set(pkceCookieName, codeVerifier, cookieOpts);
  response.cookies.set(DESKTOP_CH_COOKIE, ch, cookieOpts);

  return response;
}
