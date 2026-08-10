# Codebase Structure

**Analysis Date:** 2026-08-11

## Directory Layout

```
Nagaraksha-/
├── backend/                 # Python FastAPI service (port 8000)
│   ├── app/
│   │   ├── main.py          # FastAPI app entry, lifespan, router registration
│   │   ├── database.py      # SQLite schema + connection manager
│   │   ├── domain.py        # Geo/ETA/ranking/dispatch pure functions
│   │   ├── eventbus.py      # Outbox worker, pub/sub bus, audit logger
│   │   ├── rag.py           # TF-IDF retrieval + RAG answer pipeline
│   │   ├── llm.py           # Local GGUF → Groq → Grok → Gemini chain
│   │   ├── models.py        # Pydantic request DTOs
│   │   ├── seed.py          # Demo data seeding
│   │   ├── knowledge_base_data.py  # Curated KB corpus (seed source)
│   │   ├── __init__.py
│   │   └── routes/          # 10 route modules (one per API domain)
│   ├── db/                  # Runtime SQLite DB (gitignored)
│   ├── tests/               # pytest suite (conftest, routes, domain)
│   ├── requirements.txt
│   └── run.sh
├── frontend/                # Next.js 16 app (port 3000)
│   ├── src/
│   │   ├── app/             # layout.tsx, page.tsx, globals.css
│   │   ├── components/      # panels, shell, ui primitives
│   │   │   └── ui/          # ~50 shadcn/ui Radix primitives
│   │   ├── hooks/           # use-geolocation, use-mobile, use-scroll, use-toast
│   │   ├── lib/             # api.ts + legacy TS mirrors (tests only)
│   │   │   └── __tests__/   # vitest unit tests
│   │   └── test/            # vitest setup file
│   ├── prisma/              # Legacy Prisma schema (prototype only)
│   ├── public/              # sw.js, offline.html (PWA shell)
│   ├── scripts/             # Legacy seed.ts (prototype only)
│   ├── next.config.ts       # /api rewrite → backend:8000
│   ├── tailwind.config.ts, tsconfig.json, vitest.config.ts, components.json
│   └── package.json
├── model/                   # GGUF model drop location (gitignored)
├── docs/                    # SRS, PRD, System Design, wireframes, brand guide
├── .planning/               # GSD planning artifacts (research, phases, codebase)
├── .github/workflows/       # ci.yml (frontend + backend + gatekeeper)
├── scripts/                 # dev.sh
├── .husky/                  # Git hooks (pre-commit via lint-staged)
├── .env / .env.example      # Environment config (example committed)
├── .bandit.yaml             # Bandit security scanner config
├── start.py                 # Dev launcher (start/stop/status)
├── setup.py                 # One-step setup (deps + .env + seed)
├── package.json             # Root scripts (dev, lint, format, seed)
└── README.md
```

## Directory Purposes

**`backend/app/`:**
- Purpose: The complete backend — API, domain logic, async worker, AI pipeline
- Contains: 11 modules + `routes/` subpackage
- Key files: `main.py` (entry), `database.py` (schema), `eventbus.py` (async core), `rag.py` (AI core)

**`backend/app/routes/`:**
- Purpose: One module per API domain, each exposing a `router = APIRouter()`
- Contains: `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `ops.py`, `architecture.py`, `transcribe.py`
- Key file: `backend/app/main.py:49-58` registers all ten routers

**`backend/tests/`:**
- Purpose: pytest suite; `conftest.py` sets a temp `NAGRAKSHA_DB`, uses httpx `ASGITransport`, and mocks the background worker/KB seeding
- Key files: `conftest.py`, `test_routes.py`, `test_domain.py`

**`frontend/src/app/`:**
- Purpose: Next.js App Router — one route (`/`) rendered as a role-switched SPA
- Key files: `page.tsx` (all 7 views), `layout.tsx` (metadata/fonts/SW), `globals.css` (Tailwind v4 theme)

**`frontend/src/components/`:**
- Purpose: All UI. `interactive.tsx` holds the 10 live panels; `sections.tsx` holds the shell chrome (+ unrendered marketing sections); `ui/` holds shadcn/ui primitives; `lazy-sections.tsx` provides `next/dynamic` wrappers; visual-effect components (`shader-background.tsx`, `slither-sprite.tsx`, `snake-progress.tsx`, `tri-line-dock.tsx`, `reveal.tsx`) and `voice-input.tsx`, `architecture.tsx`, `emergency-guide.tsx` are standalone
- Key files: `interactive.tsx` (1688 lines — the main feature surface), `emergency-guide.tsx`

**`frontend/src/lib/`:**
- Purpose: Client logic. `api.ts` is the single integration point to the backend; the remaining files (`nagraksha.ts`, `eventbus.ts`, `db.ts`, `knowledge-base.ts`) are legacy prototype modules referenced only by `frontend/src/lib/__tests__/`
- Key file: `api.ts` (`apiUrl()` helper, `?XTransformPort=8000` convention)

**`frontend/public/`:**
- Purpose: PWA static assets — `sw.js` (app-shell precache, network-first navigation, never-cache API), `offline.html`, icons/manifest

**`docs/`:**
- Purpose: Product/design documentation (`.docx` + a plain-text bundle): `NagRaksha_SRS.docx`, `NagRaksha_PRD.docx`, `NagRaksha_System_Design.docx`, `NagRaksha_User_Journey_Wireframes.docx`, `NagRaksha_Brand_Style_Guide.docx`, `NagRaksha_Pitch.pptx`

**`.planning/`:**
- Purpose: GSD workflow state — `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `MILESTONES.md`, `STATE.md`, `research/` (pre-implementation studies), `phases/` (per-phase plans), `debug/` (incident notes), and this `codebase/` mapping

