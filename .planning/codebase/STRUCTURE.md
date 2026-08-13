# Codebase Structure

**Analysis Date:** 2026-08-13

## Directory Layout

```
Nagaraksha-/
├── backend/                # Python FastAPI backend (port 8000)
│   ├── app/
│   │   ├── main.py         # App entry: lifespan, Sentry, limiter, CORS, token endpoint, router registration
│   │   ├── database.py     # SQLite schema, migrate_db(), get_conn(), id/time helpers
│   │   ├── domain.py       # Geo math, stock freshness, hospital ranking, dispatch simulation
│   │   ├── auth.py         # JWT role tokens + require_role() dependency factory
│   │   ├── eventbus.py     # Outbox worker thread, in-process bus, audit logger, 3-lane fan-out
│   │   ├── dispatch.py     # Twilio SMS dispatch (currently unused — see CONCERNS.md)
│   │   ├── rag.py          # ChromaDB retrieval + TF-IDF fallback, rag_answer() pipeline
│   │   ├── llm.py          # Local GGUF → Groq → Grok → Gemini chain; wound vision analysis
│   │   ├── compliance.py   # Hospital compliance scoring + badge labels
│   │   ├── scheduler.py    # APScheduler wrapper for the 15-min compliance job
│   │   ├── models.py       # Pydantic request DTOs
│   │   ├── seed.py         # Demo seed: hospitals, stock, risk reports, KB
│   │   ├── knowledge_base_data.py  # Curated KB corpus (seed source)
│   │   ├── routes/         # 16 FastAPI router modules (see Key File Locations)
│   │   └── __init__.py
│   ├── db/                 # Runtime SQLite file (gitignored)
│   ├── chroma_db/          # Runtime ChromaDB vectors (gitignored)
│   ├── tests/              # Pytest: conftest.py, test_domain.py, test_routes.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/               # Next.js 16 PWA (port 3000)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx    # Single-page role-based UI (9 views)
│   │   │   ├── layout.tsx  # Metadata, fonts, SW registration, Toaster
│   │   │   └── globals.css # Tailwind + theme tokens
│   │   ├── components/
│   │   │   ├── ui/         # shadcn/ui primitives (~50 files, excluded from lint)
│   │   │   ├── interactive.tsx    # 10 live panels (1791 lines — see CONCERNS.md)
│   │   │   ├── sections.tsx       # TopAppBar, NavigationDrawer, SiteFooter + dead marketing sections
│   │   │   ├── emergency-guide.tsx, architecture.tsx, wound-tracker.tsx,
│   │   │   │   asha-audit-tool.tsx, district-risk-map.tsx, stakeholder-registry.tsx,
│   │   │   │   hospital-packet.tsx, compliance-badge.tsx, voice-input.tsx,
│   │   │   │   snake-progress.tsx, tri-line-dock.tsx, shader-background.tsx,
│   │   │   │   slither-sprite.tsx, reveal.tsx, lazy-sections.tsx
│   │   ├── hooks/
│   │   │   ├── use-geolocation.ts  # GPS with Bannerghatta fallback
│   │   │   ├── use-scroll.ts, use-mobile.ts, use-toast.ts
│   │   ├── lib/
│   │   │   ├── api.ts      # apiUrl()/wsUrl() from NEXT_PUBLIC_BACKEND_URL
│   │   │   ├── realtime.ts # useIncidentSocket WebSocket hook (unused)
│   │   │   ├── nagraksha.ts # TS mirror of domain.py (tests only)
│   │   │   ├── utils.ts    # cn() helper
│   │   │   └── __tests__/  # eventbus.test.ts (broken), nagraksha.test.ts
│   │   ├── store/
│   │   │   └── sos-store.ts # Zustand store for SOS flow
│   │   └── test/setup.ts   # Vitest jest-dom setup
│   ├── public/
│   │   ├── sw.js           # Service worker (app shell cache, NetworkOnly for API)
│   │   ├── manifest.webmanifest, offline.html, icons/, snake/, logo.svg
│   ├── next.config.ts      # standalone output, rewrite /api → :8000
│   ├── tsconfig.json, tailwind.config.ts, postcss.config.mjs, vitest.config.ts
│   ├── eslint.config.mjs, Dockerfile, package.json
├── .github/workflows/ci.yml  # backend pytest+ruff, frontend build
├── .husky/pre-commit         # lint-staged hook
├── .planning/                # GSD project docs (PROJECT.md, ROADMAP.md, phases/, codebase/)
├── docs/                     # PRD/SRS/System Design docs (Office files)
├── model/                    # Local GGUF models (gitignored)
├── scripts/dev.sh            # Launches both services
├── setup.py, start.py        # Setup + dev launcher
├── docker-compose.yml        # backend + frontend services
└── package.json              # Root scripts, lint-staged, prettier/eslint config
```

## Directory Purposes

**`backend/app/` (core logic):**
- Purpose: All backend domain logic, routes, and services
- Contains: FastAPI app, domain functions, event bus, RAG/LLM, compliance, auth
- Key files: `main.py`, `database.py`, `domain.py`, `eventbus.py`, `rag.py`, `llm.py`

