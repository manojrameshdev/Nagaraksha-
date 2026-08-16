# Codebase Structure

**Analysis Date:** 2026-08-16

## Directory Layout

```
nagraksha/
├── backend/           # FastAPI Python backend
│   ├── app/           # Application code
│   │   ├── routes/    # API route modules (17)
│   │   └── *.py       # Core modules (main, database, domain, eventbus, …)
│   ├── tests/         # Pytest suite (103 collected)
│   ├── db/            # SQLite runtime DB (gitignored)
│   ├── chroma_db/     # ChromaDB vector index (gitignored)
│   ├── seed_demo.py   # Karnataka demo seed script
│   ├── requirements.txt
│   └── Dockerfile     # python:3.11-slim image
├── frontend/          # Next.js 16 / React 19 app (pnpm)
│   ├── app/           # App Router pages + layout
│   ├── components/    # React components (nagraksha/, feature/, ui/, __tests__/)
│   ├── hooks/         # Client hooks (auth, geolocation, websocket)
│   ├── lib/           # API client + shared types + utils (+ __tests__/)
│   ├── store/         # Zustand stores
│   ├── test/          # MSW handlers + vitest setup
│   ├── public/        # Static assets (icons, placeholders)
│   ├── pnpm-workspace.yaml
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
- Contains: `main.py` (app factory/lifespan), `database.py` (SQLite schema + helpers), `domain.py` (geo/dispatch/capability-gap/ranking helpers), `eventbus.py` (outbox worker + audit), `dispatch.py` (Twilio SMS), `llm.py` (local/cloud LLM chain), `rag.py` (ChromaDB retrieval), `compliance.py` (hospital scoring), `auth.py` (JWT), `models.py` (Pydantic), `limiter.py` (shared slowapi Limiter), `scheduler.py` (APScheduler), `seed.py` + `knowledge_base_data.py` (seed data)
- Key files: `main.py`, `database.py`, `eventbus.py`, `domain.py`
- Subdirectories: `routes/`

**backend/app/routes/:**
- Purpose: One router module per feature area
- Contains: `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `architecture.py`, `ops.py` (audit + KB), `transcribe.py`, `wound.py`, `audit.py` (ASHA village audit), `stakeholders.py`, `twilio_webhook.py`, `venom_score.py` (PtosisReading), `referrals.py` (Care Corridor), `ws.py`
- Key files: `sos.py`, `referrals.py`, `venom_score.py`, `ws.py`

**backend/tests/:**
- Purpose: Pytest suite (103 collected)
- Contains: `conftest.py` (temp DB + background mocks), `test_routes.py` (40), `test_domain.py` (44), `test_compliance.py` (6), `test_rag.py` (5), `test_eventbus.py` (2), `test_seed_demo.py` (7)
- Key files: `conftest.py`, `test_domain.py`, `test_routes.py`

**frontend/app/:**
- Purpose: Next.js App Router pages
- Contains: `layout.tsx`, `page.tsx` (role workspace + SOS), `globals.css`, `manifest.ts`, and feature pages `dashboard/`, `hospitals/`, `incidents/[id]/`, `myth-buster/`, `risk/`
- Key files: `page.tsx`, `incidents/[id]/page.tsx` (incident tracking + Care Corridor timeline)

**frontend/components/:**
- Purpose: React components
- Contains: `nagraksha/` (shell.tsx, workspaces.tsx, shared.tsx — role workspaces, dispatch lanes, first-aid checklist, risk cards), feature components (`care-corridor-timeline.tsx`, `dispatch-actions.tsx`, `health-indicator.tsx`, `stock-update.tsx`, `symptom-logger.tsx`, `venom-score.tsx`, `venom-score-chart.tsx`), `ui/` (shadcn-style `button.tsx`), `__tests__/` (component tests)
- Key files: `care-corridor-timeline.tsx`, `venom-score.tsx`, `nagraksha/workspaces.tsx`

**frontend/hooks/:**
- Purpose: Reusable client hooks
- Contains: `use-auth.ts` (login/logout + localStorage), `use-geolocation.ts`, `use-incident-socket.ts` (WS lifecycle)
- Key files: `use-incident-socket.ts`

**frontend/lib/:**
- Purpose: Data-access layer + shared utilities
- Contains: `api.ts` (apiFetch + ApiError), `nagraksha.ts` (typed API functions + response types, incl. referral/corridor types), `realtime.ts` (WebSocket client with dispatch + venom + referral event union), `utils.ts` (`cn`), `__tests__/` (api.test.ts, nagraksha.test.ts)
- Key files: `api.ts`, `nagraksha.ts`

**frontend/store/:**
- Purpose: Zustand global state
- Contains: `sos-store.ts` (triggerSos, incident, dispatch lanes, `corridorTimeline`/`activeReferral`, WS event handling, `fetchCorridorTimeline`)
- Key files: `sos-store.ts`

