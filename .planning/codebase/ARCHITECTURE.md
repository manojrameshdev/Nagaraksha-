<!-- refreshed: 2026-08-14 -->
# Architecture

**Analysis Date:** 2026-08-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend — Next.js 16 / React 19                  │
│  `frontend/app/page.tsx` → `components/nagraksha/{shell,workspaces,  │
│  shared}.tsx`  (role-based demo presentation shell, NOT yet wired     │
│  to the backend API)                                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  (planned) NEXT_PUBLIC_BACKEND_URL
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Layer — FastAPI (uvicorn)                     │
│  `backend/app/main.py` (app factory, CORS, rate limit, Sentry,       │
│  lifespan)  →  `backend/app/routes/*.py` (15 APIRouter modules)      │
├─────────────────────────────────────────────────────────────────────┤
│  Domain Services — `backend/app/`                                     │
│  `rag.py` RAG pipeline · `llm.py` fallback chain · `domain.py` geo/  │
│  ranking · `dispatch.py` Twilio SMS · `compliance.py` scoring ·      │
│  `auth.py` JWT RBAC · `scheduler.py` APScheduler · `eventbus.py`     │
│  outbox/event bus · `seed.py` demo data                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Data Layer — SQLite (raw sqlite3)                 │
│  `backend/app/database.py` (SCHEMA, WAL, get_conn, migrate_db)       │
│  `backend/db/nagraksha.db` · `backend/chroma_db/` (vector store)     │
│  + Async: `OutboxEvent` table → worker thread → WebSocket push       │
│  + External: Twilio, Groq/Grok/Gemini, Sentry, llama-cpp (GGUF)      │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI app | App factory, lifespan (init DB, seed KB, start worker/scheduler), CORS, rate limiting, Sentry, router registration, `/api/health`, `/api/auth/token` | `backend/app/main.py` |
| Route modules | HTTP request/response surface — one module per resource family | `backend/app/routes/*.py` |
| Database layer | SQLite connection management, schema DDL, migrations, id/time helpers | `backend/app/database.py` |
| Pydantic models | Request body validation contracts | `backend/app/models.py` |
| RAG pipeline | Semantic retrieval (ChromaDB, TF-IDF fallback), emergency guard, retrieval-only fallback | `backend/app/rag.py` |
| LLM module | Provider fallback chain: local GGUF → Groq → Grok → Gemini; wound image analysis | `backend/app/llm.py` |
| Event bus / outbox | Durable outbox table, poller worker, in-process pub/sub, audit logger, incident dispatch fan-out | `backend/app/eventbus.py` |
| Dispatch | Real SMS dispatch via Twilio, falls back to simulation | `backend/app/dispatch.py` |
| Domain helpers | Haversine distance, road/ETA estimates, hospital ranking, simulated dispatch, incident refs | `backend/app/domain.py` |
| Compliance | Hospital compliance scoring + badge, run on schedule | `backend/app/compliance.py` |
| Scheduler | APScheduler — compliance job every 15 min | `backend/app/scheduler.py` |
| Auth | JWT creation/validation, role dependency factories | `backend/app/auth.py` |
| Seed | Idempotent demo data: hospitals, stock, risk reports, KB | `backend/app/seed.py` |
| KB corpus | Curated, medically-reviewed knowledge chunks | `backend/app/knowledge_base_data.py` |
| Frontend shell | Role-based demo workspace shell (sidebar, nav, workspaces) | `frontend/components/nagraksha/shell.tsx`, `workspaces.tsx`, `shared.tsx` |

## Pattern Overview

**Overall:** Modular monolith — a single FastAPI process with a module-per-route API layer over a raw-SQL SQLite store, driven by a transactional-outbox event backbone. The Next.js frontend is currently a standalone demo presentation shell that does not yet call the API.

