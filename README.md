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
| Auth (Planned) | BetterAuth |

---

## 📁 Project Structure

```
/app          → Routes & API endpoints
/components   → Pure UI components
/lib
  /identity   → Anonymous → BetterAuth-ready ID abstraction
  /db         → Dexie schema & setup
  /sync       → Offline sync logic
  /ai         → Client-side AI utilities
/server
  /aws        → DynamoDB & Bedrock clients
  /repositories
  /services
/workers      → ONNX inference Web Worker
/types        → Shared domain models
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
  timestamp: number
}
```

---

## 🔐 Identity Strategy

**MVP:** Anonymous device-based `userId` (localStorage)  
**Production:** Drop-in replacement via BetterAuth — no business logic changes required

---

## 📄 License

MIT
