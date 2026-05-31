# Security & Privacy

AutiSense is built privacy-first. The screening pipeline runs entirely on the
user's device, and the web app ships with a hardened HTTP security posture. This
document describes that posture and how to report issues.

- [Privacy model](#privacy-model)
- [HTTP security headers](#http-security-headers)
- [Content Security Policy (nonce-based)](#content-security-policy-nonce-based)
- [Authentication & sessions](#authentication--sessions)
- [Server-side input handling](#server-side-input-handling)
- [Self-hosted assets](#self-hosted-assets)
- [Reporting a vulnerability](#reporting-a-vulnerability)

---

## Privacy model

- **On-device screening inference.** Pose estimation (YOLO) and behavior
  classification (TCN) run in the browser via ONNX Runtime Web. **Raw video
  frames are never uploaded.**
- **Local-first storage.** Profiles, session records, biomarkers, and game
  progress are stored in the browser's IndexedDB via Dexie (`app/lib/db/*`).
  Nothing is sent to the server unless the user explicitly invokes a server
  feature (e.g. generating a report) or opts into anonymized cloud sync.
- **User-controlled deletion.** A "delete my data" action clears local storage,
  and a once-per-session retention purge is implemented
  (`app/lib/db/privacy.ts`).
- **Minimal PII at the edge.** The "nearby support" lookup queries Overpass /
  OpenStreetMap and stores no personal data. Client IPs are derived through a
  trusted-proxy helper (`app/lib/clientIp.ts`) to avoid header spoofing.

> AutiSense is **not** a diagnostic tool and is **not** clinically validated. See
> the root README's ethics section.

---

## HTTP security headers

Set globally in `next.config.ts` (verify exact current values there):

- **`Cross-Origin-Opener-Policy`** and **`Cross-Origin-Embedder-Policy`** —
  enable cross-origin isolation, required for `SharedArrayBuffer` (threaded WASM
  inference).
- **`Strict-Transport-Security` (HSTS)** — force HTTPS.
- **`X-Content-Type-Options: nosniff`** — block MIME sniffing.
- **`X-Frame-Options`** — clickjacking protection.
- **`Referrer-Policy`** — limit referrer leakage.
- **`Permissions-Policy`** — restrict powerful features (camera/geolocation
  scoped to the app; microphone restricted).

Static asset routes (`/models/*`, `/ort/*`) are served with long-lived
immutable caching.

---

## Content Security Policy (nonce-based)

The CSP is generated **per request** in `middleware.ts` with a fresh nonce each
time, rather than a static policy. Notable points:

- `script-src` uses a fresh **nonce** plus `strict-dynamic` (so the host
  allowlist is ignored by modern browsers once a nonce is trusted) and the WASM
  eval permission needed by ONNX Runtime Web. (`'unsafe-eval'` is added in
  **development only** for the dev toolchain.)
- Inline styles are permitted (`style-src 'unsafe-inline'`) because React
  components use inline styles.
- `worker-src`/`media-src` allow `blob:` for the Web Worker and camera media.
- `connect-src` is limited to the app origin plus the specific external services
  the app talks to.
- Framing is disallowed (`frame-ancestors 'none'`), `object-src 'none'`,
  `base-uri 'self'`.

The middleware passes the nonce to the document so the inline theme bootstrap
script can be nonced. The matcher excludes API routes, Next static/image assets,
`/models/`, `/ort/`, and `/.well-known`.

---

## Authentication & sessions

- **Google OAuth 2.0 with PKCE (`S256`).** The authorization request includes a
  `code_challenge`/`code_challenge_method=S256`; state and PKCE cookies guard the
  flow.
- **Session cookie** is HTTP-only, `Secure`, and host-prefixed; it is rotated on
  login and cleared on logout.
- **Desktop OAuth hand-off.** Because Google blocks sign-in inside embedded
  webviews, the Electron app performs OAuth in the system browser and exchanges a
  one-time, PKCE-protected code (`api/auth/desktop/*`) to set the session cookie
  in its own jar.
- API routes that touch user data check the session server-side.

---

## Server-side input handling

- **Assistant action allowlist.** The in-app assistant can only trigger a fixed
  list of safe, navigation-style client actions — a guard against prompt/LLM
  injection.
- **Report generation** sanitizes and clamps inputs (e.g. guarding against
  header/CRLF injection from user-supplied dates, clamping scores, and capping
  report size). HTML is sanitized with DOMPurify.
- **Feed reactions** use conditional/idempotent writes to prevent counter
  inflation and object-level abuse, with type validation on inputs.

> Some operational hardening lives outside the code (e.g. a shared rate-limit
> store and IAM-role-based AWS access in production). These are deployment
> concerns rather than repository configuration.

---

## Self-hosted assets

To keep the CSP tight and avoid third-party runtime dependencies:

- **ONNX Runtime Web** WASM/threading assets are self-hosted in `public/ort/`
  (ORT is configured to load from `/ort/`).
- **Models** are self-hosted in `public/models/`.
- **Fonts** are self-hosted (downloaded/served at build time).

---

## Reporting a vulnerability

If you discover a security or privacy vulnerability, please **report it
privately** rather than opening a public issue:

- Use GitHub's **private vulnerability reporting** on the
  [repository](https://github.com/Partha-dev01/AutiSense) (Security → *Report a
  vulnerability*), if enabled; or
- Contact **[Imaginaerium](https://imaginaerium.in)** directly.

Please include steps to reproduce and the potential impact, and give us a
reasonable chance to investigate and remediate before any public disclosure.

> **TODO (maintainer):** confirm the preferred private security contact
> (e.g. a dedicated security email or GitHub private advisories) and list it
> explicitly here.
