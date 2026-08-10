<!-- refreshed: 2026-08-11 -->
# Architecture

**Analysis Date:** 2026-08-11

## System Overview

NagRaksha is a dual-service modular monolith: a React/Next.js PWA frontend and a
Python FastAPI backend sharing a single SQLite database file. The frontend is the
only UI; the backend owns all domain logic, persistence, the event/outbox worker,
and the RAG/LLM pipeline. Live incident state is pushed to the browser over SSE.
A legacy Node/Prisma prototype (outbox bus, domain helpers, Prisma schema) is
retained in the frontend tree but is only referenced by Vitest tests — the
runtime UI never imports it.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                        Client Layer (PWA / Next.js)                       │
│   Role-based SPA shell            Interactive panels        PWA shell      │
│   `frontend/src/app/page.tsx`     `frontend/src/components/` `public/sw.js`│
├──────────────┬─────────────────────────────────────────────┬──────────────┤
│              │  fetch(`/api/...` + ?XTransformPort=8000)   │  EventSource │
│              ▼                                             │              ▼
│   Gateway: `frontend/next.config.ts` rewrite /api/:path* → 127.0.0.1:8000 │
├──────────────┬─────────────────────────────────────────────┬──────────────┤
│              ▼                                             │              │
│   API Layer — FastAPI  `backend/app/routes/*.py` (10 routers)            │
│   ┌─────────┬──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│   │ sos     │ incidents│ hospitals│ risk     │ snake_id │ myth_buster  │  │
│   │ stats   │ ops      │ arch     │ transcribe│         │              │  │
│   └────┬────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬───────┘  │
│        ▼         ▼          ▼          ▼          ▼            ▼          │
│   Domain Layer — `backend/app/domain.py`, `eventbus.py`, `rag.py`,        │
│   `llm.py`, `models.py`                                                   │
│        ▼                                                                  │
│   Data Layer — SQLite via raw sqlite3  `backend/app/database.py`          │
│   `backend/db/nagraksha.db` (10 tables incl. OutboxEvent, AuditEvent)     │
├──────────────┬────────────────────────────────────────────────────────────┤
│              ▼                                                            │
│   Async — outbox worker daemon thread (2.5s poll)  `backend/app/eventbus.py`│
│        ▼                                                                  │
│   External — Groq / Grok / Gemini APIs, local GGUF (`model/`), Whisper    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Backend entry | FastAPI app, lifespan (init DB, seed KB, start worker), CORS, router registration | `backend/app/main.py` |
| Database layer | SQLite schema (`SCHEMA`), connection context manager, id/time helpers | `backend/app/database.py` |
| Domain helpers | Pure functions: haversine, road factor, ETA, stock freshness, hospital ranking, dispatch simulation | `backend/app/domain.py` |
| Event bus / outbox | In-process pub/sub, durable outbox table, polling worker, 3-lane dispatch fan-out, audit logging | `backend/app/eventbus.py` |
| RAG | TF-IDF + cosine retrieval, emergency guard, system prompt, answer fallback chain | `backend/app/rag.py` |
| LLM provider chain | Local GGUF → Groq → Grok → Gemini, fail-open | `backend/app/llm.py` |
| API request models | Pydantic DTOs for SOS, stock update, myth query, snake ID | `backend/app/models.py` |
| KB corpus | Curated medically-reviewed knowledge chunks (seed source) | `backend/app/knowledge_base_data.py` |
| Demo seed | Hospitals, antivenom stock, risk reports, KB seeding | `backend/app/seed.py` |
| Route modules ×10 | REST + SSE endpoints (see Entry Points) | `backend/app/routes/*.py` |
| Root page | Single-page role-based UI (sos/responder/hospital/myth/snake_id/guide/admin) | `frontend/src/app/page.tsx` |
| Root layout | Metadata, fonts, service-worker registration, Toaster | `frontend/src/app/layout.tsx` |
| Interactive panels | 10 live panels (SOS demo, risk, snake ID, myth buster, stats, audit, outbox, KB, hospital console, symptom logger) | `frontend/src/components/interactive.tsx` |
| Shell chrome | TopAppBar, NavigationDrawer, SiteFooter (+ unrendered marketing sections) | `frontend/src/components/sections.tsx` |
| Emergency guide | Offline clinical first-aid tabs + 2-min calm timer + species mimic matrix | `frontend/src/components/emergency-guide.tsx` |
| Lazy wrappers | Code-split `next/dynamic` wrappers for heavy panels | `frontend/src/components/lazy-sections.tsx` |
| API helper | Appends `?XTransformPort=8000` to relative API paths | `frontend/src/lib/api.ts` |
| Legacy TS domain mirror | Duplicate of `domain.py` logic — used only by tests | `frontend/src/lib/nagraksha.ts` |
| Legacy Prisma bus | Prototype outbox/bus over Prisma — used only by tests | `frontend/src/lib/eventbus.ts`, `frontend/src/lib/db.ts` |
| Geolocation hook | GPS resolve with Bannerghatta fallback | `frontend/src/hooks/use-geolocation.ts` |
| Dev launcher | Start/stop/status both services | `start.py`, `scripts/dev.sh` |
| Setup | One-step env + dependency + seed install | `setup.py` |

