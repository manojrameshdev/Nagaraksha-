# Technology Stack

**Analysis Date:** 2026-08-14

## Languages

**Primary:**
- Python 3.10+ — Backend API server. Required version enforced in `setup.py` (`python setup.py`) and `start.py`. Docker/CI pin 3.11 (`backend/Dockerfile`, `.github/workflows/ci.yml`); local env tested on 3.13.5.
- TypeScript 5.7.3 — Frontend app (`frontend/tsconfig.json`, `frontend/package.json`).

**Secondary:**
- SQL — Raw SQLite DDL and queries in `backend/app/database.py` (no ORM).
- Shell — Dev orchestration in `scripts/dev.sh`, `setup.py`, `start.py`.
- CSS — Tailwind 4 via `frontend/app/globals.css` and `frontend/postcss.config.mjs`.

## Runtime

**Environment:**
- Python 3.10+ (backend) — runs FastAPI under uvicorn.
- Node.js 20+ (frontend) — runs Next.js. Local env: v22.19.0.

**Package Manager:**
- npm 9.x/10.x — Root tooling (`package.json`, `package-lock.json` at repo root) and CI (`npm ci` in `.github/workflows/ci.yml`).
- pnpm — Frontend uses `frontend/pnpm-lock.yaml` (lockfile present; `frontend/package.json` has a `pnpm.overrides` block pinning `hono` to 4.12.25). Note: no `frontend/package-lock.json` exists, yet CI runs `npm ci` with `cache-dependency-path: frontend/package-lock.json` (see `.github/workflows/ci.yml:48`) — a known CI drift.
- pip — Backend deps from `backend/requirements.txt`.

**Lockfiles:**
- Root: `package-lock.json` (present).
- Frontend: `pnpm-lock.yaml` (present); `package-lock.json` (missing).
- Backend: no lockfile, version ranges in `backend/requirements.txt`.

## Frameworks

**Core:**
- FastAPI 0.128.0 — Backend web framework (`backend/app/main.py`). Served by `uvicorn[standard] 0.44.0`.
- Next.js 16.3.0 — Frontend framework (`frontend/package.json`), App Router, `app/` directory, RSC layout (`frontend/app/layout.tsx`) with a single `'use client'` page (`frontend/app/page.tsx`).
- React 19 (19.2.4 resolved) — UI library (`react`, `react-dom`).
- Tailwind CSS 4.3.3 — Styling (`@tailwindcss/postcss`, `tailwindcss`).
- shadcn/ui — Component system (base-nova style), configured in `frontend/components.json`, uses `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`.

**Testing:**
- pytest — Backend tests in `backend/tests/` (`conftest.py`, `test_routes.py`, `test_rag.py`, `test_eventbus.py`, `test_domain.py`, `test_compliance.py`). CI installs `pytest pytest-cov pytest-asyncio` (`.github/workflows/ci.yml:25`).
- Vitest — Referenced in CI (`npx vitest run`, `.github/workflows/ci.yml:58`) but NO `vitest.config.*` and NO test files exist in the current `frontend/` — the frontend was rebuilt as a static demo layer (see `frontend/components/nagraksha/*`). The prior Vitest setup is documented in `.planning/debug/ci-frontend-setup-missing.md`.
- bandit 1.8.0+ — Python security linting (`backend/requirements.txt`), config in `.bandit.yaml` (skips B101, B110, B311; excludes frontend/docs/model).
- ruff 0.5.0+ — Python linting (`backend/requirements.txt`); CI runs `ruff check backend/app`.

**Build/Dev:**
- ESLint — `eslint-config-next` 16.2.12 + `eslint-plugin-security` 4.0.1 + `typescript-eslint` 8.65.0 at root (`package.json`). The root lint-staged hook references `frontend/eslint.config.mjs` (root `package.json:20`), but **that file does not exist** in the current tree — `frontend` also has no eslint config. `npm run lint` (`cd frontend && eslint .`) would fail without config.
- Prettier 3.9.6 — Formatting. Config at `.prettierrc` (semi, singleQuote, tabWidth 2, trailingComma all, printWidth 100, endOfLine lf) + `.prettierignore`.
- Husky 9 + lint-staged 16 — pre-commit hook at `.husky/pre-commit` runs `npx lint-staged`.
- Docker / docker-compose — `docker-compose.yml` defines `backend` (build from `backend/Dockerfile`) and `frontend` (build context `./frontend` but **no `frontend/Dockerfile` exists**).

## Key Dependencies

