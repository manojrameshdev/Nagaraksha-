# Technology Stack

**Analysis Date:** 2026-08-11

## Languages

**Primary:**
- TypeScript ~5 — frontend application, `frontend/src/` (App Router, server + client components, UI library, tests)
- Python 3.10+ — backend service, `backend/app/` (FastAPI, RAG, LLM orchestration, raw SQLite)

**Secondary:**
- CSS — Tailwind CSS v4 with CSS variables, `frontend/src/app/globals.css`
- Bash / PowerShell — dev launcher scripts, `scripts/dev.sh`, `backend/run.sh`, `start.py` (cross-platform Python orchestrator)
- SQL — inline DDL in `backend/app/database.py` and `frontend/prisma/schema.prisma`

## Runtime

**Environment:**
- Node.js 20+ (v22.19.0 on dev machine) — required by `frontend/package.json` engine usage and `setup.py` check
- Python 3.10+ (3.13.5 on dev machine) — `backend/requirements.txt`; CI uses 3.11
- Bun — production server for the standalone Next.js build (`frontend/package.json` `start` script); `frontend/bun.lock` committed

**Package Manager:**
- npm — root `package.json` + `package-lock.json`, `frontend/package-lock.json` (CI uses `npm ci`)
- bun — `frontend/bun.lock` (alternative lockfile; `npm` and `bun` both supported per `README.md`)
- pip — Python deps via `backend/requirements.txt` (pinned: `fastapi==0.128.0`, `uvicorn==0.44.0`, `scikit-learn==1.5.2`; others use `>=`)

## Frameworks

**Core:**
- Next.js 16.2.12 — frontend framework, App Router, `output: 'standalone'`, React Strict Mode, `/api/*` rewrites to backend (`frontend/next.config.ts`)
- React 19.2.8 — UI runtime (`frontend/package.json`)
- FastAPI 0.128.0 — backend REST API (`backend/app/main.py`), CORS for localhost:3000
- Uvicorn 0.44.0 — ASGI server, port 8000 (`backend/run.sh`, `start.py`)
- Tailwind CSS 4 — styling via `@tailwindcss/postcss` (`frontend/postcss.config.mjs`, `frontend/tailwind.config.ts`)
- shadcn/ui (new-york style) — component library built on Radix UI primitives (`frontend/components.json`, `frontend/src/components/ui/`)

**Data / ORM:**
- Prisma 6.19.3 — SQLite ORM in the Next.js layer (`frontend/prisma/schema.prisma`, `frontend/src/lib/db.ts`)
- sqlite3 (stdlib) — raw SQL data layer in the Python backend (`backend/app/database.py`); schema mirrors the Prisma schema

**AI / RAG:**
- scikit-learn 1.5.2 — TF-IDF vectorization + cosine similarity retrieval (`backend/app/rag.py`)
- llama-cpp-python >=0.3 — local GGUF model inference (`backend/app/llm.py`)
- httpx >=0.27 — sync/async HTTP client for cloud LLM + vision + transcription APIs (`backend/app/llm.py`, `backend/app/routes/snake_id.py`, `backend/app/routes/transcribe.py`)

**Testing:**
- Vitest 4.1.10 — frontend unit tests, jsdom + Testing Library (`frontend/vitest.config.ts`, `frontend/src/lib/__tests__/`)
- pytest + pytest-asyncio — backend tests (`backend/tests/`, installed ad-hoc in CI, `backend/requirements.txt` does not list pytest)
- Bandit >=1.8.0 — Python security scanner, config `/.bandit.yaml`

**Build/Dev:**
- ESLint 9 + `eslint-config-next` + `eslint-plugin-security` + `typescript-eslint` — `frontend/eslint.config.mjs`
- Prettier 3.9.6 — `/.prettierrc` (semi, singleQuote, tabWidth 2, trailingComma all, printWidth 100, endOfLine lf)
- Husky 9 + lint-staged — pre-commit hook `/.husky/pre-commit` runs `npx lint-staged`
- TypeScript 5 — `frontend/tsconfig.json` (strict, `@/*` → `./src/*`, moduleResolution bundler)