## Pattern Overview

**Overall:** Modular monolith — feature-sliced Python backend behind a thin
Next.js client, with a transactional-outbox / in-process event-bus for async
work and SSE for live updates.

**Key Characteristics:**
- Single SQLite database file shared by both services (`backend/db/nagraksha.db`); raw SQL, no ORM on the backend.
- Transactional outbox pattern: incident write + `OutboxEvent` row committed together, then drained by a polling worker.
- Fail-open architecture: every LLM/AI provider returns gracefully to the next fallback; audit writes are best-effort.
- Duplicated domain logic across languages: Python (`backend/app/domain.py`) is authoritative; a TS mirror (`frontend/src/lib/nagraksha.ts`) survives for test coverage.
- PWA-first client: service worker caches the app shell but never API data (`frontend/public/sw.js`).

## Layers

**Client Layer (Next.js):**
- Purpose: Role-based SPA shell rendering 7 views from one page component
- Location: `frontend/src/app/`, `frontend/src/components/`, `frontend/src/hooks/`
- Contains: React components, shadcn/ui primitives (`frontend/src/components/ui/`), hooks, the API helper `frontend/src/lib/api.ts`
- Depends on: Backend API via `fetch`/SSE; never touches SQLite directly
- Used by: Browser (PWA, `frontend/public/sw.js` app shell)

**Gateway Layer:**
- Purpose: Route `/api/*` to the Python backend
- Location: `frontend/next.config.ts:9` (`async rewrites()` → `http://127.0.0.1:8000/api/:path*`)
- Convention: relative API paths + `?XTransformPort=8000` (`frontend/src/lib/api.ts:10`) — a Caddy-gateway convention documented in `backend/app/main.py:5` and `frontend/src/lib/api.ts:1-7`

**API Layer (FastAPI):**
- Purpose: HTTP boundary, request validation, response shaping
- Location: `backend/app/routes/` (10 modules), `backend/app/models.py`
- Contains: 16 endpoints (see Entry Points); Pydantic DTOs; SSE stream handler in `backend/app/routes/incidents.py:63`
- Depends on: `backend/app/database.py`, `backend/app/domain.py`, `backend/app/eventbus.py`, `backend/app/rag.py`, `backend/app/llm.py`
- Used by: Frontend via `frontend/src/lib/api.ts`

**Domain / Service Layer:**
- Purpose: All business logic — dispatch orchestration, hospital ranking, RAG pipeline, LLM fallback chain
- Location: `backend/app/eventbus.py`, `backend/app/domain.py`, `backend/app/rag.py`, `backend/app/llm.py`
- Contains: Outbox worker thread, in-process bus, scoring functions, TF-IDF index, provider adapters
- Depends on: `backend/app/database.py`, external APIs
- Used by: Route modules

