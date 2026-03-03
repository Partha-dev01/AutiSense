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

## How to Redeploy

Push to `main` or run: `aws amplify start-job --app-id d2n7pu2vtgi8yc --branch-name main --job-type RELEASE --region ap-south-1`
