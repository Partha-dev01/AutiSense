# 🧠 AutiSense

> **Offline-first, edge-AI neurodevelopmental screening — built for the edge, designed for the real world.**

AutiSense is a web application that captures behavioral biomarkers using on-device AI inference and syncs them to the cloud when connectivity is available. No data ever leaves the device during analysis.

---

## ✨ What It Does

- 📷 **Camera-based biomarker capture** — gaze, motor, and vocalization scoring via on-device ONNX models
- 🔌 **Fully offline** — works without internet; data lives in IndexedDB until sync is possible
- ☁️ **Smart sync** — automatically flushes to AWS DynamoDB when connection is restored
- 📄 **AI-generated reports** — powered by Amazon Bedrock once data reaches the cloud
- 🔐 **Privacy-first** — inference runs entirely on-device via Web Workers; no raw video is transmitted

---

## 🏗 Architecture

```
Browser (Offline-First)
├── IndexedDB (Dexie)     → Sessions, biomarkers, sync queue
├── Web Worker            → ONNX Runtime inference (isolated from UI thread)
└── Sync Service          → Detects connectivity, flushes unsynced records

Server (Next.js API Routes)
├── /api/sync             → Validates user, writes to DynamoDB
└── /api/report           → Calls Amazon Bedrock, generates PDF report

Cloud
├── AWS DynamoDB          → Permanent session & biomarker storage (partitioned by userId)
└── Amazon Bedrock        → AI report generation
```

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Offline Storage | IndexedDB via Dexie.js |
| On-Device AI | ONNX Runtime Web |
| Cloud Database | AWS DynamoDB |
| AI Reports | Amazon Bedrock |
| Auth | Custom Google OAuth 2.0 + DynamoDB sessions |

---

## 📁 Project Structure

```
/app
  /api           → 15 API routes (auth, chat, feed, nearby, report, sync, tts)
  /auth          → Login page
  /components    → 11 shared UI components
  /contexts      → AuthContext (Google OAuth)
  /dashboard     → Clinician dashboard + child profiles
  /feed          → Community feed (posts, reactions)
  /games         → 7 therapy games (clinician-facing)
  /hooks         → 4 custom hooks (auth, camera, inference)
  /intake        → 10-step screening flow
  /kid-dashboard → Kids dashboard (7 games, AI chat, progress, reports, map)
  /lib           → Business logic (auth, aws, camera, db, games, inference, reports, scoring, sync)
  /types         → 6 type modules (biomarker, session, inference, etc.)
/public          → Static assets + 4 ONNX models (~47MB)
/server          → Lambda handler + DynamoDB setup script
/tests           → 2 Playwright spec files (32 tests)
/workers         → ONNX inference Web Worker
```

---

## 🔄 Offline Sync Flow

```
[Offline]  Capture → IndexedDB (synced: false) → syncQueue
[Online]   Network event → flush syncQueue → POST /api/sync → DynamoDB → mark synced
[Login]    Fetch cloud sessions → hydrate IndexedDB → works offline again
```

---

## 🤖 Biomarker Output Schema

```ts
{
  gazeScore: number,
  motorScore: number,
  vocalizationScore: number,
  responseLatencyMs: number,
  asdRiskScore: number,
  bodyBehaviorClass: string,
  faceBehaviorClass: string,
  timestamp: number
}
```

---

## 🔐 Identity Strategy

**MVP:** Anonymous device-based `userId` (localStorage)
**Production:** Google OAuth 2.0 with DynamoDB sessions (implemented)

---

## 📄 License

MIT
