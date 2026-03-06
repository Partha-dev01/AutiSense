# AutiSense — Deployment Reference

> Quick reference for the deployed AWS infrastructure. No secrets stored here.

---

## Live Application

| | |
|---|---|
| **URL** | https://main.d2n7pu2vtgi8yc.amplifyapp.com |
| **Amplify App ID** | `d2n7pu2vtgi8yc` |
| **Region** | ap-south-1 (Mumbai) |
| **GitHub** | https://github.com/Partha-dev01/AutiSense_2 |
| **Auto-deploy** | Pushes to `main` trigger automatic builds |

---

## AWS Resources

| Service | Resource | Region |
|---------|----------|--------|
| DynamoDB | 7 tables (`autisense-*`) | ap-south-1 |
| S3 | `autisense-models-762099405044` (4 ONNX models) | ap-south-1 |
| Bedrock | Nova Lite + Nova Pro | us-east-1 |
| Polly | Joanna (Neural voice) | ap-south-1 |
| Amplify | WEB_COMPUTE (Next.js SSR) | ap-south-1 |
| IAM | `autisense-app` user + `AutiSenseAmplifyRole` | Global |
| Budgets | $10/month alarm | Global |

---

## Environment Variables

### CRITICAL: Amplify SSR Env Var Behavior

> **Amplify WEB_COMPUTE injects environment variables into the BUILD container but NOT into the SSR Lambda runtime.**

This means `process.env.MY_VAR` will be `undefined` at request time in API routes and server components unless you handle it explicitly.

**How we solve this:** All non-AWS env vars are listed in `next.config.ts` under the `env` property. This tells Next.js to inline them at **build time** into the server bundle, so they're available when the Lambda handles requests.

```ts
// next.config.ts
env: {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // ... all 13 vars listed here
},
```

**AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)** are NOT listed in `env` — Lambda provides these automatically via the IAM execution role (`AutiSenseAmplifyRole`).

### Adding a New Environment Variable

When you add a new env var to the app:

1. **Set it in Amplify Console** → App settings → Environment variables
2. **Add it to `next.config.ts` `env` block** (unless it starts with `AWS_` or `NEXT_PUBLIC_`)
3. **Add it to `.env.local`** for local development
4. **Push and redeploy** — the build step will inline the value

If you skip step 2, the variable will be available during `npm run build` but **undefined** when handling requests.

### Current Environment Variables

| Variable | Set In | Purpose |
|----------|--------|---------|
| `GOOGLE_CLIENT_ID` | Amplify + next.config.ts | Google OAuth app ID |
| `GOOGLE_CLIENT_SECRET` | Amplify + next.config.ts | Google OAuth secret |
| `NEXT_PUBLIC_APP_URL` | Amplify + next.config.ts | App base URL (for OAuth redirects) |
| `BEDROCK_REGION` | Amplify + next.config.ts | Bedrock model region (us-east-1) |
| `POLLY_REGION` | Amplify + next.config.ts | Polly voice region (ap-south-1) |
| `S3_MODELS_BUCKET` | Amplify + next.config.ts | S3 bucket for ONNX models |
| `DYNAMODB_*` (7 tables) | Amplify + next.config.ts | DynamoDB table names |
| `APP_ACCESS_KEY_ID` | Amplify + next.config.ts | IAM user access key (Amplify blocks `AWS_*`) |
| `APP_SECRET_ACCESS_KEY` | Amplify + next.config.ts | IAM user secret key |
| `APP_REGION` | Amplify + next.config.ts | AWS region for SDK clients |

### Google OAuth Setup

| Setting | Value |
|---------|-------|
| **Google Cloud Console** | APIs & Services → Credentials → OAuth 2.0 Client IDs |
| **Authorized redirect URI** | `https://main.d2n7pu2vtgi8yc.amplifyapp.com/api/auth/callback/google` |
| **Scopes** | `openid email profile` |