**`backend/app/routes/` (API layer):**
- Purpose: HTTP/WS endpoints grouped by feature
- Contains: `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `ops.py`, `architecture.py`, `transcribe.py`, `ws.py`, `wound.py`, `audit.py`, `stakeholders.py`, `twilio_webhook.py`
- Key files: `incidents.py` (SSE + symptom/accept/decline), `ws.py` (WebSocket broadcast)

**`backend/tests/`:**
- Purpose: Pytest suites against the FastAPI app
- Contains: `conftest.py` (temp DB + background mocks), `test_domain.py` (pure functions), `test_routes.py` (HTTP integration)

**`frontend/src/components/`:**
- Purpose: UI components; panels, feature components, and shadcn/ui primitives
- Contains: `interactive.tsx` (all live panels), `sections.tsx` (shell chrome), feature components (`wound-tracker.tsx`, `asha-audit-tool.tsx`, `emergency-guide.tsx`, etc.), `ui/` primitives
- Key files: `interactive.tsx`, `sections.tsx`, `emergency-guide.tsx`

**`frontend/src/lib/`:**
- Purpose: Client-side helpers and utilities
- Contains: `api.ts`, `realtime.ts`, `nagraksha.ts` (legacy mirror), `utils.ts`
- Key files: `api.ts` — the single integration point for backend calls

**`frontend/src/store/`:**
- Purpose: Client state management
- Contains: `sos-store.ts` — Zustand store for incident/lane/wound state

**`.planning/`:**
- Purpose: GSD planning docs (project, roadmap, phases, codebase map, debug logs)
- Contains: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `phases/`, `codebase/`, `debug/`

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app assembly + lifespan + token endpoint
- `backend/app/routes/*.py`: 16 routers registered in `main.py`
- `frontend/src/app/page.tsx`: single-page UI with role tabs
- `frontend/src/app/layout.tsx`: root layout, metadata, SW registration
- `frontend/public/sw.js`: PWA service worker

**Configuration:**
- `backend/requirements.txt`: backend deps (pinned)
- `frontend/package.json`, `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.ts`, `frontend/eslint.config.mjs`, `frontend/vitest.config.ts`
- `.env.example`: documented env vars; `.env` (gitignored) for real values
- `.prettierrc`, `.bandit.yaml`, `.github/workflows/ci.yml`, `docker-compose.yml`

**Core Logic:**
- `backend/app/domain.py`: hospital ranking, ETA math, dispatch simulation
- `backend/app/eventbus.py`: outbox worker + state machine + audit
- `backend/app/rag.py`: retrieval + RAG answer pipeline
- `backend/app/llm.py`: provider fallback chain + wound vision
- `backend/app/database.py`: schema + connection manager
- `frontend/src/store/sos-store.ts`: client incident state
- `frontend/src/lib/api.ts`: backend URL resolution

**Testing:**
- `backend/tests/`: pytest (domain units + route integration)
- `frontend/src/lib/__tests__/`: vitest (nagraksha.test.ts OK; eventbus.test.ts broken)
- `frontend/src/test/setup.ts`: jest-dom matchers
- `frontend/vitest.config.ts`: jsdom environment, `@` alias

## Naming Conventions

**Files:**
- Python modules: snake_case (`database.py`, `twilio_webhook.py`); routes named by feature (`sos.py`, `wound.py`)
- React components: PascalCase (`WoundTracker`, `HospitalStockConsole`); files kebab-case (`wound-tracker.tsx`, `hospital-packet.tsx`)
- Test files: `test_*.py` (pytest discovery), `*.test.ts` (vitest discovery)

**Directories:**
- `backend/app/routes/` — one module per API feature
- `frontend/src/components/` — feature components + `ui/` for primitives
- `frontend/src/lib/` — helpers; `__tests__/` co-located with lib tests

## Where to Add New Code

**New API Endpoint:**
- Primary code: create/extend a router module in `backend/app/routes/` (e.g. `backend/app/routes/hospitals.py`), add Pydantic models to `backend/app/models.py`, register in `backend/app/main.py`
- Tests: `backend/tests/test_routes.py` (async client fixtures in `conftest.py`)

**New Domain Logic:**
- Implementation: `backend/app/domain.py` (pure functions) — keep `backend/app/eventbus.py` for orchestration
- Tests: `backend/tests/test_domain.py`

**New Frontend Panel:**
- Implementation: add a feature component under `frontend/src/components/` (or a new `panels/` dir), render it from `frontend/src/app/page.tsx` under a role view
- API access: use `apiUrl()` from `frontend/src/lib/api.ts`
- State: extend `frontend/src/store/sos-store.ts` if part of the SOS flow

**New Database Table:**
- Add `CREATE TABLE` to `SCHEMA` in `backend/app/database.py`; add `ALTER TABLE` steps to `migrate_db()` for columns on existing tables; seed in `backend/app/seed.py`

**Utilities:**
- Shared helpers: `frontend/src/lib/utils.ts` (frontend), `backend/app/domain.py` (backend)

## Special Directories

**`backend/db/`:**
- Purpose: Runtime SQLite database
- Generated: Yes
- Committed: No (`.gitignore` — `backend/db/`)

**`backend/chroma_db/`:**
- Purpose: Runtime ChromaDB vector store
- Generated: Yes
- Committed: No (in `.gitignore`; persisted via Docker volume `backend_data`)

**`model/`:**
- Purpose: Local GGUF model files for offline LLM
- Generated: No (manually placed)
- Committed: No (`/model/*.gguf` ignored)

**`frontend/src/components/ui/`:**
- Purpose: shadcn/ui primitives
- Generated: Partially (scaffolded via shadcn CLI, hand-edited)
- Committed: Yes; excluded from ESLint/TS strict checks via `eslint.config.mjs` ignores and `@ts-nocheck` in some files

**`docs/`:**
- Purpose: PRD, SRS, System Design, wireframes (Office formats)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-08-13*