**Data Layer:**
- Purpose: SQLite persistence — schema, connections, identity/time helpers
- Location: `backend/app/database.py`, runtime DB `backend/db/nagraksha.db` (gitignored)
- Contains: 10 tables (Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread, KnowledgeChunk, OutboxEvent, AuditEvent); `get_conn()` context manager at `backend/app/database.py:170`
- Depends on: stdlib `sqlite3`
- Used by: All backend layers

**Async Layer:**
- Purpose: Durable event processing + live state fan-out
- Location: `backend/app/eventbus.py` — `_worker_tick` (`:130`), `start_worker` daemon thread polling every 2.5 s (`:166`), `subscribe`/`unsubscribe` (`:23-32`)
- Contains: Outbox drain, 3-lane dispatch simulation, incident state machine (`PENDING → DISPATCHING → ACCEPTED → TRANSPORTING → HANDED_OFF`), audit writer
- Used by: SSE endpoints (`backend/app/routes/incidents.py:63`) and the SOS route

**External Services:**
- Purpose: AI generation, vision classification, speech-to-text
- Location: `backend/app/llm.py` (Groq/Grok/Gemini REST), `backend/app/routes/snake_id.py` (3 vision providers), `backend/app/routes/transcribe.py` (Groq Whisper), `model/` (local GGUF)
- Auth: `GROQ_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY` from `.env` (see `.env.example`)

## Data Flow

### Primary Request Path — Trigger SOS

1. `LiveSosDemo` collects GPS + incident details and POSTs `/api/sos` (`frontend/src/components/interactive.tsx:227` via `apiUrl` → rewrite in `frontend/next.config.ts:9`).
2. `trigger_sos` (`backend/app/routes/sos.py:15`) inserts `Incident` (state `DISPATCHING`) and a `PENDING` `OutboxEvent` of type `IncidentCreated` in the **same transaction** (`sos.py:21-33`), then writes an `AuditEvent` (`SOS_TRIGGERED`).
3. Response returns incident, ranked hospitals, `streamUrl` (`/api/incidents/{id}/stream?XTransformPort=8000`) and `auditUrl` (`sos.py:39-46`).
4. The outbox worker (`backend/app/eventbus.py:130`) drains the event and calls `_handle_incident_created` (`eventbus.py:68`): it fans out three independent lanes — `TRAINED`, `RESCUE`, `AMBULANCE` — inserting `DispatchAttempt` rows, emitting `DispatchAttempted` / `DispatchAccepted` bus events, and simulating first-candidate acceptance.
5. The state machine advances `ACCEPTED → TRANSPORTING → HANDED_OFF` with sleeps between transitions (`eventbus.py:113-118`) and a `HANDOFF` audit.
6. The victim UI receives the initial snapshot + live events over SSE: `EventSource` on `streamUrl` (`frontend/src/components/interactive.tsx:242`); server generator in `backend/app/routes/incidents.py:88-106` subscribes to `DispatchAttempted`, `DispatchAccepted`, `IncidentStateChanged` and re-emits with 15 s heartbeats.

### Secondary Flow — Myth-Buster RAG

1. `MythBuster` panel POSTs `/api/myth-buster` (`frontend/src/components/interactive.tsx:832`).
2. `ask` (`backend/app/routes/myth_buster.py:14`) calls `rag_answer` (`backend/app/rag.py:116`): TF-IDF retrieval of top-4 chunks (index built at `rag.py:32`, category boosts `MYTH` 1.08 / `FIRST_AID` 1.06).
3. An emergency-keyword guard (`EMERGENCY_RE`, `rag.py:86`) short-circuits to a fixed triage answer.
4. Otherwise `generate` (`backend/app/llm.py:178`) tries local GGUF → Groq → Grok → Gemini; on total failure the top chunk is returned verbatim (`source: rag-retrieval-only`).
5. Result + retrieved docIds are persisted to `MythThread` and audited (`myth_buster.py:19-28`).

### Secondary Flow — Snake Photo/Text ID

