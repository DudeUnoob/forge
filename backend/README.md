# Forge Backend Setup

This backend is an AWS SAM project under `backend/` (not repo root).

## 1) Install required tools

1. Install AWS SAM CLI.
2. Install Docker Desktop (required for `sam local start-api`).
3. Install Node.js 20 LTS (Lambda runtime in this project is `nodejs20.x`).
4. Ensure AWS CLI v2 is installed.

Quick checks:

```bash
sam --version
docker --version
node -v
aws --version
```

## 2) Configure AWS credentials

```bash
aws configure
```

Required:
- `AWS Access Key ID`
- `AWS Secret Access Key`
- `Default region name` (use a Bedrock-supported region for your model)

Verify:

```bash
aws sts get-caller-identity
```

## 3) Enable Bedrock model access

This backend calls Bedrock model:
- `anthropic.claude-3-sonnet-20240229-v1:0`

In AWS Console:
1. Open Amazon Bedrock.
2. Go to Model access.
3. Request/enable access for the configured model in your target region.

If you use a different model, update `BEDROCK_MODEL_ID` in `template.yaml`.

## 4) Install backend dependencies

```bash
cd backend
npm install
```

## 5) Validate and build

Run from `backend/`:

```bash
sam validate
sam build
```

## 6) First deploy (guided)

Run from `backend/`:

```bash
npm run deploy:guided
```

During prompts:
1. Stack Name: e.g. `forge-backend`
2. AWS Region: same region where Bedrock model access is enabled
3. Confirm changes before deploy: `Y`
4. Allow SAM IAM role creation: `Y`
5. Disable rollback: `N` (recommended while debugging)
6. Save args to config: `Y`

After this, future deploys:

```bash
npm run deploy
```

## 7) Get backend API URL

```bash
aws cloudformation describe-stacks \
  --stack-name forge-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

## 8) Connect frontend to backend

In `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://<your-api-id>.execute-api.<region>.amazonaws.com/prod
```

Then run frontend.

## 9) Local development (no deploy)

From `backend/`:

```bash
npm run local
```

This repo config uses port `3001` to match frontend default API base and loads
`env.local.json` so local Lambdas use real AWS resource names.

If your AWS account/region changes, update `env.local.json` (especially
`ARTIFACTS_BUCKET`).

## Common failures and fixes

1. `sam: command not found`
- Install SAM CLI and restart shell.

2. `Template file not found`
- Run commands in `backend/` or pass `-t backend/template.yaml`.

3. `Could not connect to the endpoint URL` (STS/CloudFormation/S3)
- Check internet/VPN/proxy/firewall and AWS region configuration.

4. Bedrock `AccessDeniedException` or model not found
- Enable model access in Bedrock for your deploy region.
- Confirm `BEDROCK_MODEL_ID`.

5. Stack creation fails because resource already exists
- This template uses fixed DynamoDB table names:
  - `forge-repos`
  - `forge-storyboards`
  - `forge-chat-history`
  - `forge-progress`
- Delete conflicting resources, or rename table `TableName` values in `template.yaml`.

6. Frontend works but API calls fail locally
- Ensure backend local API is on `http://localhost:3001`.
- Ensure frontend `NEXT_PUBLIC_API_URL` matches.
