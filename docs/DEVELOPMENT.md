# Development

This guide covers running AutiSense locally, the available scripts, environment
variables, and a known test-runner caveat.

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Scripts](#scripts)
- [Environment variables](#environment-variables)
- [What works without AWS](#what-works-without-aws)
- [Cross-origin isolation](#cross-origin-isolation)
- [Test-runner path caveat (`#`)](#test-runner-path-caveat-)
- [Building the native clients](#building-the-native-clients)

---

## Prerequisites

- **Node.js 22+** (see `.nvmrc`) and npm.
- A modern browser (WebGPU support is a plus; the app falls back to WASM).
- Optional, for the account/server features: AWS credentials and resources
  (DynamoDB, Bedrock, Polly) and a Google OAuth client. The app runs without
  them — all AWS-backed routes have fallbacks.

---

## Setup

```bash
git clone https://github.com/Partha-dev01/AutiSense.git
cd AutiSense
npm install
cp .env.local.example .env.local   # then edit with your own values
npm run dev                         # http://localhost:3000
```

> `.env.local` is gitignored. Never commit real secrets.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run test:unit` | Run the Vitest unit suite (see [caveat](#test-runner-path-caveat-)) |
| `npm test` | Run the Playwright E2E suite |

Before opening a PR, run `npm run lint` and `npm run type-check`.

---

## Environment variables

These mirror [`.env.local.example`](../.env.local.example). Fill in your own
values; do not commit them. See [`Amazon_usage.md`](Amazon_usage.md) and
[`SETUP_GUIDE.md`](SETUP_GUIDE.md) for the full deployment-side reference.

| Variable | Purpose |
|---|---|
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | AWS region + credentials for local dev (or use an AWS CLI profile) |
| `APP_ACCESS_KEY_ID`, `APP_SECRET_ACCESS_KEY`, `APP_REGION` | Production credentials on Amplify (which reserves the `AWS_*` prefix) |
| `BEDROCK_REGION` | AWS Bedrock region |
| `POLLY_REGION` | AWS Polly region |
| `DYNAMODB_SESSIONS_TABLE`, `DYNAMODB_BIOMARKERS_TABLE`, `DYNAMODB_USERS_TABLE`, `DYNAMODB_AUTH_SESSIONS_TABLE`, `DYNAMODB_CHILD_PROFILES_TABLE`, `DYNAMODB_SESSION_SUMMARIES_TABLE`, `DYNAMODB_FEED_POSTS_TABLE` | DynamoDB table names (defaults provided in the example file) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `NEXT_PUBLIC_APP_URL` | Public base URL (e.g. `http://localhost:3000`) |

> **Production note:** the recommended posture is to use an Amplify Lambda IAM
> role for AWS access rather than long-lived keys, and to keep secrets out of
> source and out of `next.config.ts`.

---

## What works without AWS

The **on-device screening pipeline** (camera → YOLO pose → TCN classification)
runs purely in the browser and needs **no** AWS credentials or Google OAuth.

The following features use their backing services, each with a fallback:

- **Sign-in** → Google OAuth (in-memory auth fallback).
- **Reports / PDF** and the **assistant** → AWS Bedrock (template/curated
  fallbacks).
- **Text-to-speech** → AWS Polly (browser `speechSynthesis` fallback).
- **Community feed** → DynamoDB (in-memory fallback).
- **Cloud sync** → DynamoDB.
- **Nearby support** → Overpass/OpenStreetMap (public API; no AWS).

---

## Cross-origin isolation

The app sets COOP/COEP headers (in `next.config.ts`) to enable
`SharedArrayBuffer` for multi-threaded WASM inference. If you embed cross-origin
resources during development and they fail to load, COEP is the likely cause —
keep third-party assets self-hosted (as the project already does for the ONNX
runtime and fonts) or adjust the dev headers locally.

The CSP is applied per-request in `middleware.ts` with a fresh nonce. In
development it additionally allows the eval needed by the dev toolchain; this is
not present in production builds.

---

## Test-runner path caveat (`#`)

> [!WARNING]
> Vitest can fail to start when the project path contains a **`#`** character.
> This is an environment/tooling limitation (the `#` confuses path resolution),
> not a problem with the tests themselves.

If `npm run test:unit` won't run:

- **Move or clone the repo to a path without `#`** (e.g. avoid folders like
  `#PROJECTS`), then run the suite there; or
- Rely on CI, which checks the code out to a clean path and runs the suite
  normally.

`npm run lint`, `npm run type-check`, `npm run build`, and `npm run dev` are not
affected by this.

---

## Building the native clients

The desktop and Android apps are independent thin-client projects that wrap the
live site — they don't consume the Next.js build output.

**Electron (desktop):**
```bash
cd electron
npm install
npm start            # opens the window against the live site
# place icons in electron/build/ : icon.ico (win), icon.icns (mac), icon.png (linux)
npm run dist:win     # or dist:mac / dist:linux  → artifacts in electron/dist/
```
Each OS target must build on its own OS; CI uses a Windows/Ubuntu/macOS matrix.

**TWA (Android):** requires JDK 17 + the Android SDK and the Bubblewrap CLI.
```bash
cd twa
bubblewrap build     # builds the signed APK + AAB from twa-manifest.json
```
Signed Android artifacts require the release keystore, which is **not** in the
repo, and the signing key's SHA-256 fingerprint must be present in
`public/.well-known/assetlinks.json` for Digital Asset Links verification.

See [`electron/README.md`](../electron/README.md) and
[`twa/README.md`](../twa/README.md) for the full build/release instructions, and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit together.