1. `SnakeId` panel POSTs `/api/snake-id` (`frontend/src/components/interactive.tsx:656`).
2. `identify` (`backend/app/routes/snake_id.py:342`) tries three vision providers in order: Groq `llama-3.2-11b-vision-instruct` → Grok vision → Gemini 2.5 Flash (`snake_id.py:192-304`).
3. Text-only input falls back to keyword matching over the 11-species `CATALOGUE` (`snake_id.py:307-339`), with mimic warnings; responses always carry the medical disclaimer (`snake_id.py:156`).

**State Management:**
- Server-authoritative: SQLite is the source of truth; the browser only holds ephemeral UI state (useState in `frontend/src/app/page.tsx`, panel-local state in `frontend/src/components/interactive.tsx`).
- Live state: SSE snapshots + events; `EventSource` auto-reconnect re-fetches canonical state.
- Outbox rows carry event state `PENDING | PROCESSED | FAILED` with an attempt counter (`backend/app/database.py:135-146`).

## Key Abstractions

**Transactional Outbox / Event Bus:**
- Purpose: Durable event emission decoupled from request handling
- Examples: `append_outbox` (`backend/app/eventbus.py:46`), `OutboxEvent` table (`backend/app/database.py:135`), `_worker_tick` drain (`eventbus.py:130`), `subscribe`/`unsubscribe` (`eventbus.py:23-32`)
- Pattern: Write-ahead event row in the same DB transaction as the aggregate write; poller dispatches; retries with max 4 attempts then `FAILED`

**Hospital Ranking Score:**
- Purpose: Antivenom-aware routing (stock status first, ETA second)
- Examples: `rank_hospitals` (`backend/app/domain.py:48`), consumed by `get_ranked_hospitals` (`backend/app/eventbus.py:182`), surfaced at `/api/hospitals` and inside the SOS response
- Pattern: Pure scoring function: `CONFIRMED` 100 − 0.6·ETA, `LOW` 55 − 0.6·ETA, `UNKNOWN` 30, `STALE` 28, `OUT` 5; stale `CONFIRMED` penalised −35; sorted descending, `recommended` = rank 1

**LLM Provider Fallback Chain:**
- Purpose: One `generate()` call that never throws
- Examples: `generate` (`backend/app/llm.py:178`), `is_available` (`llm.py:222`), local model autodetect `_find_model` (`llm.py:39`)
- Pattern: Try local GGUF → Groq → Grok → Gemini; each adapter returns `None` on missing key/HTTP error; caller falls back to retrieval-only

**SSE Live Stream:**
- Purpose: Push incident state changes to the victim UI
- Examples: `stream_incident` (`backend/app/routes/incidents.py:63-107`), client `EventSource` (`frontend/src/components/interactive.tsx:205-272`)
- Pattern: Per-connection `asyncio.Queue` fed by bus callbacks; initial snapshot; 15 s heartbeat; unsubscribe on disconnect

**`get_conn()` Connection Manager:**
- Purpose: Single SQLite connection per operation with commit/rollback
- Examples: `backend/app/database.py:170-182`; used everywhere in routes/eventbus/rag
- Pattern: `@contextmanager` yielding `sqlite3.Row` rows with `PRAGMA foreign_keys = ON`; commits on success, rolls back on exception

## Entry Points

