# Technology Stack

**Analysis Date:** 2026-08-15

## Languages

**Primary:**
- Python 3.11 - Backend API, domain logic, RAG, SMS dispatch (`backend/app/`)
- TypeScript 5.7.3 - All frontend application code (`frontend/`)
- SQL - SQLite schema in `backend/app/database.py`

**Secondary:**
- JavaScript - Next.js config files (`frontend/next.config.mjs`, `frontend/eslint.config.mjs`)
- Bash - Dev/CI scripts (`scripts/dev.sh`, `backend/run.sh`, `.github/workflows/ci.yml`)

## Runtime

**Environment:**
- Python 3.10+ (3.11 used in CI and Docker) - backend via uvicorn
- Node.js 20+ - frontend (CI pins 20, Docker `node:20-alpine`)
- Browser - Next.js client components (React 19)

**Package Manager:**
- pip - backend (`backend/requirements.txt`, pinned core deps)
- pnpm - frontend (lockfile `frontend/pnpm-lock.yaml`, Docker + CI use corepack pnpm)
- npm - repo root (root `package-lock.json`, `package.json` for dev tooling)
- Lockfile: `frontend/pnpm-lock.yaml` present

## Frameworks

**Core:**
- FastAPI 0.128.0 - Python web framework / REST API (`backend/app/main.py`)
- Next.js 16.3.0 - React framework, App Router (`frontend/app/`)
- React 19 - UI library
- uvicorn 0.44.0 - ASGI server

**Testing:**
- Pytest + pytest-asyncio + httpx (ASGITransport) - backend tests (`backend/tests/`)
- Vitest 4.1.10 - frontend unit tests (`frontend/vitest.config.ts`)
- MSW 2.15.0 - API mocking in frontend tests (`frontend/test/handlers.ts`)

**Build/Dev:**
- TypeScript 5.7.3 - strict type checking (`frontend/tsconfig.json`, `noEmit` + `strict`)
- Tailwind CSS 4.3.3 - styling via `@tailwindcss/postcss` (`frontend/postcss.config.mjs`)
- ESLint 9 + typescript-eslint 8 + eslint-plugin-security - frontend lint (`frontend/eslint.config.mjs`)
- Ruff - backend lint (CI gate)
- Bandit - backend security scan (`.bandit.yaml`)
- Prettier 3.9.6 - formatting (root `.prettierrc`)
- Husky 9 + lint-staged - pre-commit hooks (`.husky/pre-commit`)

## Key Dependencies

**Critical:**
- `python-jose` - JWT creation/verification for role auth (`backend/app/auth.py`)
- `twilio` - Real SMS dispatch + webhook signature validation (`backend/app/dispatch.py`, `backend/app/routes/twilio_webhook.py`)
- `chromadb` - Vector store for RAG knowledge base (`backend/app/rag.py`)
- `slowapi` - Rate limiting (default 200/min, 10/min on token endpoint)
- `sentry-sdk[fastapi]` - Error monitoring (enabled when `SENTRY_DSN` set)
- `zustand` 5.0.3 - Client state for SOS/incident tracking (`frontend/store/sos-store.ts`)

**Infrastructure:**
- SQLite (stdlib `sqlite3`, WAL mode) - primary data store (`backend/db/nagraksha.db`)
- `apscheduler` - scheduled compliance scoring job (every 15 min)
- `httpx` - async HTTP client (backend tests, LLM calls)
- `scikit-learn` / `numpy` - TF-IDF fallback for RAG
- `lucide-react`, `class-variance-authority`, `tailwind-merge`, `@base-ui/react`, `tw-animate-css` - UI primitives
- `@vercel/analytics` - production-only analytics

## Configuration

**Environment:**
- Root `.env` file (created from `.env.example` by `setup.py`; gitignored)
- `backend/app/main.py` calls `load_dotenv()`; frontend reads `NEXT_PUBLIC_BACKEND_URL` at build/runtime
- Key vars: `NEXT_PUBLIC_BACKEND_URL`, `FRONTEND_URL`, `JWT_SECRET`, `ROLE_SECRET_VICTIM/HOSPITAL/ADMIN`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `GROK_API_KEY`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`, `SENTRY_DSN`, `ENV`, `NAGRAKSHA_DB`
- Demo secrets are rejected at startup when `ENV=production` (`backend/app/auth.py`)

**Build:**
- `frontend/tsconfig.json` - strict TS, `@/*` path alias
- `frontend/next.config.mjs` - `ignoreBuildErrors: false` (type errors fail builds), images unoptimized
- `frontend/vitest.config.ts` - jsdom env, globals, `@` alias, MSW setup file
- `frontend/eslint.config.mjs` - flat config, `--max-warnings 0` enforced via scripts
- Root `.prettierrc` / `.prettierignore` - shared formatting

## Platform Requirements

**Development:**
- Any OS; Python 3.10+, Node.js 20+, pnpm (corepack) for the frontend
- One-step setup: `python setup.py` (env + deps + DB seed); start via `python start.py` or `npm run dev`
- Docker optional: `docker-compose.yml` runs backend `:8000` + frontend `:3000`

**Production:**
- Docker Compose (backend Python 3.11-slim image, frontend Node 20-alpine multi-stage image)
- Backend binds `0.0.0.0:8000`; frontend binds `3000`, `NEXT_PUBLIC_BACKEND_URL=http://backend:8000` inside compose
- CI: GitHub Actions (`.github/workflows/ci.yml`) - backend lint/test, frontend vitest/eslint/tsc/build, gatekeeper

---

*Stack analysis: 2026-08-15*
*Update after major dependency changes*