**`.github/workflows/`:**
- Purpose: CI — `ci.yml` runs frontend (`eslint`, `tsc --noEmit`, `vitest run`) and backend (`bandit`, `pytest`) jobs plus a merge gatekeeper

**Root scripts:**
- `start.py` — cross-platform dev launcher with health checks and `--status`/`--stop`
- `setup.py` — 5-step setup: prerequisites, `.env` from `.env.example`, backend pip install, frontend `npm install`, DB seed
- `scripts/dev.sh` — bash launcher (uvicorn + `next dev -p 3000 --webpack`)
- `package.json` — orchestrates both via `npm run dev`, `dev:frontend`, `dev:backend`

## Key File Locations

**Entry Points:**
- `backend/app/main.py:31` — FastAPI app; run via `uvicorn app.main:app`
- `frontend/src/app/layout.tsx` — Next.js root layout
- `frontend/src/app/page.tsx` — the only page (role-based SPA)
- `start.py` / `scripts/dev.sh` — local orchestration

**Configuration:**
- `backend/requirements.txt` — pinned Python deps (FastAPI 0.128, scikit-learn, llama-cpp-python, httpx)
- `frontend/package.json` — Next.js 16, React 19, Prisma (legacy), Tailwind v4, Vitest
- `frontend/next.config.ts` — `output: 'standalone'`, `/api/:path*` rewrite to `127.0.0.1:8000`
- `frontend/tsconfig.json`, `frontend/vitest.config.ts` (`@` → `./src` alias), `frontend/tailwind.config.ts`, `frontend/components.json` (shadcn)
- `.env.example` — documented vars (`NAGRAKSHA_DB`, `GROK_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY`); `.env` is gitignored
- `.bandit.yaml` — Bandit scanner config; `.prettierrc` + `.prettierignore` — formatting
- `.github/workflows/ci.yml` — CI pipeline

**Core Logic:**
- Backend: `backend/app/domain.py` (ranking/ETA), `backend/app/eventbus.py` (dispatch/outbox), `backend/app/rag.py` (RAG), `backend/app/llm.py` (provider chain)
- Frontend: `frontend/src/components/interactive.tsx` (all feature panels), `frontend/src/lib/api.ts` (backend integration)

**Testing:**
- Backend: `backend/tests/test_routes.py`, `backend/tests/test_domain.py`, `backend/tests/conftest.py`
- Frontend: `frontend/src/lib/__tests__/nagraksha.test.ts`, `frontend/src/lib/__tests__/eventbus.test.ts`, `frontend/src/test/setup.ts`

## Naming Conventions

**Files:**
- Python: `snake_case.py` — module names follow the API domain (`sos.py`, `myth_buster.py`)
- TypeScript: kebab-case for component files (`emergency-guide.tsx`, `voice-input.tsx`, `shader-background.tsx`); `page.tsx` / `layout.tsx` per Next.js App Router convention; `use-*.ts` for hooks; lowercase for shadcn primitives in `src/components/ui/` (`button.tsx`, `dropdown-menu.tsx`)
- Backend route modules are single-purpose; each declares `router = APIRouter()` and is registered in `backend/app/main.py:49-58`

**Functions:**
- Python: `snake_case` (`rank_hospitals`, `ensure_kb_seeded`, `get_ranked_hospitals`)
- TypeScript: `camelCase` (`apiUrl`, `rankHospitals`, `simulateDispatch`, `stockFreshness`)
- React components: `PascalCase` exports (`LiveSosDemo`, `HospitalStockConsole`, `EmergencyGuide`), memoized with `memo(function ...)` where applicable (`frontend/src/components/sections.tsx:34`)