**Key Characteristics:**
- **Transactional outbox**: SOS writes `Incident` + `OutboxEvent` in one SQLite transaction; a background worker drains the outbox, so dispatch fan-out survives restarts
- **Fallback chains**: LLM generation (GGUF→Groq→Grok→Gemini), RAG retrieval (ChromaDB→TF-IDF→text match), dispatch (Twilio→simulation) all degrade gracefully to retrieval-only / simulated modes
- **In-process event bus + WebSocket push**: subscribers + `broadcast_sync` fan events to per-incident WebSocket channels from worker threads
- **Raw SQL with sqlite3**: no ORM; schema is one `SCHEMA` string in `backend/app/database.py` (PascalCase table names inherited from the old Prisma prototype)
- **FastAPI dependency injection** for auth (`Depends(require_role_if_enforced(...))`) and rate limiting (`@limiter.limit(...)`)

## Layers

**Frontend / Presentation:**
- Purpose: Role-switchable demo UI for Victim, Responder, Rescue, Ambulance, Hospital, ASHA, Stakeholder, Admin
- Location: `frontend/app/`, `frontend/components/nagraksha/`
- Contains: `page.tsx` (client page), `layout.tsx`, `manifest.ts`, `globals.css`, role workspace components
- Depends on: nothing external — all data is hardcoded demo/presentation state
- Used by: browser at `http://localhost:3000`