**Backend FastAPI app:**
- Location: `backend/app/main.py:31` (`app = FastAPI(...)`); lifespan at `:23-28` runs `db.init_db()`, `ensure_kb_seeded()`, `start_worker()`
- Run: `python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (`scripts/dev.sh:7`, `start.py:91`)
- Health: `GET /api/health` (`main.py:43`)

**Registered API routers (16 endpoints):**
- `backend/app/routes/sos.py:15` — `POST /api/sos`
- `backend/app/routes/incidents.py:39,44,63` — `GET /api/incidents/{id}`, `GET /api/incidents/{id}/audit`, `GET /api/incidents/{id}/stream` (SSE)
- `backend/app/routes/hospitals.py:12,19` — `GET /api/hospitals`, `PATCH /api/hospitals/{hid}/stock`
- `backend/app/routes/risk.py:18` — `GET /api/risk`
- `backend/app/routes/snake_id.py:342` — `POST /api/snake-id`
- `backend/app/routes/myth_buster.py:14` — `POST /api/myth-buster`
- `backend/app/routes/stats.py:11` — `GET /api/stats`
- `backend/app/routes/ops.py:12,31,48` — `GET /api/audit`, `GET /api/outbox`, `GET /api/knowledge-base`
- `backend/app/routes/architecture.py:10` — `GET /api/architecture` (self-describing system manifest)
- `backend/app/routes/transcribe.py:24,92` — `POST /api/transcribe`, `POST /api/transcribe-b64`

**Frontend entry points:**
- `frontend/src/app/layout.tsx` — root layout (metadata, fonts, SW registration script `:106-110`, Toaster)
- `frontend/src/app/page.tsx` — single route `/`; role switch via `activeRole` state
- PWA shell: `frontend/public/sw.js` (precache, network-first navigation, `NetworkOnly` for API), `frontend/public/offline.html`

## Architectural Constraints

- **Threading:** Backend uses a single daemon poller thread (`backend/app/eventbus.py:178`) that blocks on `time.sleep` while simulating dispatch; FastAPI sync endpoints run in the default threadpool; SSE handlers are async. Shared state guarded by `_bus_lock` (`eventbus.py:18`), `_index_lock` (`backend/app/rag.py:20`), `_lock` (`backend/app/llm.py:22`). Frontend bus singletons hang off `globalThis` (`frontend/src/lib/eventbus.ts:41-44`).
- **Global state (module singletons):** `_subscribers`/`_worker_started` (`backend/app/eventbus.py:19-20`), `_index` (`backend/app/rag.py:21`), `_model`/`_model_path` (`backend/app/llm.py:23-24`), `GLOBAL.__nagrakshaBus`/`__nagrakshaWorkerStarted` (`frontend/src/lib/eventbus.ts:41-44`).
- **Schema ownership:** The authoritative schema is the raw SQL in `backend/app/database.py:19-160`; `frontend/prisma/schema.prisma` mirrors it but is legacy — never run `prisma db push` as the migration path, it targets the frontend's own SQLite `DATABASE_URL`.
- **Gateway convention:** All API calls must use relative paths + `?XTransformPort=8000` (`frontend/src/lib/api.ts`) — never absolute `http://localhost:8000` URLs (documented in `backend/app/main.py:5` and `backend/requirements.txt:4`).
- **CORS:** Backend allowlist is only `http://localhost:3000` / `http://127.0.0.1:3000` (`backend/app/main.py:36`); production deployments must go through the same-origin gateway/rewrite.
- **No authentication:** There is no auth middleware or RBAC anywhere; `/api/architecture` lists "Authentication + RBAC at API boundary" as a *target* component only.

## Anti-Patterns

### Dual-Language Domain Duplication

**What happens:** The same business logic — haversine, road factor, ETA, stock freshness, hospital ranking, dispatch simulation — exists in Python (`backend/app/domain.py`) and in TypeScript (`frontend/src/lib/nagraksha.ts`), and the two can drift (e.g. `stockFreshness` freshness thresholds differ: Python treats `CONFIRMED` ≤ 120 min as fresh at `domain.py:41` while the TS copy at `frontend/src/lib/nagraksha.ts:37-40` special-cases ≤ 30 min).
**Why it's wrong:** Two sources of truth for ranking/ETA math; fixes must be applied twice; the TS copy is only exercised by unit tests.
**Do this instead:** Treat `backend/app/domain.py` as the single source of truth (the runtime UI already calls the backend for ranking via `/api/hospitals`), and delete the TS mirror + its tests (`frontend/src/lib/nagraksha.ts`, `frontend/src/lib/__tests__/nagraksha.test.ts`).

### Legacy Prisma Prototype Retained in the Frontend

**What happens:** `frontend/src/lib/eventbus.ts`, `frontend/src/lib/db.ts`, `frontend/src/lib/knowledge-base.ts`, `frontend/scripts/seed.ts`, and `frontend/prisma/schema.prisma` implement the old Node prototype's outbox/bus over Prisma. Nothing in `frontend/src/app` or `frontend/src/components` imports them — only `frontend/src/lib/__tests__/eventbus.test.ts` does (with a mocked `@/lib/db`).
**Why it's wrong:** Dead code plus a heavyweight dependency (`@prisma/client` in `frontend/package.json:17`) and a competing schema file that invites `db:push` mistakes.
**Do this instead:** Remove the legacy modules and the Prisma dependency once the backend is the confirmed runtime; keep only `frontend/src/lib/api.ts` as the client integration point.

