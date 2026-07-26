# Codebase Structure

**Analysis Date:** 2026-07-25

## Top-Level Layout

```
nagraksha/
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── database.py       # SQLite schema + connection management
│   │   ├── domain.py         # Geo helpers, hospital ranking, dispatch sim
│   │   ├── eventbus.py       # In-process event bus + outbox worker
│   │   ├── llm.py            # LLM fallback chain (GGUF → Grok → Gemini)
│   │   ├── models.py         # Pydantic request models
│   │   ├── rag.py            # TF-IDF retrieval + RAG pipeline
│   │   ├── knowledge_base_data.py  # Curated KB corpus (21 chunks)
│   │   ├── seed.py           # Demo data seeder
│   │   └── routes/
│   │       ├── sos.py        # POST /api/sos — incident + outbox
│   │       ├── incidents.py  # GET /api/incidents/{id}, SSE stream, audit
│   │       ├── hospitals.py  # GET /api/hospitals, PATCH .../stock
│   │       ├── risk.py       # GET /api/risk — nearest risk report
│   │       ├── snake_id.py   # POST /api/snake-id — mock CV
│   │       ├── myth_buster.py# POST /api/myth-buster — RAG answer
│   │       ├── stats.py      # GET /api/stats — admin analytics
│   │       ├── ops.py        # GET /api/audit, /api/outbox, /api/knowledge-base
│   │       └── architecture.py # GET /api/architecture — system manifest
│   ├── db/                   # SQLite database file location
│   │   └── nagraksha.db
│   ├── requirements.txt
│   └── run.sh
│
├── frontend/                 # Next.js 16 App Router frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx    # Root layout — metadata, fonts, PWA, Toaster
│   │   │   ├── page.tsx      # Single-page app — all sections composed
│   │   │   └── globals.css   # Tailwind v4 + NagRaksha design tokens
│   │   ├── components/
│   │   │   ├── sections.tsx      # Hero, Problem, ParallelDispatch, etc.
│   │   │   ├── interactive.tsx   # LiveSosDemo, MythBuster, AuditTrail, etc.
│   │   │   ├── architecture.tsx  # Architecture diagram section
│   │   │   ├── lazy-sections.tsx # dynamic() wrappers for code-split components
│   │   │   ├── reveal.tsx        # Scroll-reveal animation wrapper
│   │   │   ├── snake-progress.tsx # SVG snake scroll progress bar
│   │   │   ├── tri-line-dock.tsx # Bottom dock navigation
│   │   │   ├── shader-background.tsx # WebGL fragment shader background
│   │   │   ├── slither-sprite.tsx   # Frame-cycled snake GIF
│   │   │   └── ui/                 # 48 shadcn/ui components (Button, Badge, Input, etc.)
│   │   ├── hooks/
│   │   │   ├── use-scroll.ts   # Scroll progress, in-view, active section
│   │   │   ├── use-toast.ts    # Toast notification state
│   │   │   └── use-mobile.ts   # Mobile breakpoint detection
│   │   └── lib/
│   │       ├── api.ts          # API URL helper (XTransformPort)
│   │       ├── nagraksha.ts    # Domain helpers (haversine, ranking, dispatch sim)
│   │       ├── db.ts           # Prisma client singleton
│   │       ├── eventbus.ts     # Node prototype event bus (duplicate of backend)
│   │       ├── knowledge-base.ts # KB corpus (duplicate of backend)
│   │       └── utils.ts        # cn() utility
│   ├── prisma/
│   │   └── schema.prisma       # Prisma schema (SQLite)
│   ├── public/
│   │   ├── sw.js               # Service worker (PWA)
│   │   ├── manifest.webmanifest
│   │   ├── offline.html
│   │   ├── icons/              # PWA icons
│   │   ├── snake/              # 6 slither frames (frame-1..6.png)
│   │   ├── logo.svg
│   │   └── favicon.ico
│   ├── scripts/
│   │   ├── seed.ts             # Prisma seed script
│   │   └── gen-icons.cjs       # Icon generation script
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── components.json         # shadcn/ui config
│   └── bun.lock
│
├── docs/                      # Design documents
│   ├── NagRaksha_SRS.docx
│   ├── NagRaksha_System_Design.docx
│   ├── NagRaksha_PRD.docx
│   ├── NagRaksha_User_Journey_Wireframes.docx
│   ├── NagRaksha_Brand_Style_Guide.docx
│   ├── NagRaksha_Pitch.pptx
│   └── NagRaksha_All_Documents_Plain_Text.txt
│
├── model/                     # LLM model files (not committed)
│   └── .gitkeep
│
├── .planning/
│   └── codebase/              # Codebase analysis documents (this file)
│
├── scripts/                   # Development scripts
│   └── dev.sh
│
├── start.py                   # Single launcher for both services
├── package.json               # Root package.json (workspace?)
├── eslint.config.mjs          # Root ESLint config
├── .env.example               # Environment variable template
├── .gitignore
├── README.md
└── worklog.md
```

