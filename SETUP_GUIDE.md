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
| Bedrock | Nova Lite + Command R+ | us-east-1 |
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
| `AWS_REGION` | Auto (Lambda) | Lambda execution region |
| `AWS_ACCESS_KEY_ID` | Auto (Lambda IAM) | IAM role credentials |
| `AWS_SECRET_ACCESS_KEY` | Auto (Lambda IAM) | IAM role credentials |
| `AWS_SESSION_TOKEN` | Auto (Lambda IAM) | IAM role session token |

### Google OAuth Setup

| Setting | Value |
|---------|-------|
| **Google Cloud Console** | APIs & Services → Credentials → OAuth 2.0 Client IDs |
| **Authorized redirect URI** | `https://main.d2n7pu2vtgi8yc.amplifyapp.com/api/auth/callback/google` |
| **Scopes** | `openid email profile` |

The redirect URI is constructed from `NEXT_PUBLIC_APP_URL` + `/api/auth/callback/google`. No separate `GOOGLE_REDIRECT_URI` env var is needed.

---

## AWS SDK Credential Handling

**NEVER pass explicit credentials to AWS SDK clients in API routes.**

```ts
// WRONG — breaks on Amplify Lambda (missing sessionToken)
new DynamoDBClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// CORRECT — SDK auto-detects IAM role credentials (including session token)
new DynamoDBClient({ region: "ap-south-1" });
```

On Amplify Lambda, the IAM execution role provides **temporary STS credentials** that include `AWS_SESSION_TOKEN`. The default SDK credential provider chain handles this automatically. Passing explicit `accessKeyId`/`secretAccessKey` without `sessionToken` will cause auth failures.

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
