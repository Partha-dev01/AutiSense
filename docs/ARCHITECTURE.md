# Architecture

AutiSense is **one web application with several thin native shells**. The
Next.js app, hosted on AWS Amplify, is the single source of truth. The desktop
and Android packages bundle no application code — they load the live site. This
keeps every platform in sync with a single deploy.

- [High-level diagram](#high-level-diagram)
- [The web app (Next.js)](#the-web-app-nextjs)
- [On-device inference pipeline](#on-device-inference-pipeline)
- [Local-first data](#local-first-data)
- [Server-side API routes](#server-side-api-routes)
- [Thin clients](#thin-clients)
- [Security & isolation](#security--isolation)

---

## High-level diagram

```
                    ┌─────────────────────────────────────────────┐
                    │  AutiSense web app (Next.js · AWS Amplify)   │
                    │                                              │
   In browser:      │  App Router pages + API routes               │
   ONNX pipeline    │  Client-side ONNX inference (YOLO pose + TCN) │
   runs on device   │  IndexedDB (Dexie) local-first storage       │
                    │  API routes → Bedrock / Polly / DynamoDB     │
                    └───────▲───────────────▲───────────────▲──────┘
                            │               │               │
                   loads the live site (no bundled app code)
                            │               │               │
            ┌───────────────┴──┐   ┌────────┴───────┐   ┌───┴────────────┐
            │ Electron desktop │   │ Android TWA    │   │ Browser / PWA  │
            │ (Win/macOS/Linux)│   │ (Chrome engine)│   │ (installable)  │
            └──────────────────┘   └────────────────┘   └────────────────┘
```

---

## The web app (Next.js)

- **Framework:** Next.js 16 (App Router), React 19, TypeScript.
- **Rendering/hosting:** server-side rendering on AWS Amplify WEB_COMPUTE
  (`amplify.yml` drives the build).
- **UI:** Tailwind CSS v4, lucide-react icons, Recharts (charts), Leaflet
  (maps). Fonts are self-hosted (no third-party runtime font request),
  satisfying `font-src 'self'`.
- **Route groups (App Router):**
  - `/` — landing page.
  - `/intake/*` — the guided, multi-step screening flow (consent, child profile,
    device check, communication, motor/reaction tasks, behavioral video capture,
    summary, report).
  - `/kid-dashboard/*` — kids hub: live `detection`, therapy `games`, `chat`,
    `speech`, `progress`, `reports`, `nearby-help`.
  - `/dashboard/*` — clinician dashboard and child profiles.
  - `/games/*` — therapy-style games.
  - `/feed` — community feed; `/auth/login` — sign-in.
  - `app/api/*` — server route handlers (see [API routes](#server-side-api-routes)).

---

## On-device inference pipeline

The screening pipeline runs entirely in the browser; raw video frames never
leave the device.

**Files:** `app/lib/inference/*`, `workers/` (the inference Web Worker),
`app/hooks/useDetectorInference.ts`, `app/hooks/useActionCamera.ts`,
`app/lib/actions/actionDetector.ts`.

**Models (self-hosted in `public/models/`):**

| Model | Role |
|---|---|
| YOLO pose (`yolo26n-pose-int8.onnx`) | Pose estimator → COCO-17 keypoints |
| Body TCN (`pose-tcn-*.onnx`) | Temporal Convolutional Network → body movement class |
| Face TCN (`face-tcn-int8.onnx`) | Temporal classifier → facial-expression class |
| FER+ (`emotion-ferplus-8.onnx`) | Emotion probabilities from a face crop |

> Model files in `public/models/` are the authoritative list; the body-TCN file
> name has been versioned over time, so check the orchestrator
> (`app/lib/inference/PipelineOrchestrator.ts`) for the exact file currently
> wired in.

**Flow (body pipeline):**

1. Camera frames are captured in the browser.
2. The **YOLO pose model** produces 17 COCO keypoints per frame.
3. A **feature encoder** (`FeatureEncoder.ts`) turns keypoints into a per-frame
   feature vector.
4. Frames are buffered into a **64-frame temporal window**.
5. The **body TCN** classifies the window into the movement categories defined in
   `app/types/inference.ts` (hand-flapping, body-rocking,
   head-banging, spinning, toe-walking, and a non-autistic / typical class).
6. Probabilities are surfaced in the detector UI.

A separate face path (FER+ → face TCN) and a `MultimodalOrchestrator` /
`FusionEngine` exist for combined body+face scoring.

**Runtime:** [ONNX Runtime Web](https://onnxruntime.ai/) executes the models.
The orchestrator prefers the **WebGPU** backend and falls back to
**multi-threaded WASM**. The WASM/threading assets are self-hosted in
`public/ort/` (ORT is pointed at `/ort/` rather than a CDN). Multi-threaded WASM
needs `SharedArrayBuffer`, which is why the app enables cross-origin isolation
via COOP/COEP headers (see [Security](#security--isolation)).

Inference runs in a **Web Worker** so the UI thread stays responsive.

> **Honesty note:** movement classification is imperfect and not clinically
> validated. The pipeline is a screening aid, not a diagnostic. See
> [`SECURITY.md`](SECURITY.md) and the root README's ethics section.

---

## Local-first data

Profile- and session-style data stays on the device by default.

**Files:** `app/lib/db/*` (Dexie schema + repositories),
`app/lib/db/privacy.ts`.

- Storage uses **Dexie** over the browser's **IndexedDB**.
- Tables include child profiles, screening sessions, biomarker records, game
  activity, streaks, and feed data.
- Nothing is uploaded unless the user explicitly triggers a server feature (such
  as generating a report) or opts into cloud sync (anonymized sessions /
  biomarkers to DynamoDB).
- A **"delete my data"** action wipes local storage; a once-per-session retention
  purge is also implemented.

---

## Server-side API routes

A set of Next.js route handlers (`app/api/*`) back the opt-in, account-based
features, using AWS SDK v3. Each AWS-dependent route has a graceful fallback, so
the app remains usable without AWS configured.

| Route | Purpose | Backing service |
|---|---|---|
| `api/auth/google`, `api/auth/callback/google`, `api/auth/session`, `api/auth/logout` | Google OAuth (PKCE) login / callback / session / logout | DynamoDB (in-memory fallback) |
| `api/auth/desktop/{start,callback,exchange}` | Desktop OAuth deep-link hand-off for the Electron app | — |
| `api/chat/conversation`, `api/chat/generate-words` | In-app assistant + word generation | Bedrock (Nova Lite); curated fallback |
| `api/report/summary`, `api/report/clinical`, `api/report/pdf`, `api/report/weekly` | Report generation + PDF export | Bedrock (Nova Lite/Pro); template fallback |
| `api/tts` | Text-to-speech audio | Polly; browser `speechSynthesis` fallback |
| `api/feed` | Community feed: list / post / react | DynamoDB; in-memory fallback |
| `api/nearby` | Nearby support lookup | Overpass / OpenStreetMap |
| `api/sync` | Opt-in cloud sync of anonymized data | DynamoDB |
| `api/health` | Health check | DynamoDB; degraded status |

**Auth:** Google OAuth 2.0 with **PKCE (`S256`)**. Sessions use an HTTP-only,
`Secure`, host-prefixed cookie; the session rotates on login and is cleared on
logout.

**Desktop sign-in:** Google blocks sign-in inside embedded webviews, so the
Electron shell opens OAuth in the system browser and returns via an
`autisense://auth?code=...` deep link; a one-time, PKCE-protected code is
exchanged at `api/auth/desktop/exchange` to set the session cookie in Electron's
own cookie jar.

**Assistant safety:** the chat assistant only triggers a fixed **allowlist** of
safe, navigation-style client actions — a guard against prompt/LLM injection.

> Credentials and table names come from environment variables — never the repo.
> See [`DEVELOPMENT.md`](DEVELOPMENT.md), [`SETUP_GUIDE.md`](SETUP_GUIDE.md),
> [`Amazon_usage.md`](Amazon_usage.md), and `.env.local.example`.

---

## Thin clients

Both native packages wrap the live site and ship **no application bundle**, so a
single web deploy updates every install.

### Electron desktop (`electron/`)

- `electron/main.js` opens a sandboxed `BrowserWindow`
  (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) and loads
  `https://autisense.imaginaerium.in`.
- Camera/mic/geolocation are granted **only** for the app origin.
- External links (other domains) open in the user's real browser; in-app
  navigation stays in the window.
- Google OAuth uses the system-browser deep-link hand-off described above.
- A single-instance lock supports deep-link delivery; self-update via
  `electron-updater` from GitHub Releases.
- Packaged with **electron-builder**: NSIS on Windows, DMG (arm64) on macOS,
  AppImage + deb on Linux. App ID `in.imaginaerium.autisense`.
- See [`electron/README.md`](../electron/README.md).

### Android TWA (`twa/`)

- A **Trusted Web Activity** opens the PWA full-screen via the device's Chrome
  engine.
- Verified with **Digital Asset Links** (`public/.well-known/assetlinks.json`),
  which removes the browser address bar (Custom Tab fallback if it doesn't
  verify).
- `twa/twa-manifest.json` is the Bubblewrap source of truth; built with
  `bubblewrap build`. Package `in.imaginaerium.autisense`.
- See [`twa/README.md`](../twa/README.md).

---

## Security & isolation

- **Per-request nonce CSP** is generated in `middleware.ts` on every matched
  route, with a fresh nonce and `strict-dynamic` for scripts.
- **Cross-origin isolation:** `next.config.ts` sets COOP/COEP to enable
  `SharedArrayBuffer` for threaded WASM inference.
- **Other headers:** HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`,
  a `Referrer-Policy`, and a restrictive `Permissions-Policy`.
- **Self-hosted assets:** ONNX runtime (`/ort/`) and models (`/models/`) are
  served from the app with long-lived immutable caching; fonts are self-hosted.
  This keeps the CSP tight and avoids third-party runtime dependencies.

Full details and the reporting process are in [`SECURITY.md`](SECURITY.md).
