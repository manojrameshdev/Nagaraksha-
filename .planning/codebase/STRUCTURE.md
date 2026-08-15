# Codebase Structure

**Analysis Date:** 2026-08-15

## Directory Layout

```
nagraksha/
├── backend/           # FastAPI Python backend
│   ├── app/           # Application code
│   │   ├── routes/    # API route modules (16)
│   │   └── *.py       # Core modules (main, database, domain, eventbus, …)
│   ├── tests/         # Pytest suite
│   ├── db/            # SQLite runtime DB (gitignored)
│   ├── chroma_db/     # ChromaDB vector index (gitignored)
│   ├── requirements.txt
│   └── Dockerfile     # python:3.11-slim image
├── frontend/          # Next.js 16 / React 19 app (pnpm)
│   ├── app/           # App Router pages + layout
│   ├── components/    # React components (nagraksha/, feature/, ui/)
│   ├── hooks/         # Client hooks (auth, geolocation, websocket)
│   ├── lib/           # API client + shared types + utils
│   ├── store/         # Zustand stores
│   ├── test/          # MSW handlers + vitest setup
│   ├── public/        # Static assets (icons, placeholders)
│   └── package.json   # pnpm manifest
├── .github/workflows/ # CI pipeline
├── .planning/         # GSD planning docs
├── docs/              # Product docs (PRD, SRS, design, …)
├── model/             # Optional local .gguf models (gitignored)
├── scripts/           # Dev launcher scripts
├── setup.py           # One-step env setup
├── start.py           # Dev process manager (backend + frontend)
├── docker-compose.yml # Backend + frontend services
├── .env.example       # Env template
└── .prettierrc        # Shared formatting config
```

## Directory Purposes

**backend/app/:**
- Purpose: FastAPI application
- Contains: `main.py` (app factory/lifespan), `database.py` (SQLite schema + helpers), `domain.py` (geo/dispatch helpers), `eventbus.py` (outbox worker), `dispatch.py` (Twilio SMS), `llm.py` (local/cloud LLM chain), `rag.py` (ChromaDB retrieval), `compliance.py` (hospital scoring), `auth.py` (JWT), `models.py` (Pydantic), `scheduler.py` (APScheduler), `seed.py` + `knowledge_base_data.py` (seed data)
- Key files: `main.py`, `database.py`, `eventbus.py`
- Subdirectories: `routes/`