## Directory Purposes

**`backend/`:**
- Purpose: Python FastAPI backend — all API endpoints, business logic, data access, and async event processing
- Contains: 10 `.py` modules in `app/`, 9 route modules in `app/routes/`, SQLite database in `db/`
- Key files:
  - `app/main.py`: Application entry point, route registration, startup hooks
  - `app/database.py`: SQLite DDL + `get_conn()` context manager + helpers
  - `app/eventbus.py`: Outbox poller, event subscriptions, audit logger
  - `app/rag.py`: RAG pipeline (TF-IDF + LLM fallback)
  - `app/llm.py`: Three-tier LLM fallback chain
  - `app/routes/sos.py`: SOS trigger — most critical route (transactional outbox pattern)

**`frontend/src/app/`:**
- Purpose: Next.js App Router — single route (root `/`) rendering the entire app as one page
- Contains: Root layout with PWA metadata, root page composing all sections, global CSS
- Naming: Re-export pattern; `page.tsx` imports from `components/` rather than containing UI code

**`frontend/src/components/`:**
- Purpose: All React components, split into presentation (`sections.tsx`), interactive (`interactive.tsx`), decorative (`shader-background.tsx`, `snake-progress.tsx`), utility (`reveal.tsx`), and lazy wrappers (`lazy-sections.tsx`)
- Contains: 9 custom components + `ui/` subdirectory with 48 shadcn/ui primitives
- Key files:
  - `sections.tsx` (639 lines): All marketing section components (Hero, Problem, ParallelDispatch, HowItFlows, Roles, Prevention, Routing, Roadmap, SiteFooter) plus Section shell
  - `interactive.tsx` (1226 lines): All interactive/demo components (LiveSosDemo, RiskPanel, SnakeId, MythBuster, StatsStrip, AuditTrailPanel, OutboxPanel, KnowledgeBasePanel)
  - `lazy-sections.tsx`: `next/dynamic` wrappers for code-splitting below-fold components

**`frontend/src/lib/`:**
- Purpose: Utility functions, API client, domain helpers, Prisma client, event bus, KB corpus
- Contains: 6 modules
- Key files:
  - `api.ts`: `apiUrl()` helper appending `?XTransformPort=8000`
  - `nagraksha.ts`: Duplicate of backend `domain.py` — haversine, hospital ranking, dispatch simulation, incident states
  - `eventbus.ts`: Duplicate of backend `eventbus.py` — EventEmitter-based bus with Prisma outbox worker
  - `db.ts`: Prisma client singleton (cached on globalThis)

**`frontend/src/hooks/`:**
- Purpose: Custom React hooks for scroll tracking, toast, and mobile detection
- Contains: 3 hooks
- `use-scroll.ts`: `useScrollProgress`, `useInView`, `useActiveSection` — all used by the dock and scroll-driven animations

**`docs/`:**
- Purpose: Design documents (SRS, System Design, PRD, Brand Guide, Wireframes, Pitch)
- All in `.docx`/`.pptx` format plus one aggregate plain-text file

**`scripts/`:**

**`model/`:**
- Purpose: Directory for local GGUF LLM models (currently empty, `.gitkeep` only)

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app creation and startup
- `frontend/src/app/layout.tsx`: Next.js root layout
- `frontend/src/app/page.tsx`: Next.js root page
- `start.py`: Concurrent launcher for both services


