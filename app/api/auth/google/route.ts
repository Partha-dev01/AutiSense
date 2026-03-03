/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth flow.
 * Constructs the Google authorization URL with CSRF state parameter,
 * sets the state in a cookie, and redirects the user.
 */
import { NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";

export async function GET() {
  const { googleClientId, appUrl, google, oauthStateCookieName } = AUTH_CONFIG;

  if (!googleClientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID." },
      { status: 500 }
    );
  }

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();

  const redirectUri = `${appUrl}/api/auth/callback/google`;

  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: google.scopes,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const authorizationUrl = `${google.authUrl}?${params.toString()}`;

  const response = NextResponse.redirect(authorizationUrl);

  // Store state in httpOnly cookie for CSRF validation on callback
  response.cookies.set(oauthStateCookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty for the OAuth round-trip
    path: "/",
  });

  return response;
}