**backend/app/routes/:**
- Purpose: One router module per feature area
- Contains: `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `architecture.py`, `ops.py` (audit + KB), `transcribe.py`, `wound.py`, `audit.py` (ASHA village audit), `stakeholders.py`, `twilio_webhook.py`, `ws.py`
- Key files: `sos.py`, `incidents.py`, `ws.py`

**backend/tests/:**
- Purpose: Pytest suite (61 tests)
- Contains: `conftest.py` (temp DB + background mocks), `test_routes.py`, `test_domain.py`, `test_compliance.py`, `test_rag.py`, `test_eventbus.py`
- Key files: `conftest.py`

**frontend/app/:**
- Purpose: Next.js App Router pages
- Contains: `layout.tsx`, `page.tsx` (role workspace + SOS), `globals.css`, `manifest.ts`, and feature pages `dashboard/`, `hospitals/`, `incidents/[id]/`, `myth-buster/`, `risk/`
- Key files: `page.tsx`, `incidents/[id]/page.tsx`

**frontend/components/:**
- Purpose: React components
- Contains: `nagraksha/` (shell.tsx, workspaces.tsx, shared.tsx — role workspaces, dispatch lanes, first-aid checklist, risk cards), feature components (`dispatch-actions.tsx`, `health-indicator.tsx`, `stock-update.tsx`, `symptom-logger.tsx`), `ui/` (shadcn-style `button.tsx` only)
- Key files: `nagraksha/workspaces.tsx`, `nagraksha/shared.tsx`

**frontend/hooks/:**
- Purpose: Reusable client hooks
- Contains: `use-auth.ts` (login/logout + localStorage), `use-geolocation.ts`, `use-incident-socket.ts` (WS lifecycle)
- Key files: `use-incident-socket.ts`

**frontend/lib/:**
- Purpose: Data-access layer + shared utilities
- Contains: `api.ts` (apiFetch + ApiError), `nagraksha.ts` (typed API functions + response types), `realtime.ts` (WebSocket client), `utils.ts` (`cn`), `__tests__/` (api.test.ts, nagraksha.test.ts)
- Key files: `api.ts`, `nagraksha.ts`

**frontend/store/:**
- Purpose: Zustand global state
- Contains: `sos-store.ts` (triggerSos, incident, dispatch lanes, WS event handling)
- Key files: `sos-store.ts`

**frontend/test/:**
- Purpose: Vitest/MSW test infrastructure
- Contains: `handlers.ts` (MSW request handlers mirroring backend), `setup.ts` (server lifecycle)
- Key files: `handlers.ts`

**scripts/:**
- Purpose: Dev tooling
- Contains: `dev.sh` (concurrent backend + frontend dev)

**.github/workflows/:**
- Purpose: CI
- Contains: `ci.yml` (backend-test, frontend-build, gatekeeper)

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app, lifespan init, router mounting
- `frontend/app/page.tsx`: home/role workspace + SOS
- `frontend/app/layout.tsx`: root layout + metadata

**Configuration:**
- `frontend/tsconfig.json`: strict TS, `@/*` alias
- `frontend/next.config.mjs`: build config (type-check gate)
- `frontend/eslint.config.mjs`: ESLint flat config
- `frontend/vitest.config.ts`: test runner config
- `.prettierrc` / `.prettierignore`: formatting
- `.bandit.yaml`: backend security scan config
- `.env.example` / `frontend/.env.example`: env templates
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`: container config

**Core Logic:**
- `backend/app/database.py`: schema + connection helpers
- `backend/app/domain.py`: haversine, ETA, stock freshness, dispatch simulation
- `backend/app/eventbus.py`: outbox worker + pub/sub + audit
- `backend/app/dispatch.py`: Twilio SMS dispatch
- `backend/app/rag.py` + `backend/app/llm.py`: RAG + LLM fallback chain
- `frontend/lib/api.ts` + `frontend/lib/nagraksha.ts`: typed API client
- `frontend/store/sos-store.ts`: SOS state machine

**Testing:**
- `backend/tests/`: pytest suite
- `frontend/lib/__tests__/`: vitest unit + MSW integration tests
- `frontend/test/handlers.ts`: MSW request handlers

**Documentation:**
- `docs/`: PRD, SRS, System Design, wireframes, brand guide (docx/pptx/txt)
- `.planning/`: GSD planning artifacts (PROJECT.md, ROADMAP.md, phases/, codebase/)
- `README.md`: quick-start guide

## Naming Conventions

**Files:**
- `snake_case.py` for Python modules (`backend/app/routes/sos.py`)
- `kebab-case.ts(x)` for frontend files (`frontend/store/sos-store.ts`, `frontend/hooks/use-auth.ts`)
- `PascalCase.tsx` for React components (`frontend/components/dispatch-actions.tsx` is kebab; components inside use PascalCase exports)
- `*.test.ts` / `*.test.tsx` for test files (`frontend/lib/__tests__/api.test.ts`)
- `test_*.py` for backend tests (`backend/tests/test_routes.py`)

**Directories:**
- `snake_case` for Python packages; singular nouns for route modules
- `kebab-case` for frontend dirs (`myth-buster`, `incidents/[id]`)
- Route params as dynamic segments (`frontend/app/incidents/[id]/`)

**Special Patterns:**
- `__tests__/` for collocated frontend test dirs
- `test/` for shared test infra (`frontend/test/`)
- `@/*` alias → frontend root (`@/lib/nagraksha`, `@/components/ui/button`)
- `components/ui/` reserved for shadcn-style primitives

## Where to Add New Code

**New Feature:**
- Primary code: `frontend/app/<feature>/page.tsx` + `frontend/components/` + backend `backend/app/routes/<feature>.py`
- Tests: `frontend/lib/__tests__/` (or `frontend/test/handlers.ts` for MSW) + `backend/tests/test_<feature>.py`
- Config if needed: extend `backend/app/database.py` schema (idempotent `CREATE TABLE IF NOT EXISTS`)

**New Component/Module:**
- Implementation: `frontend/components/` (feature) or `frontend/components/ui/` (primitive)
- Types: `frontend/lib/nagraksha.ts` (API shapes) or local `interface`
- Tests: `frontend/lib/__tests__/` pattern

**New Route/Command:**
- Definition: `backend/app/routes/<name>.py` with `APIRouter()`, then register in `backend/app/main.py` (`app.include_router(...)`)
- Handler: route module function; models in `backend/app/models.py`
- Tests: `backend/tests/test_routes.py` (or new file)

**Utilities:**
- Shared helpers: `frontend/lib/utils.ts` (frontend), `backend/app/domain.py` (backend)
- Type definitions: `frontend/lib/nagraksha.ts`

## Special Directories

**backend/db/:**
- Purpose: Runtime SQLite database
- Source: created by `init_db()` / `seed.py`
- Committed: No (`backend/db/` in `.gitignore`)

**backend/chroma_db/:**
- Purpose: ChromaDB vector index
- Source: rebuilt from `knowledge_base_data.py` on startup (`ensure_kb_seeded`)
- Committed: No (`.gitignore`)

**model/:**
- Purpose: Optional local GGUF model files for offline LLM
- Source: user-placed
- Committed: No (`/model/*.gguf` gitignored; only `.gitkeep` tracked)

**docs/:**
- Purpose: Product artifacts (docx/pptx/txt)
- Committed: Yes; excluded from Prettier via `.prettierignore`

**nag-raksha.zip (repo root):**
- Purpose: Untracked snapshot bundle of an older frontend layout (contains `app/`, `globals.css`, etc.)
- Committed: No — untracked; consider deleting or gitignoring

---

*Structure analysis: 2026-08-15*
*Update when directory structure changes*
