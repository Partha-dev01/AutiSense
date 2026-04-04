/**
 * AUTH_CONFIG — Central auth configuration constants.
 * Secrets are read at runtime via process.env (never baked into bundle).
 */
export const AUTH_CONFIG = {
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  get googleClientSecret(): string {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      console.error("[auth] GOOGLE_CLIENT_SECRET not set in production");
    }
    return secret || "";
  },
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  sessionCookieName: "autisense-session",
  oauthStateCookieName: "autisense-oauth-state",
  sessionMaxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  sessionMaxAgeSeconds: 30 * 24 * 60 * 60, // 30 days in seconds (for cookie maxAge)
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: "openid email profile",
  },
} as const;
