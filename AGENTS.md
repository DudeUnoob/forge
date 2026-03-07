# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Forge is an AI-powered codebase onboarding platform. It has two main services:

- **Frontend** (`frontend/`): Next.js 16 + React 19 app on port 3000
- **Backend** (`backend/`): AWS SAM (Lambda + API Gateway) on port 3001 locally

See `README.md`, `backend/README.md`, and `frontend/README.md` for full details.

### Running the frontend

```bash
cd frontend && npm run dev
```

The root directory also has a `package.json` with `next dev`, but the actual frontend source is in `frontend/`. Always run from `frontend/`.

### Running the backend (requires AWS)

The backend uses `sam local start-api` which requires **Docker** and **AWS credentials** (real DynamoDB, S3, Bedrock). There is no local database emulation.

```bash
cd backend && npm run local
```

This needs `backend/env.local.json` (gitignored) with table names, bucket, and model ID. See `backend/README.md` section 9 for details.

### Linting

- **Frontend**: `cd frontend && npx eslint` (uses `eslint.config.mjs` in `frontend/`)
- **Backend**: Has `npm run lint` (`eslint src/`) but no dedicated ESLint config — it inherits the root Next.js ESLint config, causing errors. This is a known pre-existing issue.

### Testing

- **Backend**: `cd backend && npm test` — uses Jest with `--experimental-vm-modules`. Currently no test files exist.
- **Frontend**: No test framework configured.

### Build

```bash
cd frontend && npm run build
```

### Gotchas

- The root `package.json` is a minimal copy of the frontend's; the real frontend with all dependencies is in `frontend/`.
- The root `package-lock.json` covers only the root `package.json`. Each of `frontend/` and `backend/` need separate `npm install`.
- `frontend/package-lock.json` is gitignored (via `frontend/.gitignore`), so `npm install` in `frontend/` generates a fresh lockfile each time.
- The backend needs real AWS resources (DynamoDB tables, S3 bucket, Bedrock model access) even for local development — there is no mocked/local alternative.
