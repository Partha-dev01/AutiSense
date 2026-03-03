# AutiSense — Project Documentation

> AI-Powered Autism Screening Platform
> Privacy-first, offline-capable, browser-based behavioral analysis

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Feature Map](#feature-map)
- [Intake Flow (12 Steps)](#intake-flow-12-steps)
- [AI / ML Pipeline](#ai--ml-pipeline)
- [AWS Services](#aws-services)
- [Authentication](#authentication)
- [Data Layer](#data-layer)
- [Therapy Games](#therapy-games)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Development Progress](#development-progress)
- [Known Issues](#known-issues)
- [Changelog](#changelog)

---

## Overview

AutiSense is a Next.js 16 web application that provides AI-powered autism screening for children. It combines:

- **Edge AI** — Real-time ONNX inference (YOLO pose detection + TCN behavior classification + FER+ emotion analysis) running entirely in the browser via Web Workers
- **Generative AI** — Amazon Bedrock (Nova Lite + Cohere Command R+) for generating DSM-5 aligned clinical reports from biomarker data
- **Offline-first data** — IndexedDB (Dexie.js) for local storage with DynamoDB sync when online
- **Adaptive therapy** — 7 post-diagnosis games with dynamic difficulty adjustment

The app runs a full 12-step screening flow in ~15 minutes, producing domain scores for gaze, motor, vocalization, and behavioral patterns. No video or audio ever leaves the device.

---

## Architecture

```
Browser (Client)
├── Main Thread (Next.js App Router)
│   ├── 12-step intake flow
│   ├── Dashboard + child profiles
│   ├── 7 therapy games
│   ├── Community feed
│   ├── IndexedDB (Dexie v3)
│   └── DynamoDB sync bridge
│
└── Web Worker (InferenceWorker.ts)
    ├── ONNX Runtime Web (WebGPU/WASM)
    ├── Body: YOLO26n-pose → FeatureEncoder → BodyTCN (6 classes)
    ├── Face: FaceDetector → FER+ (8 emotions) → FaceFeatureEncoder → FaceTCN (4 classes)
    └── Fusion: 70% body + 30% face → ASD risk score

Server (Amplify SSR / Lambda)
├── POST /api/report/summary   → Amazon Bedrock Nova Lite
├── POST /api/report/clinical   → Amazon Bedrock Cohere Command R+
├── POST /api/report/pdf        → pdf-lib PDF generation
├── POST /api/tts               → Amazon Polly
├── GET/POST /api/auth/*        → Google OAuth + DynamoDB sessions
└── GET/POST /api/feed          → Community feed CRUD
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + custom CSS variables (globals.css) |
| Fonts | Fredoka (headings) + Nunito (body) |
| State | Zustand (global) + React useState (local) |
| Database (client) | Dexie.js v4 (IndexedDB wrapper) |
| Database (server) | Amazon DynamoDB (7 tables) |
| ML Inference | ONNX Runtime Web 1.24.2 |
| Face Detection | @mediapipe/tasks-vision |
| Charts | Recharts (dashboard) + Chart.js (detector) |
| PDF | pdf-lib (server-side generation) |
| Auth | Custom Google OAuth 2.0 flow |
| Testing | Playwright 1.58.2 |
| Hosting | AWS Amplify (WEB_COMPUTE) |

---

## Feature Map

### Core Features (Complete)

| Feature | Status | Files |
|---------|--------|-------|
| Landing page | Done | `app/page.tsx` |
| 12-step intake flow | Done | `app/intake/*/page.tsx` (10 pages) |
| ONNX video behavioral analysis | Done | `app/intake/video-capture/page.tsx`, `app/lib/inference/*` |
| Session biomarker tracking | Done | `app/lib/db/biomarker.repository.ts` |
| Summary with domain scores | Done | `app/intake/summary/page.tsx` |
| Bedrock AI reports (summary + clinical) | Done | `app/api/report/summary/route.ts`, `app/api/report/clinical/route.ts` |
| PDF report download | Done | `app/api/report/pdf/route.ts` |
| Amazon Polly TTS | Done | `app/api/tts/route.ts` |
| Google OAuth login | Done | `app/api/auth/*/route.ts`, `app/auth/login/page.tsx` |
| Dashboard with charts | Done | `app/dashboard/page.tsx` |
| Child profiles | Done | `app/dashboard/child/[id]/page.tsx` |
| 7 adaptive therapy games | Done | `app/games/*/page.tsx` |
| Community feed | Done | `app/feed/page.tsx` |
| Light/dark theme | Done | `app/globals.css` (`[data-theme]`) |
| Offline-first IndexedDB | Done | `app/lib/db/schema.ts` (Dexie v3) |
| COOP/COEP headers for WASM | Done | `next.config.ts` |

### AWS Infrastructure (Complete)

| Resource | Status | Details |
|----------|--------|---------|
| DynamoDB (7 tables) | Deployed | PAY_PER_REQUEST, ap-south-1 |
| S3 bucket + ONNX models | Deployed | 4 models, ~47MB total |
| IAM policies (3) | Created | Bedrock, Polly, DynamoDB+S3 |
| IAM user + Amplify role | Created | For local dev + production |
| Bedrock model access | Auto-enabled | Nova Lite + Command R+ |
| Budget alarm ($10/mo) | Active | Email alerts at 80% and 100% |
| Amplify hosting | Live | Auto-deploy from GitHub main |

---

## Intake Flow (12 Steps)

| Step | Page | What It Tests | Biomarker Output |
|------|------|--------------|-----------------|
| 1 | `/intake/profile` | Parental consent | — |
| 2 | `/intake/child-profile` | Child info (name, DOB, language) | Creates session in IndexedDB |
| 3 | `/intake/device-check` | Camera + microphone permissions | — |
| 4 | `/intake/communication` | Speech recognition (child's voice) | `vocalizationScore` |
| 5 | `/intake/visual-engagement` | Social vs non-social tap preference | `gazeScore` |
| 6 | `/intake/behavioral-observation` | Free-play bubble pop reaction time | `motorScore`, `responseLatencyMs` |
| 7 | `/intake/preparation` | Following spoken instructions (Polly TTS) | `vocalizationScore` |
| 8 | `/intake/motor` | Tap-the-target motor coordination | `motorScore`, `responseLatencyMs` |
| 9 | `/intake/audio` | Audio echo (Polly TTS + SpeechRecognition) | `vocalizationScore` |
| 10 | `/intake/video-capture` | ONNX behavioral video analysis | `gazeScore`, `motorScore`, `asdRiskScore`, behavior classes |
| 11 | `/intake/summary` | Aggregated domain scores from all stages | — |
| 12 | `/intake/report` | AI-generated clinical report (Bedrock) | PDF download |

---

## AI / ML Pipeline

### Body Pipeline (6 behavior classes)
```
Webcam frame → YOLO26n-pose (17 keypoints) → FeatureEncoder (86-dim)
  → BodyTCN → [hand_flapping, body_rocking, head_banging, spinning, toe_walking, non_autistic]
```

### Face Pipeline (4 behavior classes)
```
Face ROI → FER+ (8 emotions) → FaceFeatureEncoder (64-dim)
  → FaceTCN → [typical_expression, flat_affect, atypical_expression, gaze_avoidance]
```

### Fusion
```
ASD Risk = 0.7 × bodyRisk + 0.3 × faceRisk
```

### ONNX Models

| Model | File | Size | Quantization |
|-------|------|------|-------------|
| YOLO26n-pose | `yolo26n-pose-int8.onnx` | 13MB | INT8 |
| Body TCN | `pose-tcn-int8.onnx` | 274KB | INT8 |
| FER+ Emotions | `emotion-ferplus-8.onnx` | 34MB | FP32 |
| Face TCN | `face-tcn-int8.onnx` | 81KB | INT8 |

All inference runs client-side in a Web Worker via ONNX Runtime Web (WebGPU or WASM backend).

---

## AWS Services

| Service | Usage | API Endpoint |
|---------|-------|-------------|
| **Bedrock** (Nova Lite) | Parent-friendly session summaries | `POST /api/report/summary` |
| **Bedrock** (Command R+) | DSM-5 aligned clinical reports | `POST /api/report/clinical` |
| **Polly** | Neural TTS voice prompts (Joanna) | `POST /api/tts` |
| **DynamoDB** | User accounts, auth sessions, biomarkers, child profiles, feed posts | Via AWS SDK v3 |
| **S3** | ONNX model file hosting (presigned URLs) | Via `@aws-sdk/s3-request-presigner` |
| **Amplify** | Next.js SSR hosting with auto-deploy | GitHub webhook |

All API routes have **mock fallbacks** — the app works without AWS credentials using template-based responses and in-memory storage.

---

## Authentication

- **Provider**: Google OAuth 2.0 (custom implementation, no third-party auth library)
- **Flow**: `/api/auth/google` → Google consent → `/api/auth/callback/google` → DynamoDB session → cookie
- **Session**: `autisense-session` cookie (7-day expiry), stored in DynamoDB `autisense-auth-sessions` table
- **Fallback**: In-memory auth adapter when AWS credentials are unavailable (development mode)
- **Anonymous use**: Users can complete the full screening without signing in

### Key Files
- `app/api/auth/google/route.ts` — Initiates OAuth with CSRF state
- `app/api/auth/callback/google/route.ts` — Handles callback, upserts user, creates session
- `app/api/auth/session/route.ts` — Returns current user
- `app/api/auth/logout/route.ts` — Deletes session
- `app/lib/auth/dynamodb.ts` — DynamoDB adapter with in-memory fallback
- `app/hooks/useAuth.ts` — Client-side auth hook

---

## Data Layer

### IndexedDB Schema (Dexie v3)

| Table | Primary Key | Indexes | Purpose |
|-------|-------------|---------|---------|
| `sessions` | `id` | `userId`, `createdAt`, `synced`, `status` | Screening sessions |
| `biomarkers` | `++id` (auto) | `sessionId`, `userId`, `timestamp`, `taskId` | Per-task biomarker data |
| `syncQueue` | `++id` (auto) | `sessionId`, `queuedAt`, `retryCount` | Offline sync queue |
| `childProfiles` | `id` | `userId`, `createdAt` | Child profiles |
| `feedPosts` | `id` | `category`, `createdAt` | Community feed posts |

### Biomarker Fields

| Field | Type | Range | Source |
|-------|------|-------|--------|
| `gazeScore` | number | 0-1 | Visual engagement, video capture |
| `motorScore` | number | 0-1 | Motor test, behavioral observation |
| `vocalizationScore` | number | 0-1 | Communication, audio, preparation |
| `responseLatencyMs` | number | ms | Motor test, behavioral observation |
| `asdRiskScore` | number | 0-1 | Video capture (fusion engine) |
| `bodyBehaviorClass` | string | 6 classes | Video capture (body TCN) |
| `faceBehaviorClass` | string | 4 classes | Video capture (face TCN) |

### Session Propagation

Session ID is stored in `localStorage` (`autisense-current-session-id`) at child profile creation and read by each subsequent intake page for biomarker writes.

---

## Therapy Games

| Game | Route | Cognitive Target | Difficulty Levels |
|------|-------|-----------------|-------------------|
| Emotion Match | `/games/emotion-match` | Emotional recognition | 5 (pairs scale) |
| Category Sorting | `/games/sorting` | Classification, reasoning | 5 (items scale) |
| Sequence Memory | `/games/sequence` | Working memory | 5 (sequence length) |
| Social Stories | `/games/social-stories` | Social interaction | 5 (scenario complexity) |
| Calm Breathing | `/games/breathing` | Self-regulation | 5 (duration) |
| Pattern Match | `/games/pattern-match` | Visual discrimination | 5 (grid size) |
| Color & Sound | `/games/color-sound` | Multisensory processing | 5 (speed) |

Difficulty engine (`app/lib/games/difficultyEngine.ts`) auto-adjusts based on recent score history stored in localStorage.

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/google` | Public | Redirect to Google OAuth |
| GET | `/api/auth/callback/google` | Public | OAuth callback handler |
| GET | `/api/auth/session` | Public | Get current user |
| POST | `/api/auth/logout` | Public | Delete session |
| POST | `/api/report/summary` | Public | Generate summary via Bedrock Nova Lite |
| POST | `/api/report/clinical` | Public | Generate clinical report via Bedrock Command R+ |
| POST | `/api/report/pdf` | Public | Generate downloadable PDF |
| POST | `/api/tts` | Public | Text-to-speech via Amazon Polly |
| GET | `/api/feed` | Public | List feed posts |
| POST | `/api/feed` | Public | Create feed post |

---

## Testing

### Test Suites

| File | Tests | Coverage |
|------|-------|----------|
| `tests/intake-flow.spec.ts` | 15 | Full 12-step intake flow navigation, form validation, back buttons |
| `tests/app-pages.spec.ts` | 15 | Auth, dashboard, all 7 games, feed, 4 API endpoints |
| **Total** | **30** | **All passing** |

### Run Tests

```bash
npm run build          # Build first (required for Playwright)
npx playwright test    # Run all 30 tests
```

### API Tests Included

- `POST /api/report/summary` — Returns mock summary without AWS
- `POST /api/report/clinical` — Returns mock clinical report without AWS
- `POST /api/report/pdf` — Generates valid PDF (checks content-type header)
- `POST /api/tts` — Returns 503 without AWS credentials (expected)

---

## Development Progress

### Phase 0 — Foundation (Complete)
- [x] Next.js 16 project setup with TypeScript, Tailwind v4
- [x] Design system (globals.css — sage green palette, Fredoka/Nunito fonts)
- [x] Landing page with feature cards
- [x] Data layer (Dexie schema v1, session/biomarker repositories)
- [x] Sync bridge (POST /api/sync)

### Phase 1A — Infrastructure + Detector Engine (Complete)
- [x] COOP/COEP headers in next.config.ts
- [x] 4 ONNX models copied to public/models/
- [x] 13 inference engine files ported from detector codebase
- [x] Web Worker replaced with full inference pipeline
- [x] Inference types defined (app/types/inference.ts)
- [x] Dexie schema bumped to v2

### Phase 1B — Detector UI (Complete)
- [x] Video capture page (Stage 10) with camera + skeleton overlay
- [x] DetectorVideoCanvas component (sage green themed)
- [x] DetectorResultsPanel component
- [x] useDetectorInference hook with biomarker conversion

### Phase 1C — Intake Stages 4-9 (Complete)
- [x] Communication (Stage 4) — SpeechRecognition
- [x] Visual Engagement (Stage 5) — canvas tap tracking
- [x] Behavioral Observation (Stage 6) — bubble pop
- [x] Preparation (Stage 7) — instruction sequencing
- [x] Motor Assessment (Stage 8) — target tap
- [x] Audio Assessment (Stage 9) — audio echo

### Phase 1D — Summary + Session Wiring (Complete)
- [x] Session creation at child-profile with localStorage propagation
- [x] All task pages write biomarkers to IndexedDB on completion
- [x] Summary page loads real aggregated data
- [x] Extended aggregation for detector-specific fields (asdRisk, behavior classes)

### Phase 2 — Authentication (Complete)
- [x] Google OAuth 2.0 flow (4 API routes)
- [x] DynamoDB auth adapter with in-memory fallback
- [x] Login page with Google button + privacy card
- [x] useAuth client hook
- [x] Session cookie management

### Phase 3 — Bedrock Reports (Complete)
- [x] Summary API (Nova Lite) with mock fallback
- [x] Clinical API (Command R+) with DSM-5 section extraction
- [x] PDF generation with pdf-lib
- [x] Amazon Polly TTS API
- [x] Report page with dual report types + PDF download

### Phase 4 — Dashboard + Child Profiles (Complete)
- [x] Dashboard with Recharts line chart
- [x] Child profile detail page with bar charts
- [x] Dexie schema bumped to v3

### Phase 5 — Therapy Games (Complete)
- [x] 7 adaptive therapy games
- [x] Difficulty engine with 5 levels
- [x] Games hub page

### Phase 6 — Community Feed (Complete)
- [x] Feed page with post creation and reactions
- [x] Category filtering
- [x] Feed API route

### AWS Deployment (Complete)
- [x] 7 DynamoDB tables + 2 GSIs created
- [x] S3 bucket created + 4 ONNX models uploaded
- [x] 3 IAM policies created
- [x] IAM user + Amplify service role created
- [x] $10/month budget alarm configured
- [x] Google OAuth configured
- [x] Amplify app deployed from GitHub
- [x] COOP/COEP custom headers set
- [x] Auto-deploy on push to main enabled

---

## Known Issues

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | No server-side route protection (middleware.ts deleted) | Medium | Open | Next.js 16 deprecated middleware. Dashboard/games/feed pages accessible without login. Client-side auth guards needed. |
| 2 | Login page shows "Loading..." briefly before rendering | Low | Open | Suspense boundary for useSearchParams — normal Next.js behavior |
| 3 | Video capture requires camera permission — no graceful fallback UI | Low | Open | Page shows "Start Video Analysis" but camera denial has no user-friendly error |
| 4 | SpeechRecognition not available in all browsers | Low | Open | Communication + Audio stages fall back to "missed" after timeout on unsupported browsers |
| 5 | ONNX models loaded from public/ not S3 in production | Low | Open | Models bundled with the app (~47MB). S3 presigned URL loading is implemented but not wired to video-capture page |
| 6 | Feed posts are local-only (IndexedDB) | Low | Open | DynamoDB sync for feed posts not yet implemented |
| 7 | Dashboard charts show empty state for new users | Low | Open | No sample/demo data — charts appear blank until user completes at least one screening |

---

## Changelog

### v1.0.0 — 2026-03-03 (Initial Release)

**Added:**
- Complete 12-step autism screening intake flow
- Real-time ONNX behavioral video analysis (YOLO + TCN + FER+)
- Amazon Bedrock AI report generation (Nova Lite summaries + Command R+ clinical reports)
- PDF report download with scores and clinical text
- Amazon Polly text-to-speech for child-facing prompts
- Google OAuth 2.0 authentication with DynamoDB sessions
- Dashboard with session history, Recharts charts, and child profiles
- 7 adaptive therapy games with difficulty engine
- Anonymous community feed with category filters and reactions
- Offline-first IndexedDB storage (Dexie v3)
- Light/dark theme toggle
- AWS infrastructure: DynamoDB (7 tables), S3, Bedrock, Polly, Amplify
- $10/month budget alarm with email notifications
- 30 Playwright tests (all passing)
- COOP/COEP headers for SharedArrayBuffer (ONNX WASM threading)

**Deployment:**
- Live at https://main.d2n7pu2vtgi8yc.amplifyapp.com
- Auto-deploy from GitHub `main` branch
- Amplify service role for production AWS access
