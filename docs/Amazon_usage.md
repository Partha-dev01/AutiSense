# Amazon Web Services Usage — AutiSense

## Generative AI on AWS

| Service | Model | File | Status |
|---------|-------|------|--------|
| Amazon Bedrock (Nova Lite) | `amazon.nova-lite-v1:0` | app/api/chat/conversation/route.ts | Used (fallback when quota=0) |
| Amazon Bedrock (Nova Lite) | `amazon.nova-lite-v1:0` | app/api/chat/generate-words/route.ts | Used (fallback when quota=0) |
| Amazon Bedrock (Nova Lite) | `amazon.nova-lite-v1:0` | app/api/report/summary/route.ts | Used (fallback when quota=0) |
| Amazon Bedrock (Nova Pro) | `amazon.nova-pro-v1:0` | app/api/report/clinical/route.ts | Active (hybrid template + AI insights) |
| Amazon Polly | Neural TTS (Joanna) | app/api/tts/route.ts | Active, working |
| ONNX Runtime (on-device) | 4 models in `public/models/` | app/lib/inference/ (13 files), workers/inference.worker.ts | Active, working |

## AWS Infrastructure

| Service | Resource | File | Status |
|---------|----------|------|--------|
| AWS Amplify | WEB_COMPUTE SSR hosting | amplify.yml, next.config.ts | Active, auto-deploys from GitHub |
| Amazon DynamoDB | 7 tables (`autisense-sessions`, `autisense-biomarkers`, `autisense-users`, `autisense-auth-sessions`, + 3 placeholder) | app/lib/auth/dynamodb.ts, app/api/sync/route.ts, server/scripts/setup-dynamodb.sh | Active (4 tables in use, 3 placeholder) |
| Amazon S3 | `autisense-models-762099405044` bucket | SDK installed (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) | Models uploaded, but served from `public/` statically for now |
| AWS Lambda | Implicit via Amplify SSR + standalone handler | server/lambda/sync-handler.ts | Every API route runs as Lambda |
| AWS IAM | `autisense-app` user + `AutiSenseAmplifyRole` | app/lib/aws/credentials.ts | Active |
| AWS Budgets | $10/month alarm | Configured in console | Active |

## NOT directly used from the recommended list

| Service | Status |
|---------|--------|
| Amazon EC2 | Not used (Amplify handles compute) |
| Amazon ECS | Not used |
| Amazon API Gateway | Not explicitly — Amplify's internal API Gateway handles routing to Lambda |
| Kiro | Not used |

## Where exactly each Bedrock call happens

1. **AI voice conversation with child** (Step 7 screening + kid chat) — app/api/chat/conversation/route.ts — Nova Lite generates adaptive multi-turn questions across social/cognitive/language/motor domains
2. **Dynamic word/sentence generation** (speech stages) — app/api/chat/generate-words/route.ts — Nova Lite generates age-appropriate vocabulary
3. **Parent-friendly summary** (end of screening) — app/api/report/summary/route.ts — Nova Lite translates biomarker scores to plain language
4. **DSM-5 clinical report** (end of screening) — app/api/report/clinical/route.ts — Nova Pro returns structured JSON insights merged with deterministic template (hybrid approach, ~85% fewer tokens)

All 4 Bedrock routes have comprehensive mock fallbacks, so the app is fully functional even with your current quota=0 situation. The on-device ONNX inference (the core screening AI) needs zero cloud — it runs entirely in the browser.