## Key Dependencies

**Critical:**
- `@prisma/client` 6.19.3 + `prisma` 6.19.3 — the Next.js data layer (`frontend/package.json`)
- `next` 16.2.12 — server/client rendering, rewrites, standalone build
- `fastapi` + `uvicorn` — backend serving
- `scikit-learn` — RAG retrieval; no vector DB, TF-IDF in memory
- `llama-cpp-python` — local offline LLM (first in the provider fallback chain)
- Radix UI primitives (`@radix-ui/react-*`, ~30 packages) — all UI primitives in `frontend/src/components/ui/`

**Infrastructure:**
- `framer-motion` 12.23.2 — animations (`frontend/src/components/`)
- `lucide-react` 0.525.0 — icons (iconLibrary in `frontend/components.json`)
- `sonner` 2.0.6 — toast notifications
- `react-hook-form` + `@hookform/resolvers` + `zod` — forms (`frontend/package.json`; zod resolves at `frontend/node_modules/zod`)
- `next-themes` 0.4.6 — dark mode (`darkMode: 'class'` in `frontend/tailwind.config.ts`)
- `date-fns` 4.1.0, `cmdk` 1.1.1, `class-variance-authority`, `clsx`, `tailwind-merge`
- `python-dotenv` — loads `.env` at backend startup (`backend/app/main.py`)

## Configuration

**Environment:**
- `.env` file present at repo root (copied from `.env.example` by `python setup.py`); contents never committed (gitignored)
- `.env.example` documents: `GROK_API_KEY`, `GEMINI_API_KEY`, `NAGRAKSHA_DB`, commented `DATABASE_URL` (Postgres) and `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`
- Backend reads env via `python-dotenv` (`backend/app/main.py:9-11`) and `os.environ` in `backend/app/database.py`, `backend/app/llm.py`, `backend/app/routes/*.py`

**Build:**
- `frontend/next.config.ts` — `output: 'standalone'`, `typescript.ignoreBuildErrors: false`, `reactStrictMode: true`, rewrites `/api/:path*` → `http://127.0.0.1:8000/api/:path*`
- `frontend/tsconfig.json` — strict mode, path alias `@/*`
- `frontend/postcss.config.mjs` — `@tailwindcss/postcss`
- `frontend/vitest.config.ts` — jsdom, globals, setup `src/test/setup.ts`, `@` alias
- `/.bandit.yaml` — backend scanning: excludes `.git`, `node_modules`, `.next`, `.planning`, `docs`, `model`, `frontend`; skips B101, B110, B311; medium severity
- `frontend/prisma/schema.prisma` — SQLite provider, `DATABASE_URL` env, 10 models

## Platform Requirements

**Development:**
- Python 3.10+, Node.js 20+, npm or bun (`python setup.py` validates both)
- SQLite (bundled with Python, no server install)
- Ports 3000 (Next.js) and 8000 (FastAPI); `python start.py` launches both with health polling (`start.py`), Windows + Unix process stop handling
- GGUF model optional — drop into `model/` for offline LLM (gitignored: `/model/*.gguf`)

**Production:**
- Next.js standalone output (`frontend/.next/standalone`) served by `bun` (`frontend/package.json` `start`)
- Caddy reverse proxy/gateway expected (frontend calls use relative paths + `?XTransformPort=8000` per `frontend/src/lib/api.ts`); domain `nagraksha.app` in metadata (`frontend/src/app/layout.tsx`)
- PostgreSQL + PostGIS documented as production DB target (`README.md`, `docs/`)
- CI on GitHub Actions, ubuntu-latest, Node 20, Python 3.11 (`.github/workflows/ci.yml`)

---

*Stack analysis: 2026-08-11*
