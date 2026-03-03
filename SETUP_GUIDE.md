# AutiSense — AWS & Google OAuth Setup Guide

> Step-by-step guide with exact navigation instructions for AWS beginners.

---

## Prerequisites

### 1. Create an AWS Account (if you don't have one)
1. Go to https://aws.amazon.com/
2. Click **"Create an AWS Account"** (top right)
3. Enter your email, password, and account name
4. Add a payment method (you won't be charged — everything we use is within Free Tier or pay-per-request)
5. Verify your identity via phone
6. Select the **"Basic Support — Free"** plan
7. Sign in to the AWS Console at https://console.aws.amazon.com/

### 2. Install AWS CLI (Command Line Tool)
1. Download from https://aws.amazon.com/cli/
2. Run the installer
3. Open a terminal and verify: `aws --version`
4. Configure it:
   ```bash
   aws configure
   ```
   It will ask for:
   - **AWS Access Key ID**: (we'll create this in Section 6)
   - **AWS Secret Access Key**: (we'll create this in Section 6)
   - **Default region**: `ap-south-1` (Mumbai — closest to India, change if you prefer)
   - **Default output format**: `json`

   > If you don't have access keys yet, skip this step and come back after Section 6.

### 3. Other Prerequisites
- Node.js 20+ installed
- Google account for OAuth setup

---

## 1. Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. At the top of the page, click the **project dropdown** (it says "Select a project" or shows your current project name)
4. In the popup, click **"NEW PROJECT"** (top right of the popup)
5. Project name: `AutiSense`
6. Click **"CREATE"**
7. Wait a few seconds, then select your new `AutiSense` project from the dropdown

### Step 2: Configure OAuth Consent Screen

1. In the left sidebar, click the **hamburger menu** (☰ three horizontal lines, top left)
2. Scroll down and click **"APIs & Services"**
3. Click **"OAuth consent screen"** in the left sidebar
4. Select **"External"** (allows any Google user to sign in)
5. Click **"CREATE"**
6. Fill in the form:
   - **App name**: `AutiSense`
   - **User support email**: select your email from the dropdown
   - Scroll down to **"Developer contact information"** → enter your email
7. Click **"SAVE AND CONTINUE"**
8. **Scopes page**: Click **"ADD OR REMOVE SCOPES"**
   - Check these three:
     - `openid`
     - `../auth/userinfo.email`
     - `../auth/userinfo.profile`
   - Click **"UPDATE"** at the bottom
   - Click **"SAVE AND CONTINUE"**
9. **Test users page**: Click **"SAVE AND CONTINUE"** (skip this)
10. **Summary page**: Click **"BACK TO DASHBOARD"**

### Step 3: Create OAuth 2.0 Client ID

1. In the left sidebar (still under APIs & Services), click **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. **Application type**: select **"Web application"**
5. **Name**: `AutiSense Web`
6. Under **"Authorized redirect URIs"**, click **"+ ADD URI"** and add:
   - `http://localhost:3000/api/auth/callback/google`
   - (For production later, add: `https://your-amplify-domain.amplifyapp.com/api/auth/callback/google`)
7. Click **"CREATE"**
8. A popup appears with your **Client ID** and **Client Secret** — copy both and save them somewhere safe

### Step 4: Add to `.env.local`

Create a file called `.env.local` in the `AutiSense_2/` folder:

```env
GOOGLE_CLIENT_ID=paste-your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
```

---

## 2. Find Your AWS Account ID

You'll need this for IAM policies later.

1. Go to https://console.aws.amazon.com/
2. Click your **account name** in the top-right corner
3. Your **Account ID** (12-digit number) is shown in the dropdown
4. Copy it — you'll need to replace `YOUR_ACCOUNT_ID` in commands below

---

## 3. AWS DynamoDB Tables

DynamoDB is AWS's NoSQL database. We need 7 tables.

### How to find DynamoDB in the AWS Console (visual method)

1. Go to https://console.aws.amazon.com/
2. In the **search bar** at the top, type `DynamoDB`
3. Click **"DynamoDB"** from the results
4. Make sure your region is set to **"Asia Pacific (Mumbai) ap-south-1"** — check the region dropdown in the top-right corner next to your account name
5. You should see the DynamoDB dashboard

### Create tables via CLI (recommended — faster)

Open your terminal and run each command one at a time:

```bash
# Table 1: Sessions
aws dynamodb create-table \
  --table-name autisense-sessions \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Table 2: Biomarkers
aws dynamodb create-table \
  --table-name autisense-biomarkers \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
    AttributeName=createdAt,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Table 3: Users (for Google OAuth login)
aws dynamodb create-table \
  --table-name autisense-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Table 4: Auth Sessions (login tokens)
aws dynamodb create-table \
  --table-name autisense-auth-sessions \
  --attribute-definitions AttributeName=sessionToken,AttributeType=S \
  --key-schema AttributeName=sessionToken,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Table 5: Child Profiles
aws dynamodb create-table \
  --table-name autisense-child-profiles \
  --attribute-definitions AttributeName=childId,AttributeType=S \
  --key-schema AttributeName=childId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Table 6: Session Summaries
aws dynamodb create-table \
  --table-name autisense-session-summaries \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# Table 7: Feed Posts (community feed)
aws dynamodb create-table \
  --table-name autisense-feed-posts \
  --attribute-definitions \
    AttributeName=postId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --key-schema \
    AttributeName=postId,KeyType=HASH \
    AttributeName=createdAt,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

### Verify tables were created

```bash
aws dynamodb list-tables --region ap-south-1
```

You should see all 7 tables listed.

Or in the console: **DynamoDB → Tables** (left sidebar) — you should see all 7 tables.

### Add GSIs (Global Secondary Indexes)

Wait ~30 seconds after creating the tables, then run:

```bash
# Add index to query sessions by userId
aws dynamodb update-table \
  --table-name autisense-sessions \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"userId-createdAt-index\",\"KeySchema\":[{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --region ap-south-1

# Add index to query users by email
aws dynamodb update-table \
  --table-name autisense-users \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"email-index\",\"KeySchema\":[{\"AttributeName\":\"email\",\"KeyType\":\"HASH\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --region ap-south-1
```

---

## 4. Amazon S3 — Model Hosting

S3 (Simple Storage Service) is AWS's file storage. We use it to host our ONNX ML models.

### How to find S3 in the AWS Console

1. Go to https://console.aws.amazon.com/
2. In the **search bar** at the top, type `S3`
3. Click **"S3"** from the results
4. You'll see the S3 Buckets dashboard

### Create bucket and upload models via CLI

```bash
# Create a new bucket (bucket names must be globally unique — if this name is taken, add random numbers)
aws s3 mb s3://autisense-models --region ap-south-1

# Upload the 4 ONNX model files from your project
cd "c:/Users/partha/Downloads/Yolo onnx web/AutiSense_2"
aws s3 cp public/models/yolo26n-pose-int8.onnx s3://autisense-models/models/
aws s3 cp public/models/pose-tcn-int8.onnx s3://autisense-models/models/
aws s3 cp public/models/emotion-ferplus-8.onnx s3://autisense-models/models/
aws s3 cp public/models/face-tcn-int8.onnx s3://autisense-models/models/

# Block public access (models will be accessed via secure presigned URLs only)
aws s3api put-public-access-block \
  --bucket autisense-models \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Verify in the console

1. Go to **S3** in the AWS Console
2. Click on your `autisense-models` bucket
3. Click into the `models/` folder
4. You should see the 4 `.onnx` files listed

---

## 5. Amazon Bedrock — AI Report Generation

Bedrock is AWS's managed AI service. We use two AI models through it:
- **Amazon Nova Lite** — generates quick parent-friendly summaries
- **Cohere Command R+** — generates detailed DSM-5 clinical reports

### How to find Bedrock in the AWS Console

1. Go to https://console.aws.amazon.com/
2. **IMPORTANT**: Change your region to **US East (N. Virginia) us-east-1** — click the region dropdown in the top-right corner and select it. Bedrock models are available in us-east-1.
3. In the **search bar**, type `Bedrock`
4. Click **"Amazon Bedrock"** from the results
5. You'll see the Bedrock dashboard

### Enable Model Access (REQUIRED — models are disabled by default)

1. In the Bedrock dashboard, look at the **left sidebar**
2. Scroll down and click **"Model access"** (under "Bedrock configurations")
3. Click the **"Enable specific models"** or **"Manage model access"** button
4. Find and check these two models:
   - **Amazon** section → **Amazon Nova Lite** (look for `amazon.nova-lite-v1:0`)
   - **Cohere** section → **Command R+** (look for `cohere.command-r-plus-v1:0`)
5. Click **"Next"** at the bottom
6. Review and click **"Submit"**
7. Wait for the status to change to **"Access granted"** (usually takes a few seconds to a minute)

### Create IAM Policy for Bedrock

Back in your terminal:

```bash
aws iam create-policy \
  --policy-name AutiSenseBedrockPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/cohere.command-r-plus-v1:0"
      ]
    }]
  }'
```

---

## 6. Amazon Polly — Text-to-Speech

Polly converts text to natural-sounding speech. We use it to speak prompts to children during the screening tasks.

### How to find Polly in the AWS Console

1. Go to https://console.aws.amazon.com/
2. Switch region back to **Asia Pacific (Mumbai) ap-south-1** (top-right dropdown)
3. In the **search bar**, type `Polly`
4. Click **"Amazon Polly"** from the results
5. You can test it here: type some text and click **"Listen"** to hear it

Polly doesn't need model access enabled — it works out of the box. You just need the right IAM permissions:

```bash
aws iam create-policy \
  --policy-name AutiSensePollyPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech", "polly:DescribeVoices"],
      "Resource": "*"
    }]
  }'
```

---

## 7. IAM — Create an App User with Access Keys

IAM (Identity and Access Management) controls who can access what in AWS. We'll create a dedicated user for AutiSense.

### How to find IAM in the AWS Console

1. Go to https://console.aws.amazon.com/
2. In the **search bar**, type `IAM`
3. Click **"IAM"** from the results (IAM is global — no region needed)
4. You'll see the IAM dashboard

### Create the user via CLI

Replace `YOUR_ACCOUNT_ID` with your 12-digit account ID from Section 2.

```bash
# Step 1: Create the user
aws iam create-user --user-name autisense-app

# Step 2: Attach the Bedrock policy
aws iam attach-user-policy --user-name autisense-app \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/AutiSenseBedrockPolicy

# Step 3: Attach the Polly policy
aws iam attach-user-policy --user-name autisense-app \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/AutiSensePollyPolicy

# Step 4: Add DynamoDB + S3 permissions (replace YOUR_ACCOUNT_ID)
aws iam put-user-policy --user-name autisense-app \
  --policy-name AutiSenseDynamoS3 \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query",
          "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan"
        ],
        "Resource": "arn:aws:dynamodb:ap-south-1:YOUR_ACCOUNT_ID:table/autisense-*"
      },
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject"],
        "Resource": "arn:aws:s3:::autisense-models/*"
      }
    ]
  }'

# Step 5: Generate access keys (SAVE THE OUTPUT!)
aws iam create-access-key --user-name autisense-app
```

The last command outputs something like:
```json
{
    "AccessKey": {
        "UserName": "autisense-app",
        "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
        "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "Status": "Active"
    }
}
```

**Save both `AccessKeyId` and `SecretAccessKey`** — you cannot view the secret again!

### Now configure AWS CLI with these keys

```bash
aws configure
```
Enter the `AccessKeyId` and `SecretAccessKey` you just created.

### Verify it works

```bash
aws dynamodb list-tables --region ap-south-1
aws s3 ls s3://autisense-models/models/
```

Both should return results without errors.

---

## 8. Complete `.env.local` File

Create this file at `AutiSense_2/.env.local` with all the values you've collected:

```env
# AWS Core
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...paste-your-access-key-id
AWS_SECRET_ACCESS_KEY=paste-your-secret-access-key

# DynamoDB Tables
DYNAMODB_SESSIONS_TABLE=autisense-sessions
DYNAMODB_BIOMARKERS_TABLE=autisense-biomarkers
DYNAMODB_USERS_TABLE=autisense-users
DYNAMODB_AUTH_SESSIONS_TABLE=autisense-auth-sessions
DYNAMODB_CHILD_PROFILES_TABLE=autisense-child-profiles
DYNAMODB_SESSION_SUMMARIES_TABLE=autisense-session-summaries
DYNAMODB_FEED_POSTS_TABLE=autisense-feed-posts

# S3
S3_MODELS_BUCKET=autisense-models

# Bedrock (must be us-east-1 — that's where the models are enabled)
BEDROCK_REGION=us-east-1

# Google OAuth (from Section 1)
GOOGLE_CLIENT_ID=paste-your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=paste-your-client-secret

# Amazon Polly
POLLY_REGION=ap-south-1

# App URL (change for production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 9. AWS Amplify Deployment (Production)

Amplify hosts your Next.js app on AWS with automatic builds from GitHub.

### How to find Amplify in the AWS Console

1. Go to https://console.aws.amazon.com/
2. Make sure your region is **ap-south-1** (top-right dropdown)
3. In the **search bar**, type `Amplify`
4. Click **"AWS Amplify"** from the results

### Deploy from GitHub (Recommended)

1. First, push your code to a GitHub repository
2. In the Amplify console, click **"Create new app"**
3. Select **"Host web app"**
4. Choose **"GitHub"** as the source
5. Click **"Connect"** — authorize AWS to access your GitHub
6. Select your repository and branch (usually `main`)
7. **Build settings** — Amplify should auto-detect Next.js. Verify:
   - Framework: **Next.js - SSR**
   - Build command: `npm run build`
   - Output directory: `.next`
8. Click **"Advanced settings"** → **"Environment variables"**
9. Add ALL the variables from your `.env.local` file one by one:
   - `AWS_REGION` → `ap-south-1`
   - `AWS_ACCESS_KEY_ID` → your key
   - `AWS_SECRET_ACCESS_KEY` → your secret
   - `DYNAMODB_SESSIONS_TABLE` → `autisense-sessions`
   - ... (add all of them)
   - `NEXT_PUBLIC_APP_URL` → leave blank for now (you'll get the URL after deploy)
10. Click **"Next"** → **"Save and deploy"**
11. Wait for the build (takes 3-5 minutes)
12. Once deployed, you'll see your app URL like `https://main.d1234abcdef.amplifyapp.com`

### Add Custom Headers (Required for ONNX Runtime)

1. In the Amplify console, click on your app
2. In the left sidebar, click **"Hosting"** → **"Custom headers"**
3. Add these headers (click "Edit" if needed):
   ```yaml
   customHeaders:
     - pattern: '**/*'
       headers:
         - key: Cross-Origin-Opener-Policy
           value: same-origin
         - key: Cross-Origin-Embedder-Policy
           value: require-corp
   ```
4. Click **"Save"**

### Update Google OAuth Redirect URI

1. Go back to Google Cloud Console → APIs & Services → Credentials
2. Click on your `AutiSense Web` OAuth client
3. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
4. Add: `https://your-amplify-domain.amplifyapp.com/api/auth/callback/google`
5. Click **"SAVE"**

### Update NEXT_PUBLIC_APP_URL

1. Go back to Amplify console → your app → **"Hosting"** → **"Environment variables"**
2. Update `NEXT_PUBLIC_APP_URL` to your Amplify URL (e.g. `https://main.d1234abcdef.amplifyapp.com`)
3. Trigger a redeploy: **"Hosting"** → click **"Redeploy this version"**

---

## 10. Verification Checklist

After completing all setup, test each feature:

| # | Feature | How to Test | Expected Result |
|---|---------|-------------|-----------------|
| 1 | **App loads** | Visit your URL or `localhost:3000` | Landing page with "AI-powered autism screening" |
| 2 | **Google Login** | Click "Sign in with Google" on `/auth/login` | Redirects to Google, signs in, lands on `/dashboard` |
| 3 | **Intake Flow** | Click "Begin Free Autism Screening" and go through all 12 steps | All pages render and navigate correctly |
| 4 | **Summary Page** | Complete intake → `/intake/summary` | Shows domain scores |
| 5 | **Quick Summary** | On `/intake/report`, click "Quick Summary" | AI-generated parent-friendly summary appears |
| 6 | **Clinical Report** | On `/intake/report`, click "Full Clinical Report" | Structured DSM-5 report with sections |
| 7 | **PDF Download** | After generating report, click "Download PDF" | PDF file downloads with scores and report |
| 8 | **TTS (Polly)** | Go through Preparation or Audio stages | Voice speaks prompts out loud |
| 9 | **Dashboard** | Visit `/dashboard` | Shows sessions, score chart, child profiles |
| 10 | **Games** | Visit `/games` → play any game | Game loads, scores, difficulty adapts |
| 11 | **Feed** | Visit `/feed` → write a post | Post appears in the community feed |

---

## Quick Reference: AWS Services Used

| Service | What It Does in AutiSense | AWS Console Search Term | Region |
|---------|---------------------------|------------------------|--------|
| **DynamoDB** | Stores all app data (7 tables) | `DynamoDB` | ap-south-1 |
| **S3** | Hosts ONNX ML model files | `S3` | ap-south-1 |
| **Bedrock** | AI-generated clinical reports | `Bedrock` | us-east-1 |
| **Polly** | Text-to-speech voice prompts | `Polly` | ap-south-1 |
| **IAM** | User permissions and access keys | `IAM` | Global |
| **Amplify** | Hosts the Next.js web app | `Amplify` | ap-south-1 |

---

## Troubleshooting

### "AccessDeniedException" errors
- Your IAM user is missing a policy. Go to **IAM → Users → autisense-app → Permissions** and check all 3 policies are attached.

### "ResourceNotFoundException" for DynamoDB
- The table doesn't exist or you're in the wrong region. Check with `aws dynamodb list-tables --region ap-south-1`.

### Bedrock returns errors
- Make sure you enabled model access in **us-east-1** region (Section 5).
- Make sure `BEDROCK_REGION=us-east-1` is in your `.env.local`.

### Google OAuth "redirect_uri_mismatch"
- The redirect URI in Google Cloud Console must exactly match: `http://localhost:3000/api/auth/callback/google` (for local) or your Amplify URL (for production).

### S3 bucket name already taken
- S3 bucket names are globally unique. If `autisense-models` is taken, try `autisense-models-yourname` and update `S3_MODELS_BUCKET` in `.env.local`.

### App works locally but not on Amplify
- Double-check all environment variables are set in Amplify console.
- Make sure custom headers (COOP/COEP) are added.
- Trigger a fresh redeploy after changing env vars.