**frontend/test/:**
- Purpose: Vitest/MSW test infrastructure
- Contains: `handlers.ts` (MSW request handlers mirroring backend, incl. referral/corridor endpoints), `setup.ts` (server lifecycle)
- Key files: `handlers.ts`

**scripts/:**
- Purpose: Dev tooling
- Contains: `dev.sh` (concurrent backend + frontend dev)

**.github/workflows/:**
- Purpose: CI
- Contains: `ci.yml` (backend-test, frontend-build, gatekeeper)

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app, lifespan init, router mounting (17 routers)
- `frontend/app/page.tsx`: home/role workspace + SOS
- `frontend/app/layout.tsx`: root layout + metadata

**Configuration:**
- `frontend/tsconfig.json`: strict TS, `@/*` alias
- `frontend/next.config.mjs`: build config (type-check gate)
- `frontend/eslint.config.mjs`: ESLint flat config
- `frontend/vitest.config.ts`: test runner config
- `frontend/pnpm-workspace.yaml`: pnpm catalog/workspace config
- `.prettierrc` / `.prettierignore`: formatting
- `.bandit.yaml`: backend security scan config
- `.env.example` / `frontend/.env.example`: env templates
- `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`: container config

**Core Logic:**
- `backend/app/database.py`: schema (incl. `Referral`, `PtosisReading`) + connection helpers
- `backend/app/domain.py`: haversine, ETA, stock freshness, dispatch simulation, VenomScore classification, `evaluate_capability_gap`, `rank_capable_hospitals`
- `backend/app/eventbus.py`: outbox worker + pub/sub + audit (incl. referral events)
- `backend/app/routes/referrals.py`: Care Corridor referral lifecycle + 8-stage timeline
- `backend/app/routes/venom_score.py`: PtosisReading ingestion
- `backend/app/dispatch.py`: Twilio SMS dispatch
- `backend/app/rag.py` + `backend/app/llm.py`: RAG + LLM fallback chain
- `frontend/lib/api.ts` + `frontend/lib/nagraksha.ts`: typed API client
- `frontend/store/sos-store.ts`: SOS + corridor state machine

**Testing:**
- `backend/tests/`: pytest suite (103)
- `frontend/lib/__tests__/`: vitest unit + MSW integration tests
- `frontend/components/__tests__/`: component tests (venom-score, care-corridor-timeline)
- `frontend/test/handlers.ts`: MSW request handlers

**Documentation:**
- `docs/`: PRD, SRS, System Design, wireframes, brand guide (docx/pptx/txt)
- `.planning/`: GSD planning artifacts (PROJECT.md, ROADMAP.md, phases/, codebase/)
- `README.md`: quick-start guide

## Naming Conventions

**Files:**
- `snake_case.py` for Python modules (`backend/app/routes/referrals.py`)
- `kebab-case.ts(x)` for frontend files (`frontend/store/sos-store.ts`, `frontend/hooks/use-auth.ts`)
- `PascalCase.tsx` for React components (`frontend/components/care-corridor-timeline.tsx` is kebab; components inside use PascalCase exports)
- `*.test.ts` / `*.test.tsx` for test files (`frontend/components/__tests__/care-corridor-timeline.test.tsx`)
- `test_*.py` for backend tests (`backend/tests/test_domain.py`)

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
- Tests: `frontend/components/__tests__/` (or `frontend/lib/__tests__/` + `frontend/test/handlers.ts` for MSW) + `backend/tests/test_<feature>.py`
- Config if needed: extend `backend/app/database.py` schema (idempotent `CREATE TABLE IF NOT EXISTS`)

**New Component/Module:**
- Implementation: `frontend/components/` (feature) or `frontend/components/ui/` (primitive)
- Types: `frontend/lib/nagraksha.ts` (API shapes) or local `interface`
- Tests: `frontend/components/__tests__/` pattern

**New Route/Command:**
- Definition: `backend/app/routes/<name>.py` with `APIRouter()`, then register in `backend/app/main.py` (`app.include_router(...)`)
- Handler: route module function; models in `backend/app/models.py`
- Tests: `backend/tests/test_routes.py` (or new file)

**New Referral/Corridor Flow:**
- Domain rules: pure functions in `backend/app/domain.py` (`evaluate_capability_gap`, `rank_capable_hospitals`)
- Lifecycle: extend `Referral` status CHECK constraint + `backend/app/routes/referrals.py` guarded transitions + outbox event in `backend/app/eventbus.py`
- Broadcast: add event name to WS union in `frontend/lib/realtime.ts` (uppercase for new telemetry/referral events)

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

*Structure analysis: 2026-08-16*
*Update when directory structure changes*