**Configuration:**
- `backend/requirements.txt`: Python dependencies
- `frontend/package.json`: Node dependencies and scripts
- `frontend/next.config.ts`: Next.js configuration
- `frontend/tailwind.config.ts`: Tailwind CSS configuration
- `frontend/components.json`: shadcn/ui component configuration
- `frontend/postcss.config.mjs`: PostCSS configuration
- `eslint.config.mjs`: Root ESLint flat config
- `.env.example`: Environment variables template
- `frontend/prisma/schema.prisma`: Database schema (Prisma)

**Core Logic — Backend:**
- `backend/app/database.py`: SQLite DDL (8 tables + indexes) and connection management
- `backend/app/domain.py`: `haversine_km()`, `road_km()`, `eta_min()`, `rank_hospitals()`, `simulate_dispatch()`
- `backend/app/eventbus.py`: `append_outbox()`, `start_worker()`, `_handle_incident_created()`, `audit()`, `get_ranked_hospitals()`
- `backend/app/rag.py`: `retrieve()`, `rag_answer()`, `ensure_kb_seeded()`, `EMERGENCY_RE`
- `backend/app/llm.py`: `generate()`, `is_available()`, `_generate_gguf()`, `_generate_grok()`, `_generate_gemini()`
- `backend/app/models.py`: `SosRequest`, `StockUpdate`, `MythRequest`, `SnakeIdRequest`

**Core Logic — Frontend:**
- `frontend/src/lib/api.ts`: `apiUrl()` helper
- `frontend/src/lib/nagraksha.ts`: `haversineKm()`, `rankHospitals()`, `simulateDispatch()`, types
- `frontend/src/lib/eventbus.ts`: `getBus()`, `appendOutbox()`, `audit()`, `getRankedHospitals()`
- `frontend/src/lib/db.ts`: Prisma client singleton
- `frontend/src/lib/utils.ts`: `cn()` utility

**Testing:**
- Not detected — no test files found in the codebase

## Naming Conventions

**Files — Python Backend:**
- Pattern: `snake_case.py` for all Python files
- Examples: `database.py`, `eventbus.py`, `myth_buster.py`, `knowledge_base_data.py`
- Routes: Single-word descriptive names where possible (`sos.py`, `risk.py`, `stats.py`, `ops.py`)

**Files — TypeScript/React Frontend:**
- Pattern: `kebab-case.ts` or `kebab-case.tsx` for utility files; `snake-case.tsx` for components
- Examples: `lazy-sections.tsx`, `snake-progress.tsx`, `shader-background.tsx`, `tri-line-dock.tsx`, `slither-sprite.tsx`
- Exception: `knowledge-base.ts` uses hyphen

**Directories:**
- Pattern: Singular, lowercase, single-word names
- Examples: `backend/app/routes/`, `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/lib/`, `frontend/src/app/`

**Functions — Python:**
- Pattern: `snake_case` with descriptive names
- Examples: `init_db()`, `get_conn()`, `now_iso()`, `new_id()`, `_handle_incident_created()`, `ensure_kb_seeded()`, `start_worker()`, `_build_index()`, `_generate_gguf()`
- Private functions: Prefixed with single underscore `_`

**Functions — TypeScript:**
- Pattern: `camelCase`
- Examples: `apiUrl()`, `cn()`, `rankHospitals()`, `simulateDispatch()`, `stockFreshness()`, `getRankedHospitals()`, `appendOutbox()`
- React hooks: `useScrollProgress()`, `useInView()`, `useActiveSection()`, `useIsMobile()`, `useToast()`

**Variables — Python:**
- Pattern: `snake_case`
- Examples: `inc_id`, `attempt_id`, `db_path`, `conn`, `body_part`

**Variables — TypeScript:**
- Pattern: `camelCase`
- Examples: `incidentId`, `attemptId`, `streamUrl`, `rankedHospitals`

