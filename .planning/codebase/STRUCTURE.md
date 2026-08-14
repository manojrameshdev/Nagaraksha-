# Codebase Structure

**Analysis Date:** 2026-08-14

## Directory Layout

```
Nagaraksha-/
├── backend/               # Python FastAPI backend (port 8000)
│   ├── app/               # Application package
│   │   ├── main.py        # FastAPI app factory + entry point
│   │   ├── routes/        # 15 APIRouter modules (one per resource)
│   │   ├── database.py    # SQLite schema + connection layer
│   │   ├── models.py      # Pydantic request models
│   │   ├── domain.py      # Geo/dispatch/ranking helpers
│   │   ├── rag.py         # RAG pipeline (ChromaDB + TF-IDF fallback)
│   │   ├── llm.py         # LLM fallback chain + vision analysis
│   │   ├── eventbus.py    # Outbox worker + event bus + audit
│   │   ├── dispatch.py    # Twilio SMS dispatch (simulation fallback)
│   │   ├── compliance.py  # Hospital compliance scoring
│   │   ├── scheduler.py   # APScheduler jobs
│   │   ├── auth.py        # JWT auth + role dependencies
│   │   ├── seed.py        # Demo data seeding
│   │   └── knowledge_base_data.py  # Curated RAG corpus
│   ├── tests/             # pytest suite
│   ├── db/                # SQLite runtime data (gitignored)
│   ├── chroma_db/         # ChromaDB vector store (docker volume)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.sh
├── frontend/              # Next.js 16 frontend (port 3000)
│   ├── app/               # Next.js App Router (layout, page, manifest)
│   ├── components/
│   │   ├── nagraksha/     # App-specific components (shell, workspaces, shared)
│   │   └── ui/            # shadcn/ui primitives (button.tsx)
│   ├── lib/               # Client utilities (utils.ts → cn)
│   ├── public/            # Static assets, PWA icons
│   ├── package.json       # (note: no Dockerfile despite docker-compose reference)
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── postcss.config.mjs
│   └── components.json    # shadcn config
├── model/                 # GGUF LLM models (gitignored, .gitkeep only)
├── scripts/dev.sh         # Bash dev launcher
├── docs/                  # PRD/SRS/design docs (.docx, .pptx)
├── .github/workflows/ci.yml  # CI pipeline
├── .husky/                # pre-commit hooks (lint-staged)
├── .planning/             # GSD planning docs (PROJECT, ROADMAP, phases)
├── .env.example           # Environment template (do not commit real .env)
├── docker-compose.yml     # Backend + frontend services
├── package.json           # Root orchestration scripts (dev, lint, db)
├── setup.py               # One-step environment installer
├── start.py               # Dev launcher/status/stop for both services
└── README.md
```

## Directory Purposes

**`backend/app/`:**
- Purpose: Entire Python application — API layer, domain services, data layer
- Contains: FastAPI entry (`main.py`), route modules (`routes/`), domain services, SQLite layer, seed data
- Key files: `main.py`, `database.py`, `models.py`, `rag.py`, `llm.py`, `eventbus.py`, `dispatch.py`, `auth.py`

