/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth flow.
 * Constructs the Google authorization URL with a CSRF `state` parameter and a
 * PKCE `code_challenge` (RFC 7636 / RFC 9700 — defends against authorization-
 * code injection), stores both secrets in httpOnly cookies, and redirects.
 */
import { NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";

/** URL-safe base64 (no padding) of raw bytes. */
function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET() {
  const { googleClientId, appUrl, google, oauthStateCookieName, pkceCookieName } = AUTH_CONFIG;

  if (!googleClientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID." },
      { status: 500 }
    );
  }

  // CSRF state
  const state = crypto.randomUUID();

  // PKCE: high-entropy verifier + S256 challenge.
  const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(new Uint8Array(digest));

  const redirectUri = `${appUrl}/api/auth/callback/google`;

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

  // Short-lived httpOnly cookies for CSRF + PKCE validation on callback.
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600, // 10 minutes — plenty for the OAuth round-trip
    path: "/",
  };
  response.cookies.set(oauthStateCookieName, state, cookieOpts);
  response.cookies.set(pkceCookieName, codeVerifier, cookieOpts);

  return response;
}
