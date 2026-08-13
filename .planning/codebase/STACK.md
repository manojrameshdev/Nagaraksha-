# Technology Stack

**Analysis Date:** 2026-08-13

## Languages

**Primary:**
- Python 3.11 - Backend API, domain logic, RAG pipeline (`backend/app/*.py`)
- TypeScript 5.x - Frontend application code, hooks, stores (`frontend/src/*`)

**Secondary:**
- JavaScript - Next.js config, service worker (`frontend/next.config.ts`, `frontend/public/sw.js`)
- CSS - Tailwind CSS v4 utility classes (`frontend/src/app/globals.css`)
- SQL - Raw SQLite DDL/queries embedded in Python (`backend/app/database.py`)

## Runtime

**Environment:**
- Python 3.11 (Docker: `backend/Dockerfile`; CI: `.github/workflows/ci.yml`)
- Node.js 20 (Docker: `frontend/Dockerfile`; CI: `.github/workflows/ci.yml`)
- Browser (PWA client — service worker + manifest, no server rendering of data)

**Package Manager:**
- npm 10.x (root `package.json`, `frontend/package.json`; lockfile `package-lock.json` present)
- pip (backend — `backend/requirements.txt` pinned; no lockfile)

## Frameworks

**Core:**
- FastAPI 0.128 - Backend web framework + router registration (`backend/app/main.py`)
- Next.js 16.1.1 - Frontend framework, App Router, PWA shell (`frontend/package.json`)
- React 19 - UI library
- uvicorn 0.44 - ASGI server (`scripts/dev.sh`, root `package.json`)

**Testing:**
- pytest - Backend unit/integration tests (`backend/tests/`)
- Vitest 4 - Frontend unit tests (`frontend/vitest.config.ts`)
- Testing Library + jest-dom - Frontend assertions (`frontend/src/test/setup.ts`)

**Build/Dev:**
- TypeScript - Type checking (`frontend/tsconfig.json`, strict mode)
- Tailwind CSS 4 - Styling (`frontend/tailwind.config.ts`, `frontend/postcss.config.mjs`)
- ESLint 9 (flat config) - Linting (`frontend/eslint.config.mjs`)
- Prettier 3 - Formatting (`.prettierrc`)
- Husky + lint-staged - Pre-commit hooks (`.husky/pre-commit`, root `package.json`)
- Ruff + Bandit - Python linting/security (`.bandit.yaml`, CI)

## Key Dependencies

**Critical:**
- chromadb 0.5+ - Semantic RAG retrieval (replaces scikit-learn TF-IDF as primary) (`backend/app/rag.py`)
- scikit-learn 1.5+ - TF-IDF fallback retrieval when ChromaDB unavailable (`backend/app/rag.py`)
- python-jose - JWT role tokens (`backend/app/auth.py`)
- slowapi - Rate limiting (`backend/app/main.py`)
- twilio - Real SMS dispatch (`backend/app/dispatch.py`)
- sentry-sdk - Error monitoring (`backend/app/main.py`)
- apscheduler - Compliance scoring job every 15 min (`backend/app/scheduler.py`)
- httpx - LLM/vision/Whisper API calls (`backend/app/llm.py`, `backend/app/routes/snake_id.py`)

**Frontend infrastructure:**
- zustand 5 - Client state store for SOS flow (`frontend/src/store/sos-store.ts`)
- sonner - Toast notifications
- recharts - Wound severity trend charts (`frontend/src/components/wound-tracker.tsx`)
- shadcn/ui (Radix primitives) - UI component library (`frontend/src/components/ui/`)
- lucide-react - Icons
- framer-motion, tailwind-merge, class-variance-authority - Animation/styling utilities

## Configuration

**Environment:**
- `.env` at project root (gitignored); template at `.env.example` lists: `NEXT_PUBLIC_BACKEND_URL`, `FRONTEND_URL`, `JWT_SECRET`, `ROLE_SECRET_VICTIM/HOSPITAL/ADMIN`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `GROK_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `SENTRY_DSN`, optional `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`SUPABASE_SERVICE_KEY`
- Backend reads env via `python-dotenv` `load_dotenv()` (`backend/app/main.py:13`)
- Frontend reads `NEXT_PUBLIC_BACKEND_URL` at build/runtime (`frontend/src/lib/api.ts:8`)

**Build:**
- `frontend/next.config.ts` - standalone output, strict types, rewrite of `/api/:path*` → `http://127.0.0.1:8000`
- `frontend/tsconfig.json` - strict, `@/*` → `./src/*`
- `.prettierrc`, `frontend/eslint.config.mjs`, `.bandit.yaml`

## Platform Requirements

**Development:**
- Python 3.10+, Node.js 20+, npm (README.md Quick Start)
- `python setup.py` one-step setup, or `scripts/dev.sh` / root `npm run dev` (frontend :3000, backend :8000)
- SQLite file `backend/db/nagraksha.db` created at startup; ChromaDB dir `backend/chroma_db` created at first RAG use

**Production:**
- Docker via `docker-compose.yml` (frontend :3000, backend :8000; `backend_data` volume for `chroma_db`)
- Frontend Dockerfile builds `next build` with `output: 'standalone'`; backend Dockerfile runs uvicorn on 0.0.0.0:8000
- CI: GitHub Actions `.github/workflows/ci.yml` (backend pytest+ruff, frontend build)

---

*Stack analysis: 2026-08-13*