**Variables:**
- Python: `snake_case`; DB columns are `camelCase` (legacy Prisma alignment, e.g. `biteTime`, `dispatchAttempts`)
- TypeScript: `camelCase`; DOM/effect refs prefixed `useRef`, CSS custom properties in `globals.css` use `--kebab-case`

**Types:**
- TypeScript: `PascalCase` interfaces/type unions — `RankedHospital` (`frontend/src/lib/nagraksha.ts:47`), `ResponderCategory`, `StockStatus`, `KBChunk` (`frontend/src/lib/knowledge-base.ts:7`); union of event names `BusEventMap` (`frontend/src/lib/eventbus.ts:20`)
- Python: Pydantic models `PascalCase` in `backend/app/models.py` (`SosRequest`, `StockUpdate`, `MythRequest`, `SnakeIdRequest`)

**API / JSON:**
- Endpoints: `/api/{resource}` with `kebab-case` resource segments (`/api/myth-buster`, `/api/snake-id`, `/api/transcribe-b64`)
- JSON fields: `camelCase` (`biteTime`, `verifiedAt`, `dispatchAttempts`, `streamUrl`)
- Database tables: `PascalCase` entities (`Incident`, `DispatchAttempt`, `AntivenomStock`, `OutboxEvent`), matching `frontend/prisma/schema.prisma`

## Where to Add New Code

**New API endpoint:**
- Create `backend/app/routes/<domain>.py` with `router = APIRouter()` and register it in `backend/app/main.py:49-58`
- Add request DTOs to `backend/app/models.py` (or inline if single-use, as in `backend/app/routes/transcribe.py:18`)
- Add a pytest class in `backend/tests/test_routes.py` (uses the `async_client` fixture from `backend/tests/conftest.py`)

**New database table/column:**
- Edit `SCHEMA` in `backend/app/database.py:19-160` (raw SQL `CREATE TABLE IF NOT EXISTS`); runtime DB is recreated from schema on `init_db()`
- If legacy parity matters, mirror the change in `frontend/prisma/schema.prisma` (prototype only — not used at runtime)

**New frontend feature panel:**
- Add the component to `frontend/src/components/` (prefer a new file over extending `interactive.tsx`, which is already 1688 lines)
- Wire it into the role switch in `frontend/src/app/page.tsx` (`activeRole` union at `page.tsx:26-28`)
- Call the backend via `apiUrl('/api/...')` from `frontend/src/lib/api.ts` — never a hardcoded absolute URL

**New UI primitive:**
- `frontend/src/components/ui/<name>.tsx`, following the shadcn/ui + Radix pattern of the existing primitives; update `frontend/src/components/ui/index.ts` barrel if one exists (see `components.json`)

**New hook:**
- `frontend/src/hooks/use-<name>.ts` with `'use client'` if it touches browser APIs (e.g. `use-geolocation.ts`)

**New knowledge-base content:**
- Add chunks to `backend/app/knowledge_base_data.py` (seed source; re-seed via `npm run backend:seed`); `ensure_kb_seeded()` only seeds when the table is empty (`backend/app/rag.py:155`)
- Optional mirror in `frontend/src/lib/knowledge-base.ts` only if legacy test parity is still required

**Tests:**
- Backend: `backend/tests/test_<module>.py`
- Frontend: `frontend/src/lib/__tests__/<module>.test.ts` (Vitest, `@` alias configured in `frontend/vitest.config.ts`)

## Special Directories

**`model/`:**
- Purpose: Local GGUF model drop location — auto-detected at startup by `backend/app/llm.py:39` (`_find_model()` globs `model/*.gguf`)
- Generated: No. Committed: Only `.gitkeep` — `*.gguf` is gitignored (`.gitignore` → `/model/*.gguf`)

**`backend/db/`:**
- Purpose: Runtime SQLite database file (`nagraksha.db`), created by `init_db()`
- Generated: Yes. Committed: No — `backend/db/` is gitignored; path overridable via `NAGRAKSHA_DB`

**`frontend/.next/`, `node_modules/`:**
- Purpose: Build/runtime artifacts for Next.js and npm
- Generated: Yes. Committed: No

**`frontend/prisma/`:**
- Purpose: Legacy prototype Prisma schema — mirrors `backend/app/database.py` tables; referenced by `frontend/scripts/seed.ts` and the root `db:push`/`db:generate` scripts
- Generated: No. Committed: Yes (kept for prototype parity; not used by the runtime UI)

**`.planning/`:**
- Purpose: GSD workflow state (project, roadmap, requirements, milestones, phases, research, debug, codebase maps)
- Generated: Yes (tooling). Committed: Yes

**`docs/`:**
- Purpose: Official product/design artifacts (`.docx`/`.pptx`) — the SRS, PRD, and System Design docs are the requirement source for the codebase
- Generated: No. Committed: Yes

---

*Structure analysis: 2026-08-11*