**Components — React:**
- Pattern: `PascalCase`
- Examples: `ShaderBackground`, `SnakeProgress`, `TriLineDock`, `LiveSosDemo`, `MythBuster`, `AuditTrailPanel`, `KnowledgeBasePanel`, `Reveal`, `SiteFooter`, `Section`
- Lazy wrappers: Prefixed with `Lazy` — `LazyArchitecture`, `LazyLiveSosDemo`, `LazyMythBuster`

**Types/Interfaces — TypeScript:**
- Pattern: `PascalCase` for interfaces, `type` aliases
- Examples: `SosResponse`, `DispatchAttempt`, `RankedHospital`, `LaneState`, `KBChunk`, `Msg`, `BusEventMap`, `ResponderCategory`, `StockStatus`

**Database Tables:**
- Pattern: `PascalCase`
- Examples: `Incident`, `DispatchAttempt`, `Hospital`, `AntivenomStock`, `SymptomObservation`, `SnakeObservation`, `RiskReport`, `MythThread`, `KnowledgeChunk`, `OutboxEvent`, `AuditEvent`

**Database Columns:**
- Pattern: `camelCase`
- Examples: `incidentId`, `createdAt`, `biteTime`, `snakeType`, `quantityBand`, `verifiedAt`, `candidateName`, `aggregateId`

**API Routes:**
- Pattern: `kebab-case` paths with RESTful resources
- Examples: `/api/sos`, `/api/myth-buster`, `/api/snake-id`, `/api/knowledge-base`, `/api/incidents/{id}/stream`

## Where to Add New Code

**New API Endpoint:**
1. Create route file in `backend/app/routes/{name}.py`
2. Define `router = APIRouter()` and add route handler functions
3. Import and register via `app.include_router(route.router)` in `backend/app/main.py`
4. Add Pydantic request model in `backend/app/models.py` if needed
5. Add SQL operations in `backend/app/database.py` schema if new tables needed

**New Frontend Section/Component:**
1. Add section UI to `frontend/src/components/sections.tsx` (for marketing/presentation sections)
2. Add interactive demo to `frontend/src/components/interactive.tsx` (for live data components)
3. Create lazy wrapper in `frontend/src/components/lazy-sections.tsx` if the section is below-fold
4. Add API call logic referencing `api.ts` helper
5. Import and compose in `frontend/src/app/page.tsx`

**New Frontend Page/Route (App Router):**
1. Create directory in `frontend/src/app/{path}/`
2. Add `page.tsx` with default export

**New Backend Domain Logic:**
1. Add pure functions to `backend/app/domain.py` (geo, ranking, dispatch)
2. Add event handlers to `backend/app/eventbus.py` if event-driven
3. Add RAG-related logic to `backend/app/rag.py`

**New Database Table:**
1. Add `CREATE TABLE` DDL to `backend/app/database.py` SCHEMA constant
2. Add Prisma model to `frontend/prisma/schema.prisma` (for frontend prototype queries)

**New External Integration:**
1. Add config/env var handling — `os.environ.get()` or `_env()` helper in `backend/app/llm.py`
2. Add API client using `httpx` in a new module or within existing module
3. Add fallback chain if applicable (see `llm.py` pattern)

**New UI Component (shadcn/ui):**
1. Run `npx shadcn@latest add {component}` in `frontend/`
2. Components go to `frontend/src/components/ui/{component}.tsx`

## Special Directories

**`backend/db/`:**
- Purpose: SQLite database storage
- Contains: `nagraksha.db` — the SQLite database file
- Generated: Yes (created at runtime by `init_db()`)
- Committed: Yes (committed for demo portability)

**`frontend/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: Yes (includes `.next/dev/` — dev build artifacts committed for sandbox compatibility)

**`model/`:**
- Purpose: LLM model files for local GGUF inference
- Contains: `.gitkeep` only
- Generated: No (user must download model file)
- Committed: No (`.gitkeep` only)

**`docs/`:**
- Purpose: Design documents (SRS, System Design, PRD, Brand Guide, Wireframes, Pitch)
- Contains: 6 `.docx`, 1 `.pptx`, 1 `.txt`
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Codebase analysis documents (auto-generated by GSD tools)
- Contains: This file
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes

---

*Structure analysis: 2026-07-25*
