<div align="center">

# RinKuzu

### Personalized quiz practice from your own PDFs in two modes: instant quiz generation and adaptive learning path.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![License](https://img.shields.io/badge/License-Private-lightgrey)

[Problem](#the-problem) • [Install](#install) • [See It Work](#see-it-work) • [Getting Started](#getting-started) • [How It Works](#how-it-works)

</div>

## The Problem

Learners often have PDF materials but lack a personalized practice path based on their mastery level. If you have used traditional quiz builders before, you are familiar with the “question creation” part; the new aspect of RinKuzu is the addition of an adaptive learning mode that follows a dynamic learning path instead of just doing a static quiz.

RinKuzu addresses this with two clear modes:

1. `PDF -> Quiz`: upload a PDF, extract/build quizzes to publish and practice immediately.
2. `PDF -> Adaptive Learning Path`: upload a PDF, extract concepts + build a knowledge graph, then create a sequence of exercises to master all concepts.

---

## See It Work

```bash
# 1) Frontend
cd /home/linh/Downloads/datn_1/new/data/rinkuzu
npm install
npm run dev

# 2) Open app
# http://localhost:3000

# 3) Mode A: Generate Quiz from PDF
# Login -> Create/Upload -> upload PDF -> app calls /api/quiz/upload-url,
# then extraction endpoint -> review/edit draft -> publish -> play quiz.

# 4) Mode B: Adaptive Learning
# Go to /adaptive-learning/upload -> upload PDF -> processing job starts
# -> open subject/session -> do exercises -> see result page.
```

---

## Install

### Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- MongoDB connection string
- S3-compatible bucket (for PDF storage)
- Optional companion API for adaptive mode and robust quiz extraction:
  - `/home/linh/Downloads/datn_1/new/data/rinkuzu-ai-api`

### 1) Configure environment

Create `.env.local` based on `.env.example` (`/home/linh/Downloads/datn_1/new/data/rinkuzu/.env.example`) and add at least:

```env
MONGODB_URI=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

JWT_SECRET=...
JWT_EXPIRES_IN=30m
SESSION_MAX_AGE=180000

OBJECT_STORAGE_ENDPOINT_EXTERNAL=...
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
OBJECT_STORAGE_BUCKET=...

# Companion adaptive API URL (frontend proxy target)
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
ADAPTIVE_PROXY_TIMEOUT_MS=60000

# Shared internal header token between frontend and adaptive API
INTERNAL_SERVICE_TOKEN=...

# Optional integrations
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
NEXT_PUBLIC_GA_ID=
NEXT_IMAGE_UNOPTIMIZED=false
```

### 2) Run frontend

```bash
cd /home/linh/Downloads/datn_1/new/data/rinkuzu
npm install
npm run dev
```

### 3) (Optional but recommended) Run companion adaptive API

```bash
cd /home/linh/Downloads/datn_1/new/data/rinkuzu-ai-api
pip install -r requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

<details>
<summary><b>What gets called in each mode</b></summary>

- Quiz mode:
  - Frontend requests presigned upload URL: `/api/quiz/upload-url`
  - Frontend sends PDF extraction request via `extractQuizFromS3Key` -> `${NEXT_PUBLIC_API_URL}/api/quiz/extract`
- Adaptive mode:
  - Frontend routes under `/api/adaptive-learning/*` proxy to Python API via `src/lib/adaptive-learning/proxy.ts`
  - Python API handles pipeline/session/history endpoints and model-backed recommendation flow

</details>

---

## Getting Started

1. Run both services (`rinkuzu` and `rinkuzu-ai-api`) for full feature parity.
2. Register/login and upload one PDF in quiz mode.
3. Edit/publish draft and complete one quiz attempt.
4. Open adaptive learning dashboard and upload the same (or another) PDF.
5. Finish one adaptive exercise set and check result page.
6. Verify data persistence in MongoDB (quiz attempts + adaptive sessions).

---

## How It Works

RinKuzu is a Next.js 14 app (App Router) with MongoDB, NextAuth, and an API-proxy integration to a FastAPI adaptive engine. The frontend owns user flow, auth, and quiz UX; the Python service owns heavy content pipeline and SAINT+DQN adaptive decisioning.

<details>
<summary><b>Details</b> - architecture, flow, and key modules</summary>

### Main app (`rinkuzu`)

- Framework/runtime: Next.js 14 + TypeScript
- Auth: NextAuth
- Storage: MongoDB + S3-compatible object storage
- Key integration points:
  - `src/lib/quiz/extractApi.ts`: server-side call to quiz extraction endpoint using `x-user-id` + optional `x-service-token`
  - `src/lib/adaptive-learning/proxy.ts`: authenticated proxy to adaptive backend (`/api/adaptive-learning/*`)
  - `src/app/api/quiz/upload-url/route.ts`: presigned upload URL for PDF (50MB max)

### Companion API (`rinkuzu-ai-api`)

- Framework/runtime: FastAPI
- Entry point: `api/main.py`
- Key routes:
  - `/api/quiz/extract`: extract/generate quiz questions from uploaded PDF
  - `/api/pipeline/process`: process PDF for adaptive pipeline
  - `/api/session/*`, `/api/history/*`, `/api/knowledge/*`
- Adaptive models:
  - SAINT knowledge tracing + Dueling DQN policy (loaded on startup when enabled)

### End-to-end flow (adaptive mode)

1. User uploads PDF from frontend.
2. Frontend proxy forwards upload to Python pipeline.
3. Pipeline extracts concepts and builds knowledge representation.
4. Session manager initializes adaptive environment.
5. Exercise engine serves next questions based on mastery state.
6. Results and history are persisted and shown in dashboard.

</details>

---

## Reference

- Frontend app: `/home/linh/Downloads/datn_1/new/data/rinkuzu`
- Adaptive API: `/home/linh/Downloads/datn_1/new/data/rinkuzu-ai-api`
- Subscription subsystem notes: `docs/SUBSCRIPTION_README.md`
- Duration migration notes: `docs/DURATION_MIGRATION_GUIDE.md`
- SEO runbook: `docs/SEO_TECHNICAL_RUNBOOK.md`

---

## FAQ

### Do I need the Python API to run RinKuzu?

Core UI can run without it, but PDF extraction/adaptive learning features depend on the companion API.

### Which mode should I start with?

Start with quiz mode for fast validation, then enable adaptive mode when you want personalized progression.

### Is there a 50MB PDF limit?

Yes. The upload/extraction flow enforces a 50MB ceiling for PDF inputs.

---

## Contributing

Internal project. Open an issue/plan in `docs/plans/` before major feature refactors.

## License

Private repository. No public redistribution without permission.