The redirect URI is constructed from `NEXT_PUBLIC_APP_URL` + `/api/auth/callback/google`. No separate `GOOGLE_REDIRECT_URI` env var is needed.

---

## AWS SDK Credential Handling

Amplify WEB_COMPUTE does **not** expose IAM role credentials to the SSR Lambda runtime. We use custom-named env vars (`APP_ACCESS_KEY_ID`, `APP_SECRET_ACCESS_KEY`, `APP_REGION`) because Amplify reserves the `AWS_*` prefix.

All SDK clients use the shared helper in `app/lib/aws/credentials.ts`:

```ts
import { getAppCredentials, getAppRegion } from "@/app/lib/aws/credentials";

const credentials = getAppCredentials();
new DynamoDBClient({
  region: getAppRegion("ap-south-1"),
  ...(credentials && { credentials }),
});
```

This falls back to the SDK default provider chain when `APP_*` vars are not set (e.g., local dev with `AWS_*` in `.env.local`).

---

## How to Redeploy

Push to `main` or run:

```bash
aws amplify start-job --app-id d2n7pu2vtgi8yc --branch-name main --job-type RELEASE --region ap-south-1
```

---

## Troubleshooting

### "Google OAuth is not configured" on deployed site

**Cause:** `process.env.GOOGLE_CLIENT_ID` is undefined in the Lambda runtime.

**Fix:** Ensure the variable is listed in both:
1. Amplify Console → Environment variables
2. `next.config.ts` → `env` block

Then redeploy.

### AWS API calls failing with "AccessDenied" or "InvalidIdentityToken"

**Cause:** Explicit credentials passed to SDK client without session token.

**Fix:** Remove `credentials: { accessKeyId, secretAccessKey }` from SDK client constructors. Let the SDK auto-detect credentials.

### Tests fail with "ERR_CONNECTION_REFUSED"

**Cause:** Another `next dev` process holds `.next/dev/lock`.

**Fix:** Kill all Node processes (`taskkill /f /im node.exe` on Windows) or delete `.next/dev/lock`.

### ESLint CI check fails

**Cause:** React 19 strict lint rules (`react-hooks/*`) introduced in `eslint-config-next`.

**Fix:** Rules are configured in `eslint.config.mjs`. If new violations appear after updating Next.js, check if hooks ordering or ref patterns need adjustment.

### Google sign-in enters a redirect loop

**Cause:** DynamoDB auth tables have wrong primary key names, or env vars were wiped.

**Fix:** Verify table schemas match what the code expects:
- `autisense-users`: PK = `id` (string), GSI = `email-index` on `email`
- `autisense-auth-sessions`: PK = `token` (string), TTL on `expiresAt`

Also verify all 16 Amplify env vars are set (see below).

---

## Critical Warnings

### `aws amplify update-app --environment-variables` REPLACES ALL vars

**The `--environment-variables` flag REPLACES the entire env var map.** It does not append.

If you run:
```bash
aws amplify update-app --environment-variables NEW_VAR=value
```
This **deletes every other env var** and sets only `NEW_VAR`. Always include ALL existing vars when updating.

**Safe pattern:**
```bash
aws amplify get-app --app-id d2n7pu2vtgi8yc --region ap-south-1 \
  --query "app.environmentVariables"
# Copy all existing vars, add your new one, then update with the full list
```

### DynamoDB Table Key Schema Must Match Code

The auth code in `app/lib/auth/dynamodb.ts` uses these exact key names:
- `autisense-users` table: PK must be `id` (NOT `userId`)
- `autisense-auth-sessions` table: PK must be `token` (NOT `sessionToken`)

