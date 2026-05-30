/**
 * Desktop OAuth hand-off — stateless, HMAC-signed, PKCE-bound one-time code.
 *
 * Used ONLY by the desktop (Electron) sign-in flow (`/api/auth/desktop/*`).
 * Google blocks OAuth inside embedded webviews, so the desktop app runs the
 * OAuth round-trip in the SYSTEM browser. To get the resulting session into
 * Electron's own cookie jar we mint a short-lived signed "hand-off code" that
 * the desktop app exchanges for a real session.
 *
 * Security model:
 *  - The code is `base64url(payload).base64url(HMAC_SHA256(payload))`, signed
 *    with a server-only secret — it cannot be forged client-side.
 *  - It carries `{ uid, ch, exp }` where `ch` is the SHA-256 challenge of a
 *    verifier the Electron MAIN process generated and kept in memory.
 *  - Exchange requires presenting the matching `verifier`; the verifier never
 *    leaves the desktop app (it is NOT in the custom-scheme deep link), so a
 *    malicious app that intercepts `autisense://auth?code=...` cannot use it.
 *  - `exp` is 120 s — a tight replay window on top of the PKCE binding.
 *  This keeps the flow stateless (no DynamoDB row), so it survives Amplify's
 *  per-Lambda scaling where start and exchange may hit different instances.
 *  Single-use server state is intentionally omitted: replay requires possession
 *  of BOTH the code and the in-memory verifier, i.e. TLS-MITM or local malware
 *  on the desktop — which already subsumes outright session theft — so the
 *  120 s + PKCE window is accepted rather than reintroducing per-exchange state.
 */
import { createHmac, createHash, timingSafeEqual } from "crypto";

const HANDOFF_TTL_SECONDS = 120;

interface HandoffPayload {
  uid: string;
  ch: string; // base64url SHA-256 of the desktop verifier (PKCE-style)
  exp: number; // unix epoch seconds
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Server-only signing key. Prefer a dedicated secret; fall back to the OAuth
 *  client secret (already server-only in prod). Empty only in unconfigured dev. */
function handoffKey(): string {
  return process.env.DESKTOP_HANDOFF_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

/** True when a signing key is available (required in production). */
export function handoffConfigured(): boolean {
  return handoffKey().length > 0;
}

/** Mint a signed hand-off code binding the user id to the desktop PKCE challenge. */
export function signHandoff(uid: string, challenge: string): string {
  const key = handoffKey();
  if (!key) throw new Error("desktop hand-off key not configured");
  const payload: HandoffPayload = {
    uid,
    ch: challenge,
    exp: Math.floor(Date.now() / 1000) + HANDOFF_TTL_SECONDS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

type VerifyResult = { ok: true; uid: string } | { ok: false; reason: string };

/** Validate a hand-off code + the desktop verifier. Constant-time on the MAC. */
export function verifyHandoff(code: string, verifier: string): VerifyResult {
  const key = handoffKey();
  if (!key) return { ok: false, reason: "unconfigured" };
  if (!code || !verifier) return { ok: false, reason: "missing" };

  const parts = code.split(".");
  if (parts.length !== 2) return { ok: false, reason: "format" };
  const [body, sig] = parts;

  // 1) signature
  const expected = b64url(createHmac("sha256", key).update(body).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "signature" };
  }

  // 2) payload
  let payload: HandoffPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8")) as HandoffPayload;
  } catch {
    return { ok: false, reason: "parse" };
  }
  if (!payload.uid || !payload.ch || !payload.exp) return { ok: false, reason: "fields" };

  // 3) expiry
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  // 4) PKCE: SHA-256(verifier) must equal the challenge baked into the code
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const chA = Buffer.from(challenge);
  const chB = Buffer.from(payload.ch);
  if (chA.length !== chB.length || !timingSafeEqual(chA, chB)) {
    return { ok: false, reason: "pkce" };
  }

  return { ok: true, uid: payload.uid };
}

/** HTML page returned to the SYSTEM browser after consent: hops back into the
 *  desktop app via the custom scheme, with a manual fallback link. */
export function renderHandoffReturnPage(deepLink: string): string {
  const safeJs = JSON.stringify(deepLink); // safe JS string literal
  // Full HTML-attribute encode (robust regardless of the deep link charset).
  const htmlEsc: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  const safeHref = deepLink.replace(/[&<>"']/g, (c) => htmlEsc[c]);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Returning to AutiSense…</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6faf7;color:#22332b;
       display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}
  .card{background:#fff;border:2px solid #d9e7df;border-radius:16px;padding:32px 28px;max-width:380px;box-shadow:0 8px 30px rgba(77,128,86,.12)}
  h1{font-size:1.15rem;margin:0 0 8px;color:#3a6b4a}
  p{font-size:.92rem;line-height:1.6;color:#5a6b62;margin:0 0 18px}
  a.btn{display:inline-block;background:#4d8058;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600}
</style>
</head>
<body>
  <div class="card">
    <h1>Signed in ✓</h1>
    <p>Returning you to the AutiSense desktop app. You can close this tab.</p>
    <a class="btn" href="${safeHref}">Open AutiSense</a>
  </div>
  <script>try{location.replace(${safeJs});}catch(e){}</script>
</body>
</html>`;
}