**`backend/app/routes/`:**
- Purpose: HTTP surface — one `APIRouter` module per resource family
- Contains: `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `architecture.py`, `ops.py`, `transcribe.py`, `ws.py`, `wound.py`, `audit.py`, `stakeholders.py`, `twilio_webhook.py`
- Key files: `sos.py` (SOS + outbox write), `ws.py` (WebSocket broadcast)

**`backend/tests/`:**
- Purpose: pytest test suite
- Contains: `conftest.py` (temp DB + ASGI client fixtures), `test_routes.py`, `test_domain.py`, `test_rag.py`, `test_eventbus.py`, `test_compliance.py`
- Key files: `conftest.py`

**`frontend/app/`:**
- Purpose: Next.js App Router pages and root config
- Contains: `layout.tsx` (root layout), `page.tsx` (client entry), `manifest.ts` (PWA manifest), `globals.css` (Tailwind v4 theme)
- Key files: `page.tsx`

**`frontend/components/nagraksha/`:**
- Purpose: App-specific React components
- Contains: `shell.tsx` (AppShell, sidebar, role switcher), `workspaces.tsx` (per-role demo workspaces), `shared.tsx` (shared presentational components)
- Key files: `shell.tsx`, `workspaces.tsx`

**`frontend/components/ui/`:**
- Purpose: shadcn/ui primitive components (Base UI + CVA based)
- Contains: `button.tsx`
- Key files: `button.tsx`

**`frontend/lib/`:**
- Purpose: Client-side utility code
- Contains: `utils.ts` (`cn` helper: `clsx` + `tailwind-merge`)
- Key files: `utils.ts`

**`model/`:**
- Purpose: Local GGUF LLM models for offline inference (auto-detected by `backend/app/llm.py`)
- Contains: `.gitkeep` only (models gitignored)
- Generated: No (user-downloaded) · Committed: No

**`docs/`:**
- Purpose: Product/design documents (PRD, SRS, System Design, wireframes, brand guide)
- Contains: `.docx`/`.pptx` binaries + `NagRaksha_All_Documents_Plain_Text.txt`

**`.planning/`:**
- Purpose: GSD planning artifacts (PROJECT.md, ROADMAP.md, REQUIREMENTS.md, MILESTONES.md, STATE.md, phases/, codebase/)
- Contains: planning state and codebase map documents

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app factory — `uvicorn app.main:app` (started by `start.py`, `scripts/dev.sh`, `backend/Dockerfile`)
- `frontend/app/page.tsx`: Frontend page entry — composes `AppShell` + `RoleWorkspace`
- `start.py`: Root dev launcher for both services
- `setup.py`: One-step environment setup

**Configuration:**
- `backend/requirements.txt`: Python dependencies (FastAPI, chromadb, sklearn, twilio, sentry, apscheduler, python-jose, slowapi)
- `frontend/package.json`: Next.js 16 / React 19 / Tailwind v4 / shadcn deps
- `frontend/tsconfig.json`: strict TS, `@/*` path alias, `moduleResolution: bundler`
- `frontend/next.config.mjs`: Next config (currently `ignoreBuildErrors: true`)
- `frontend/components.json`: shadcn config (base-nova style, lucide icons)
- `docker-compose.yml`: Backend + frontend services (frontend build context references a missing Dockerfile)
- `package.json` (root): dev/lint/format/db orchestration + husky lint-staged
- `.github/workflows/ci.yml`: CI — ruff, py_compile, pytest; vitest, lint, next build

**Core Logic:**
- `backend/app/database.py`: Schema DDL + `get_conn()` + migrations
- `backend/app/eventbus.py`: Outbox worker + incident dispatch fan-out + audit
- `backend/app/rag.py`: Retrieval + answer pipeline
- `backend/app/llm.py`: LLM fallback chain + wound vision analysis
- `backend/app/domain.py`: Hospital ranking + geo + ETA
- `backend/app/auth.py`: JWT + RBAC dependencies
- `frontend/components/nagraksha/workspaces.tsx`: Role workspaces (demo state)

**Testing:**
- `backend/tests/`: pytest suite (6 files)

## Naming Conventions

**Files:**
- Python modules: `snake_case` — `myth_buster.py`, `snake_id.py`, `twilio_webhook.py`, `knowledge_base_data.py`
- TSX components: `camelCase` for app components (`shell.tsx`, `workspaces.tsx`, `shared.tsx`, `button.tsx`); Next.js special files lowercase (`layout.tsx`, `page.tsx`, `manifest.ts`)
- Tests: `test_<module>.py` (`test_routes.py`, `test_domain.py`)

**Directories:**
- Backend: lowercase (`app/routes/`, `app/tests/`, `backend/db/`)
- Frontend: lowercase (`app/`, `components/`, `lib/`, `public/`), shadcn subfolder `components/ui/`

**Functions/Classes:**
- Python: `snake_case` functions (`rag_answer`, `get_ranked_hospitals`, `ensure_kb_seeded`), `PascalCase` classes (`SosRequest`, `StockUpdate`)
- TypeScript: `PascalCase` components (`AppShell`, `RoleWorkspace`, `Button`), `camelCase` helpers (`cn`, `demoSos`)

**URL Paths:**
- API endpoints: kebab-case under `/api/...` — `/api/myth-buster`, `/api/snake-id`, `/api/audit/village`
- WebSocket: `/ws/incidents/{incident_id}`
- Twilio webhook: `/webhook/twilio`

**Database Tables:**
- PascalCase (legacy Prisma style) — `Incident`, `DispatchAttempt`, `AntivenomStock`, `OutboxEvent`, `KnowledgeChunk` (defined in `backend/app/database.py` SCHEMA)

## Where to Add New Code

**New Feature (end-to-end):**
- Backend route: create `backend/app/routes/<feature>.py` with `router = APIRouter()`, then register in `backend/app/main.py` (`app.include_router(...)`)
- Request models: add Pydantic models to `backend/app/models.py`
- Domain logic: add module in `backend/app/` (e.g. a service module) and import it from the route
- Persistence: extend `SCHEMA` in `backend/app/database.py` + add `ALTER TABLE` migrations in `migrate_db()` if needed
- Frontend workspace: add/extend workspace in `frontend/components/nagraksha/workspaces.tsx` and shared components in `shared.tsx`

**New API Endpoint (existing resource):**
- Implementation: the matching module in `backend/app/routes/` (e.g. new incident action → `incidents.py`)
- Tests: `backend/tests/test_routes.py`

**New Component/Module (frontend):**
- App-specific components: `frontend/components/nagraksha/`
- Reusable shadcn primitives: `frontend/components/ui/`
- Client utilities: `frontend/lib/`

**Utilities:**
- Backend shared helpers: `backend/app/domain.py` (geo/math), `backend/app/database.py` (id/time helpers)
- Frontend shared helpers: `frontend/lib/utils.ts`

**Background jobs / scheduled tasks:**
- Register new APScheduler jobs in `backend/app/scheduler.py`; long-running jobs should follow the outbox/executor pattern in `backend/app/eventbus.py`

## Special Directories

**`backend/db/`:**
- Purpose: SQLite runtime database (`nagraksha.db`)
- Generated: Yes (runtime) · Committed: No (gitignored)

**`backend/chroma_db/`:**
- Purpose: ChromaDB persistent vector store for RAG
- Generated: Yes (runtime) · Committed: No (mapped as Docker volume `backend_data`)

**`model/`:**
- Purpose: Local GGUF LLM models
- Generated: No (user-downloaded) · Committed: No (gitignored)

**`frontend/public/`:**
- Purpose: Static assets and PWA icons
- Generated: No · Committed: Yes

**`docs/`:**
- Purpose: Binary design documents (PRD, SRS, System Design)
- Generated: No · Committed: Yes

---

*Structure analysis: 2026-08-14*