If tables are created with different key names, all DynamoDB operations fail silently and auth falls back to in-memory (which doesn't persist across Lambda instances).

### All 16 Required Amplify Environment Variables

```
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_APP_URL,
BEDROCK_REGION, POLLY_REGION, S3_MODELS_BUCKET,
DYNAMODB_SESSIONS_TABLE, DYNAMODB_BIOMARKERS_TABLE,
DYNAMODB_USERS_TABLE, DYNAMODB_AUTH_SESSIONS_TABLE,
DYNAMODB_CHILD_PROFILES_TABLE, DYNAMODB_SESSION_SUMMARIES_TABLE,
DYNAMODB_FEED_POSTS_TABLE,
APP_ACCESS_KEY_ID, APP_SECRET_ACCESS_KEY, APP_REGION
```

---

## Changelog

### 2026-03-06 — Mobile UI Fixes, Emotion Quiz, Feed Redesign

**Issues fixed (8 items from mobile testing):**

1. **UserMenu dropdown overlap** — Added semi-transparent backdrop overlay behind dropdown for visual separation on mobile. Clicking backdrop closes menu.
   - `app/components/UserMenu.tsx`

2. **Emotion Match → Emotion Quiz** — Replaced card-flip matching game (identical to Memory game) with scenario-based Emotion Quiz. 20 scenarios, 5 emotion choices, adaptive difficulty, sound feedback. Now correctly saves game activity + updates streak.
   - `app/games/emotion-match/page.tsx` (full rewrite)
   - `app/kid-dashboard/games/page.tsx` (updated description)
   - `app/kid-dashboard/page.tsx` (updated card emoji/title)

3. **Streak not updating** — Fixed childId mismatch: dashboard used `""` fallback but games used `"default"`. Changed dashboard fallback to `"default"`.
   - `app/kid-dashboard/page.tsx`

4. **Chat mic + viewport + input reorder**:
   - Added `viewport` export in layout.tsx to prevent mobile zoom on input focus
   - Fixed SpeechRecognition: cleanup old instance before new one, 120ms delay for mic release, nullify ref on callbacks, cleanup on unmount
   - Reordered input bar: mic button first (64px, primary green), text input secondary
   - `app/kid-dashboard/chat/page.tsx`, `app/layout.tsx`

5. **Progress page** — Verified childId already uses `"default"` fallback; no change needed.

6. **BottomNav/navbar overlap** — Resolved by Fix 1 (backdrop overlay).

7. **Community Feed redesign**:
   - Posts displayed first, compose form behind "New Post" button + floating action button
   - Per-user reaction tracking via new `feedReactions` IndexedDB table (schema v5)
   - Reactions toggle on/off per user (filled/unfilled state)
   - Delete own posts with reaction cleanup
   - Cleaner card layout, category pills, empty state
   - `app/feed/page.tsx` (full rewrite), `app/lib/db/feed.repository.ts`, `app/lib/db/schema.ts`, `app/types/feedPost.ts`

**Files modified:** 10 files across components, games, pages, DB layer, and types.

### 2026-03-06 — Fix Google sign-in loop

**Root causes found:**
1. `aws amplify update-app --environment-variables` replaced ALL env vars (wiped `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, etc.)
2. DynamoDB `autisense-users` table had PK `userId` but code uses `id`
3. DynamoDB `autisense-auth-sessions` table had PK `sessionToken` but code uses `token`
4. `dynamoFailed` flag was permanent — one transient error disabled DynamoDB forever

**Fixes applied:**
- Restored all 16 Amplify env vars
- Recreated `autisense-users` table (PK=`id`, GSI=`email-index`)
- Recreated `autisense-auth-sessions` table (PK=`token`, TTL on `expiresAt`)
- Changed `dynamoFailed` from permanent boolean to 30-second cooldown timer

### 2026-03-05 — Fix AWS SDK credentials for Amplify

- Created shared credential helper (`app/lib/aws/credentials.ts`)
- Updated all 8 SDK client locations to use `APP_*` env vars
- Added `APP_ACCESS_KEY_ID`, `APP_SECRET_ACCESS_KEY`, `APP_REGION` to Amplify
- Polly TTS confirmed working on deployed site

### 2026-03-05 — Fix COEP header for map tiles

- Changed `Cross-Origin-Embedder-Policy` from `require-corp` to `credentialless`
- Updated both `next.config.ts` and Amplify custom headers
