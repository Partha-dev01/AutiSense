/**
 * AUTH_CONFIG — Central auth configuration constants.
 * All secrets come from env vars; fallbacks keep local dev working.
 */
export const AUTH_CONFIG = {
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