**API Layer:**
- Purpose: HTTP surface for every capability
- Location: `backend/app/routes/` (15 modules)
- Contains: APIRouter modules — `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `architecture.py`, `ops.py`, `transcribe.py`, `ws.py`, `wound.py`, `audit.py`, `stakeholders.py`, `twilio_webhook.py`
- Depends on: `database.py`, `models.py`, `auth.py`, `eventbus.py`, `domain.py`, `rag.py`, `llm.py`, `routes/ws.py`
- Used by: external clients (frontend, Twilio webhook, curl)

**Domain/Service Layer:**
- Purpose: Business logic — RAG, LLM, dispatch, ranking, compliance, auth, scheduling, events
- Location: `backend/app/` (`rag.py`, `llm.py`, `domain.py`, `dispatch.py`, `eventbus.py`, `compliance.py`, `auth.py`, `scheduler.py`)
- Depends on: `database.py`; `eventbus.py` → `dispatch.py`, `domain.py`, `routes/ws.py`; `rag.py` → `llm.py`, `knowledge_base_data.py`
- Used by: route modules, app lifespan (`main.py`)

**Data Layer:**
- Purpose: Persistence — relational + vector
- Location: `backend/app/database.py`, `backend/db/`, `backend/chroma_db/`
- Contains: SQLite (WAL), `OutboxEvent` queue, ChromaDB collection `nagraksha_kb`
- Depends on: nothing (stdlib `sqlite3`)
- Used by: all layers

## Data Flow

### Primary Request Path — SOS Dispatch

1. `POST /api/sos` — `backend/app/routes/sos.py:15` `trigger_sos()` inserts `Incident` (state `DISPATCHING`) and a `PENDING` `OutboxEvent` of type `IncidentCreated` in the **same transaction**; returns incident, ranked hospitals, stream/ws URLs
2. Outbox poller `_worker_tick()` (`backend/app/eventbus.py:200`) drains PENDING events every 2.5 s; `IncidentCreated` jobs run on a `ThreadPoolExecutor(max_workers=4)` via `_run_incident_job` (`eventbus.py:152`)
3. `_handle_incident_created` (`eventbus.py:76`) calls `do_dispatch()` (`backend/app/dispatch.py:94`) — real responders from `Responder` table with Twilio SMS, else `simulate_dispatch()`; persists `DispatchAttempt` rows across 3 lanes (TRAINED/RESCUE/AMBULANCE)
4. Each attempt emits `DispatchAttempted` → in-process subscribers + `broadcast_sync` (`backend/app/routes/ws.py:29`) which schedules `broadcast()` onto the app event loop via `asyncio.run_coroutine_threadsafe`
5. State machine advances `_set_state` (`eventbus.py:192`): `DISPATCHING → ACCEPTED → TRANSPORTING → HANDED_OFF` (simulated lanes sleep-paced; real lanes poll for an accepted attempt with a 300 s timeout in `_wait_for_accept_then_advance`, `eventbus.py:168`)
6. Client receives pushes over WebSocket `/ws/incidents/{incident_id}` (`backend/app/routes/ws.py:40`); legacy SSE `/api/incidents/{incident_id}/stream` (`backend/app/routes/incidents.py:152`) kept for backward compat
7. Twilio replies (`ACCEPT`/`READY`/`DECLINE`) arrive at `/webhook/twilio` (`backend/app/routes/twilio_webhook.py:20`), signature-validated, and flip the matching `DispatchAttempt`

### RAG Chat Path — Myth-Buster

1. `POST /api/myth-buster` — `backend/app/routes/myth_buster.py:14` → `rag_answer()` (`backend/app/rag.py:190`)
2. `retrieve()` (`rag.py:107`) queries ChromaDB (`nagraksha_kb`, cosine); falls back to TF-IDF cosine with category boosts, then substring match
3. Emergency regex guard `EMERGENCY_RE` short-circuits to a fixed SOS instruction
4. If any LLM available (`llm.py is_available()`), `generate()` tries local GGUF → Groq → Grok → Gemini with the curated `SYSTEM_PROMPT`; on failure returns top chunk verbatim (`rag-retrieval-only`)
5. Response is persisted as a `MythThread` row + `RAG_QUERY` audit event

### Secondary Flow — Hospital Ranking & Compliance

1. `GET /api/hospitals` — `backend/app/routes/hospitals.py:13` → `get_ranked_hospitals()` (`eventbus.py:266`) joins freshest `AntivenomStock` per hospital (window function) → `rank_hospitals()` (`backend/app/domain.py:73`) composites distance (40%) + stock freshness (30%) + compliance (30%)
2. `scheduler.py` runs `run_compliance_job()` (`backend/app/compliance.py:52`) every 15 min — exponential freshness decay + activity bonus, writes `complianceScore`/`complianceRank` to `Hospital`

**State Management:**
- Incident lifecycle state machine persisted on the `Incident.state` column; `DispatchAttempt.outcome` per attempt
- Durable event queue in `OutboxEvent` (PENDING → PROCESSED / FAILED after 4 attempts)
- Audit trail in `AuditEvent` (best-effort writes)
- In-memory: ChromaDB client/collection (`rag.py`), GGUF model (`llm.py`), WebSocket connection map + event loop ref (`ws.py`), event-bus subscriber map + inflight set (`eventbus.py`), APScheduler instance (`scheduler.py`)

## Key Abstractions

**Outbox / Event Bus:**
- Purpose: Durable decoupling between transactional writes and side effects (dispatch, notifications)
- Examples: `append_outbox()` (`backend/app/eventbus.py:54`), `_worker_tick()`, `subscribe/unsubscribe`
- Pattern: Poll-based transactional outbox with bounded thread-pool processing and per-event retry accounting

**Fallback Chain:**
- Purpose: Graceful degradation when external providers are missing or fail
- Examples: `generate()` (`backend/app/llm.py:179`), `retrieve()` (`backend/app/rag.py:107`), `do_dispatch()` (`backend/app/dispatch.py:94`)
- Pattern: Try providers in priority order; first non-None wins; caller falls back to a safe default (retrieval-only / simulation)

**Role Auth Dependency Factory:**
- Purpose: Conditional RBAC on mutating routes
- Examples: `require_role_if_enforced()` (`backend/app/auth.py:115`) used in `incidents.py`, `hospitals.py`, `wound.py`, `twilio_webhook.py`; hard `require_role()` in `stakeholders.py`
- Pattern: FastAPI `Depends` factories returning the caller role or raising 401/403; enforcement toggled by `AUTH_ENFORCED`/`ENV=production`

**Route Module Convention:**
- Purpose: One `APIRouter` per resource family, registered in `main.py`
- Examples: all files under `backend/app/routes/`
- Pattern: `router = APIRouter()`, decorated handlers, Pydantic bodies from `models.py`, `with db.get_conn() as conn:` for queries

## Entry Points

**Backend (uvicorn):**
- Location: `backend/app/main.py` — `app = FastAPI(...)`; run via `uvicorn app.main:app` (see `start.py:91`, `scripts/dev.sh:7`, `backend/Dockerfile`)
- Triggers: `python start.py`, `npm run dev:backend`, `docker-compose up`
- Responsibilities: lifespan (DB init, KB seed, ws loop registration, worker + scheduler start), middleware, router registration, health + token endpoints

**Frontend (Next.js):**
- Location: `frontend/app/page.tsx` (client page composing `AppShell` + `RoleWorkspace`), `frontend/app/layout.tsx` (root layout + metadata)
- Triggers: `next dev -p 3000` (see `start.py:102`, `scripts/dev.sh:12`)
- Responsibilities: role-switching shell, per-role demo workspaces, PWA manifest (`frontend/app/manifest.ts`)

**Root Launchers:**
- `start.py` — starts/stops/status-checks both services with health polling
- `setup.py` — one-step prerequisite check, `.env` creation, dependency install, DB seed
- `package.json` scripts — `dev`, `dev:frontend`, `dev:backend`, `format:*`, `lint`, `db:push`, `db:generate`, `backend:seed`
- `scripts/dev.sh` — bash variant of the dev launcher

## Architectural Constraints

- **Threading:** Async FastAPI event loop + daemon background threads: outbox poller (`eventbus.py:257`), thread-pool dispatch executor (4 workers), APScheduler on the async loop. Worker threads cross into the async loop only through `asyncio.run_coroutine_threadsafe` via the loop captured in `ws.set_loop()` (`backend/app/routes/ws.py:24`)
- **Global state:** Module-level singletons — ChromaDB `_client`/`_collection` (`rag.py:21-22`), GGUF `_model` (`llm.py:23`), WebSocket `_connections` map + `_loop` (`ws.py:17,21`), `_subscribers`/`_inflight`/`_executor` (`eventbus.py:21-28`), `_scheduler` (`scheduler.py:12`), `limiter` (`main.py:47`). All guarded by `threading.Lock` except `_connections` (touched only on the loop)
- **Database:** Single-writer SQLite in WAL mode (`PRAGMA journal_mode = WAL`), `synchronous = NORMAL`, foreign keys ON, one connection per operation via `get_conn()` context manager
- **Circular imports:** Avoided by deferred imports — `domain.py` imports `compliance_badge` inside `rank_hospitals()` (`domain.py:109`); `eventbus.py` → `routes.ws` is acyclic (ws.py imports nothing from eventbus)
- **Secrets:** `ENV=production` refuses demo/placeholder JWT and role secrets at import time (`auth.py:29-53`); `.env` loaded via `python-dotenv` in `main.py:14`

## Anti-Patterns

### Frontend/Backend Disconnect (presentation shell)

**What happens:** The frontend contains zero API calls — no `fetch`, no `WebSocket`, no `NEXT_PUBLIC_BACKEND_URL` usage anywhere under `frontend/`. All workspaces render hardcoded demo data (`frontend/components/nagraksha/workspaces.tsx`). The `AdminWorkspace` even labels `frontend/src/lib/api.ts` as a "Future seam" (`workspaces.tsx:17`).
**Why it's wrong:** The backend exposes a full API surface that no client consumes; the app cannot perform a real SOS, RAG query, or dispatch end-to-end.
**Do this instead:** Add an API client layer (e.g. `frontend/lib/api.ts` as referenced) that calls the backend via `NEXT_PUBLIC_BACKEND_URL`, then wire workspaces to real endpoints, keeping the demo state only as loading/offline fallbacks. Phase 7 of `ROADMAP.md` ("Connect all the features of the frontend with the backend") targets exactly this.

### Duplicated Incident Loader

**What happens:** The same `_load_incident()` helper (incident + dispatchAttempts + symptomObservations + snakeObservations) is copy-pasted in `backend/app/routes/sos.py:50` and `backend/app/routes/incidents.py:17`.
**Why it's wrong:** Drift risk — a schema or response change must be applied in two places.
**Do this instead:** Extract into a single module (e.g. `backend/app/loaders.py` or a method on `database.py`) and import from both route modules.

### Time-Sleep Paced State Machine in the Live Path

**What happens:** `_handle_incident_created()` (`backend/app/eventbus.py:141-149`) blocks worker threads with `time.sleep(0.6/1.6/2.0)` to demo-pace incident state transitions, and `_wait_for_accept_then_advance()` polls every 2 s.
**Why it's wrong:** Demo pacing is embedded in the production dispatch handler; sleeps tie up the 4-worker pool and make real timings fake.
**Do this instead:** Keep simulated pacing behind a `SIMULATION`/`DEMO` flag, or drive transitions from actual events (Twilio reply, responder PATCH) plus a scheduled state timer, so production behavior is event-driven.

### Duplicated "Freshest Stock" Join

**What happens:** The same window-function query (`ROW_NUMBER() OVER (PARTITION BY hospitalId ORDER BY verifiedAt DESC)`) is repeated in `get_ranked_hospitals()` (`backend/app/eventbus.py:269`) and `stats.py:28`.
**Why it's wrong:** Query drift and duplicated SQL.
**Do this instead:** Centralize as a view or shared SQL constant/helper in `database.py`.

### Placeholder / Prototype Config Flags

**What happens:** `frontend/next.config.mjs:4` keeps `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`; `docker-compose.yml` references a frontend build context with a Dockerfile that does not exist (`frontend/Dockerfile` absent); root `package.json` lint-staged references `frontend/eslint.config.mjs` which is also absent.
**Why it's wrong:** Safety valves mask type errors in CI; compose and hook configs are broken by missing files.
**Do this instead:** Remove `ignoreBuildErrors`, add the missing `frontend/Dockerfile` and `frontend/eslint.config.mjs` (or repoint lint-staged), and align configs with the actual file tree.

## Error Handling

**Strategy:** Defensive fallbacks + best-effort side effects; exceptions are contained so the request/worker never crashes.

**Patterns:**
- Provider failures return `None` and trigger the next fallback (`llm.py`, `rag.py`, `dispatch.py`)
- Outbox failures: `_mark_failed_or_retry()` (`eventbus.py:235`) — attempts++ then `FAILED` after 4 tries; handler exceptions logged, never crash the poller
- Audit writes are wrapped in try/except with `pass` (`eventbus.py:72`) — best-effort
- Route-level 404/401/403 via FastAPI `HTTPException` (e.g. `incidents.py:56`, `auth.py:99-110`)
- Sentinel defaults: `days_since()` returns `9999.0` on parse failure (`database.py:302`); stock freshness treats unknown as stale
- Uploaded audio cleanup in `finally` blocks (`transcribe.py:84`)

## Cross-Cutting Concerns

**Logging:** Plain `print()` to stdout/stderr (`[RAG]`, `[Eventbus]`, `[Dispatch]`, `[Compliance]`, `[Scheduler]` prefixes); dev launcher tees output to `backend.log`/`dev.log`. Sentry (`SENTRY_DSN`) captures errors with 0.2 trace sample rate.
**Validation:** Pydantic request models in `backend/app/models.py`; FastAPI `Query(ge=..., le=...)` bounds; Twilio webhook signature validation when credentials configured.
**Authentication:** JWT (HS256) role tokens from `/api/auth/token`; `require_role` / `require_role_if_enforced` dependency factories; demo secrets rejected in production.
**Rate limiting:** slowapi global default 200/min; `/api/auth/token` limited to 10/min (`main.py:47,95`).

---

*Architecture analysis: 2026-08-14*