**Critical (backend — `backend/requirements.txt`):**
- `fastapi==0.128.0` — REST API framework.
- `uvicorn[standard]==0.44.0` — ASGI server.
- `pydantic>=2.0` — Request/response validation (`backend/app/models.py`).
- `chromadb>=0.5.0` — Vector DB for RAG semantic retrieval (`backend/app/rag.py`), uses `DefaultEmbeddingFunction` (ONNX-based, no PyTorch).
- `scikit-learn>=1.5.2` — TF-IDF fallback retrieval when ChromaDB unavailable (`backend/app/rag.py`).
- `numpy>=1.26` — Vector math for TF-IDF scoring.
- `apscheduler>=3.10.0` — Background compliance job every 15 min (`backend/app/scheduler.py`).
- `python-jose[cryptography]>=3.3.0` — JWT signing/verification (HS256) (`backend/app/auth.py`).
- `slowapi>=0.1.9` — Rate limiting (`backend/app/main.py`, default 200/min, 10/min on token endpoint).
- `twilio>=9.0.0` — Real SMS dispatch + webhook signature validation (`backend/app/dispatch.py`, `backend/app/routes/twilio_webhook.py`).
- `sentry-sdk[fastapi]>=2.0.0` — Error monitoring (`backend/app/main.py`).
- `httpx>=0.27` — Outbound LLM API calls (`backend/app/llm.py`, `backend/app/routes/snake_id.py`, `backend/app/routes/transcribe.py`).
- `python-dotenv>=1.0` — Loads `.env` (`backend/app/main.py:14`).
- `python-multipart>=0.0.9` — Form/file uploads (responders, wound images, audio).
- Optional (NOT in requirements, loaded lazily): `llama-cpp-python` for local GGUF inference (`backend/app/llm.py:53`).

**Critical (frontend — `frontend/package.json`):**
- `next@16.3.0`, `react@^19`, `react-dom@^19` — App runtime.
- `@vercel/analytics@1.6.1` — Analytics in production builds (`frontend/app/layout.tsx:43`).
- `@base-ui/react@^1.5.0` — Headless UI primitives for shadcn (base-nova style).
- `lucide-react@^1.16.0` — Icons.
- `shadcn@^4.8.0` — CLI/component library tooling.
- `tailwindcss@^4.3.3`, `@tailwindcss/postcss`, `postcss` — Styling pipeline.
- `typescript@5.7.3` — Type checking.
- `@types/node@^24`, `@types/react@^19`, `@types/react-dom@^19` — Type definitions.

**Infrastructure (root — `package.json` devDependencies):**
- `eslint-config-next`, `eslint-plugin-security`, `typescript-eslint` — Linting.
- `husky`, `lint-staged` — Git hooks.
- `prettier` — Formatting.

## Configuration

**Environment:**
- `.env` file at repo root (created by `python setup.py` copying `.env.example`). `.env` is gitignored; `.env.example` is committed.
- Loaded by `python-dotenv` in `backend/app/main.py:14`.
- Key vars: `GEMINI_API_KEY`, `GROQ_API_KEY`, `GROK_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `JWT_SECRET`, `ROLE_SECRET_VICTIM`/`ROLE_SECRET_HOSPITAL`/`ROLE_SECRET_ADMIN`, `SENTRY_DSN`, `NEXT_PUBLIC_BACKEND_URL`, `FRONTEND_URL`, `NAGRAKSHA_DB`, `ENV`, `AUTH_ENFORCED`. Full list in `.env.example`.
- `docker-compose.yml` passes backend env vars through from the host `.env` and sets `NEXT_PUBLIC_BACKEND_URL=http://backend:8000` for the frontend container.

**Build:**
- `frontend/next.config.mjs` — `typescript.ignoreBuildErrors: true`, `images.unoptimized: true` (notable: type errors do NOT fail the build).
- `frontend/tsconfig.json` — strict mode, `@/*` path alias → `./*`, `moduleResolution: bundler`.
- `frontend/postcss.config.mjs` — Tailwind 4 PostCSS plugin.
- `backend/Dockerfile` — `python:3.11-slim`, installs requirements, runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- `frontend/Dockerfile` — **Missing**, though `docker-compose.yml` references it.
- `.bandit.yaml` — Bandit exclusions/skips.

## Platform Requirements

**Development:**
- Python 3.10+ (3.11 recommended for parity with Docker/CI) and Node.js 20+ required (`setup.py` checks both).
- `python setup.py` performs: prerequisite check → `.env` creation → backend pip install → frontend npm install → DB + RAG seed via `app.seed.run()`.
- `python start.py` starts backend (`uvicorn app.main:app --port 8000`) and frontend (`next dev -p 3000 --webpack`), with `--status`/`--stop`.
- `npm run dev` at root delegates to `scripts/dev.sh` (bash) — POSIX-only; Windows users use `python start.py`.
- Wound analysis pipeline assumes 640x480 frames (`backend/app/llm.py:251`).

**Production:**
- Docker Compose (`docker-compose.yml`): backend on :8000, frontend on :3000, named volume `backend_data` mounted at `/app/chroma_db` for the vector DB.
- Backend `ENV=production` refuses demo/placeholder secrets at startup (`backend/app/auth.py:32-37,47-52`).
- `AUTH_ENFORCED=true` (or `ENV=production`) enables role enforcement on mutating routes (`backend/app/auth.py:63-66`).
- CORS allowlist in `backend/app/main.py:68-73` — localhost:3000, 127.0.0.1:3000, plus `FRONTEND_URL`.
- CI: GitHub Actions `.github/workflows/ci.yml` — backend ruff + py_compile + pytest on Ubuntu; frontend install + vitest + lint + Next build on Node 20.

---

*Stack analysis: 2026-08-14*