### Mega-Component Files

**What happens:** `frontend/src/components/interactive.tsx` (≈1688 lines) contains 10 exported panels; `frontend/src/components/sections.tsx` (≈800 lines) contains 12 exports, most of which (Hero, Problem, ParallelDispatch, HowItFlows, Roles, Prevention, Routing, Roadmap) are **not rendered** by `frontend/src/app/page.tsx` — only `TopAppBar`, `NavigationDrawer`, `SiteFooter` are imported.
**Why it's wrong:** Poor discoverability, merge conflicts, and dead marketing sections add bundle/type-check surface.
**Do this instead:** Split panels into one file per component under `frontend/src/components/panels/`; delete the unrendered sections from `frontend/src/components/sections.tsx`.

### Client Calls a Nonexistent Endpoint

**What happens:** `SymptomLogger` POSTs `/api/incidents/{incidentId}/symptoms` (`frontend/src/components/interactive.tsx:1651`) and the `SymptomObservation`/`SnakeObservation` tables exist (`backend/app/database.py:76-98`), but no backend route implements it — every submit fails and shows `toast.error('Failed to log symptoms')`.
**Why it's wrong:** A feature (pre-arrival clinical handoff, SRS `protocol-handoff`) is wired to a 404.
**Do this instead:** Add `POST /api/incidents/{inc_id}/symptoms` in `backend/app/routes/incidents.py` (mirroring `sos.py`'s transaction pattern) or remove the logger UI.

### Time-Sleep Simulation Inside the Worker

**What happens:** The outbox handler blocks the single worker thread with `time.sleep` for simulated accept delays and state transitions (`backend/app/eventbus.py:97-118` — ≈4-5 s per incident); only one incident processes at a time.
**Why it's wrong:** A real fan-out would be parallel/async; the queue stalls behind the sleep.
**Do this instead:** Accept for the demo, but note that a real implementation would move delays into per-lane timers/async tasks or a job queue.

## Error Handling

**Strategy:** Fail-open everywhere. Providers degrade rather than crash; audit writes are best-effort; the outbox marks events `FAILED` after 4 attempts instead of blocking the queue.

**Patterns:**
- LLM adapters return `None` on missing key or any HTTP/JSON error (`backend/app/llm.py:58-173`); `generate` returns `None` when all four fail (`llm.py:219`).
- RAG falls back `rag-llm → rag-retrieval-only → fallback` (`backend/app/rag.py:116-152`), with a regex emergency guard short-circuit.
- Audit is wrapped in try/except and silently skipped (`backend/app/eventbus.py:55-65`).
- Worker `_worker_tick` is fully guarded (`eventbus.py:130-163`); subscriber exceptions are swallowed (`eventbus.py:39-43`).
- Frontend panels use sonner `toast.success/error` (`frontend/src/components/interactive.tsx:1663-1666`); the service worker never caches API responses (`frontend/public/sw.js` header comment, `NetworkOnly`).

## Cross-Cutting Concerns

**Logging:** Process logs to `backend.log` / `dev.log` via `tee` in root npm scripts (`package.json:6-7`); structured domain events go to the `AuditEvent` table, inspectable at `GET /api/audit` (`backend/app/routes/ops.py:12`).
**Validation:** Pydantic for API bodies (`backend/app/models.py`); inline Pydantic models for snake-id/transcribe payloads (`backend/app/routes/snake_id.py`, `backend/app/routes/transcribe.py:18-22`); raw SQL row-mapping everywhere else.
**Authentication:** None implemented — open endpoints; CORS restricted to localhost:3000 only. The architecture manifest (`backend/app/routes/architecture.py:24-27`) lists auth/RBAC as a future API-boundary component.

---

*Architecture analysis: 2026-08-11*
