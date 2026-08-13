<!-- refreshed: 2026-08-13 -->
# Architecture

**Analysis Date:** 2026-08-13

## System Overview

NagRaksha is a dual-service modular monolith: a Next.js/React PWA frontend and a
Python FastAPI backend sharing a single SQLite database file (`backend/db/nagraksha.db`).
The frontend is the only UI; the backend owns all domain logic, persistence, the
transactional-outbox worker, RAG/LLM pipeline, Twilio SMS dispatch, and a WebSocket
realtime layer. The backend has evolved past the original prototype: v2 added JWT
role auth, rate limiting, Sentry, Twilio SMS with a reply webhook, WebSocket
broadcast (SSE kept for compatibility), a Gemini-vision wound tracker, APScheduler
hospital compliance scoring, ASHA village audits, and a stakeholder registry.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                      Client Layer (PWA / Next.js 16)                      │
│  Role-based SPA shell         Interactive panels         PWA shell        │
│  `frontend/src/app/page.tsx`  `frontend/src/components/`  `public/sw.js`  │
│  Zustand store `frontend/src/store/sos-store.ts`                          │
├──────────────┬───────────────────────────────────────────┬───────────────┤
│              │ fetch(apiUrl('/api/...'))                 │ WebSocket     │
│              ▼                                           ▼ (wsUrl)       │
│   Gateway: NEXT_PUBLIC_BACKEND_URL (default http://localhost:8000)        │
│   Next.js rewrite `/api/:path*` → 127.0.0.1:8000 (next.config.ts)         │
├──────────────┬───────────────────────────────────────────┬───────────────┤
│              ▼                                           ▼               │
│   API Layer — FastAPI  `backend/app/routes/*.py` (16 routers)            │
│   sos incidents hospitals risk snake_id myth_buster stats                 │
│   ops architecture transcribe ws wound audit stakeholders twilio_webhook │
│   + auth token (main.py), rate limiting, Sentry                           │
│        ▼                                                                  │
│   Domain/Service Layer — `backend/app/domain.py`, `dispatch.py`,          │
│   `eventbus.py`, `rag.py`, `llm.py`, `compliance.py`, `scheduler.py`      │
│        ▼                                                                  │
│   Data Layer — SQLite via raw sqlite3 `backend/app/database.py`           │
│   `backend/db/nagraksha.db` (16 tables) + ChromaDB `backend/chroma_db`    │
│        ▼                                                                  │
│   Async — outbox worker thread (2.5s poll) + APScheduler (15 min)         │
│        ▼                                                                  │
│   External — Groq / Grok / Gemini / Twilio SMS / Sentry / local GGUF      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Backend entry | FastAPI app, lifespan (init DB, seed KB, start worker + scheduler), Sentry init, rate limiter, CORS, JWT token endpoint, router registration | `backend/app/main.py` |
| Database layer | SQLite schema (16 tables), `migrate_db()` for ALTER changes, `get_conn()` context manager, id/time helpers | `backend/app/database.py` |
| Domain helpers | Pure functions: haversine, road factor, ETA, stock freshness, hospital ranking (distance 40% / stock 30% / compliance 30%), dispatch simulation | `backend/app/domain.py` |
| Auth | JWT role tokens, `require_role()` dependency factory, role secrets from env | `backend/app/auth.py` |
| Event bus / outbox | In-process pub/sub, durable outbox table, 2.5s polling worker, 3-lane dispatch fan-out (simulated), incident state machine, audit logging | `backend/app/eventbus.py` |
| SMS dispatch | Real Twilio dispatch with `simulate_dispatch()` fallback; nearest-responder lookup from `Responder` table | `backend/app/dispatch.py` |
| RAG | ChromaDB semantic retrieval (TF-IDF fallback), emergency guard regex, system prompt, answer fallback chain | `backend/app/rag.py` |
| LLM provider chain | Local GGUF → Groq → Grok → Gemini, fail-open; Gemini vision wound analysis | `backend/app/llm.py` |
| Compliance | Hospital compliance scoring (freshness decay + activity bonus), badge labels, 15-min job | `backend/app/compliance.py` |
| Scheduler | APScheduler AsyncIOScheduler wrapper for the compliance job | `backend/app/scheduler.py` |
| API request models | Pydantic DTOs for SOS, stock, myth, snake-id, symptoms, audits, stakeholders, token, responders | `backend/app/models.py` |
| KB corpus | Curated medically-reviewed knowledge chunks (seed source) | `backend/app/knowledge_base_data.py` |
| Demo seed | Hospitals, antivenom stock, risk reports, KB seeding | `backend/app/seed.py` |
| Route modules ×16 | REST + SSE + WebSocket endpoints (see Entry Points) | `backend/app/routes/*.py` |
| Root page | Single-page role-based UI (sos/guide/responder/hospital/asha/stakeholders/myth/snake_id/admin) | `frontend/src/app/page.tsx` |
| Root layout | Metadata, fonts, SW registration, Toaster | `frontend/src/app/layout.tsx` |
| Interactive panels | 10 live panels (SOS demo, risk, snake ID, myth buster, stats, audit, outbox, KB, hospital console, symptom logger) | `frontend/src/components/interactive.tsx` |
| Shell chrome | TopAppBar, NavigationDrawer, SiteFooter (+ unrendered marketing sections) | `frontend/src/components/sections.tsx` |
| Emergency guide | Offline clinical first-aid tabs, calm timer, species mimic matrix | `frontend/src/components/emergency-guide.tsx` |
| SOS state store | Zustand store: phase, lanes, wound readings, severity, WS connected flag | `frontend/src/store/sos-store.ts` |
| Realtime hook | `useIncidentSocket` WebSocket hook wiring store updates (defined but not currently imported by any component) | `frontend/src/lib/realtime.ts` |
| API helper | Builds absolute backend URLs from `NEXT_PUBLIC_BACKEND_URL` + `wsUrl()` for WebSocket | `frontend/src/lib/api.ts` |
| Legacy TS domain mirror | Duplicate of `domain.py` logic — used only by tests | `frontend/src/lib/nagraksha.ts` |
| Geolocation hook | GPS resolve with Bannerghatta fallback | `frontend/src/hooks/use-geolocation.ts` |
| Dev launcher | Start/stop/status both services | `start.py`, `scripts/dev.sh` |
| Setup | One-step env + dependency + seed install | `setup.py` |

## Pattern Overview

**Overall:** Modular monolith — feature-sliced Python backend behind a thin
Next.js client, with a transactional-outbox / in-process event-bus for async
work, WebSocket (with SSE fallback) for live updates, and a scheduled
compliance job.

**Key Characteristics:**
- Single SQLite database file shared by both services; raw SQL, no ORM on the backend. ChromaDB used for RAG vectors only.
- Transactional outbox pattern: incident write + `OutboxEvent` row committed together, then drained by a polling worker thread.
- Fail-open architecture: every LLM/AI/SMS provider degrades gracefully; audit writes are best-effort.
- Two realtime transports: WebSocket (`/ws/incidents/{id}`, preferred) and SSE (`/api/incidents/{id}/stream`, kept for backward compat).
- Real dispatch with demo fallback: Twilio SMS if configured AND responders registered; otherwise `simulate_dispatch()`.
- Duplicated domain logic across languages: Python (`backend/app/domain.py`) is authoritative; a TS mirror (`frontend/src/lib/nagraksha.ts`) survives for test coverage only.
- PWA-first client: service worker caches the app shell but never API data (`frontend/public/sw.js`).

## Layers

**Client Layer (Next.js):**
- Purpose: Role-based SPA shell rendering 9 views from one page component
- Location: `frontend/src/app/`, `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/store/`
- Contains: React components, shadcn/ui primitives (`frontend/src/components/ui/`), hooks, Zustand store, API helper `frontend/src/lib/api.ts`
- Depends on: Backend API via `fetch`/WebSocket; never touches SQLite directly
- Used by: Browser (PWA, `frontend/public/sw.js` app shell)

**Gateway Layer:**
- Purpose: Route browser calls to the Python backend
- Location: `frontend/src/lib/api.ts` (absolute `NEXT_PUBLIC_BACKEND_URL`) + `frontend/next.config.ts:9` (dev rewrite `/api/:path*` → `http://127.0.0.1:8000`)
- Convention: absolute URL from env var; the `?XTransformPort=8000` artifact was removed

**API Layer (FastAPI):**
- Purpose: HTTP boundary, request validation, response shaping, auth
- Location: `backend/app/routes/` (16 modules), `backend/app/models.py`
- Contains: ~30 endpoints (see Entry Points); Pydantic DTOs; SSE stream handler (`backend/app/routes/incidents.py`); WebSocket handler (`backend/app/routes/ws.py`); JWT token endpoint + rate limiting in `backend/app/main.py`
- Depends on: `backend/app/database.py`, `domain.py`, `eventbus.py`, `rag.py`, `llm.py`, `auth.py`, `compliance.py`
- Used by: Frontend via `frontend/src/lib/api.ts`

**Domain / Service Layer:**
- Purpose: Business logic — dispatch orchestration, hospital ranking, RAG pipeline, LLM fallback chain, compliance scoring, real SMS
- Location: `backend/app/eventbus.py`, `backend/app/domain.py`, `backend/app/rag.py`, `backend/app/llm.py`, `backend/app/dispatch.py`, `backend/app/compliance.py`, `backend/app/scheduler.py`
- Contains: Outbox worker thread, in-process bus, scoring functions, ChromaDB/TF-IDF retrieval, provider adapters, Twilio client
- Depends on: `backend/app/database.py`, external APIs
- Used by: Route modules

**Data Layer:**
- Purpose: SQLite persistence + ChromaDB vectors
- Location: `backend/app/database.py`, runtime DB `backend/db/nagraksha.db` (gitignored), `backend/chroma_db` (gitignored)
- Contains: 16 tables (Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread, KnowledgeChunk, OutboxEvent, AuditEvent, WoundReading, Responder, VillageAudit, HouseholdAudit, Stakeholder)
- Depends on: stdlib `sqlite3`, `chromadb`
- Used by: All backend layers

**Async Layer:**
- Purpose: Durable event processing, live state fan-out, scheduled jobs
- Location: `backend/app/eventbus.py` — `_worker_tick` drains outbox every 2.5 s; `backend/app/scheduler.py` — APScheduler runs compliance every 15 min
- Contains: Outbox drain, 3-lane dispatch simulation, incident state machine (`DISPATCHING → ACCEPTED → TRANSPORTING → HANDED_OFF`), audit writer, compliance job
- Used by: WebSocket/SSE endpoints and the SOS route

**External Services:**
- Purpose: AI generation, vision classification, speech-to-text, SMS, error monitoring
- Location: `backend/app/llm.py` (Groq/Grok/Gemini REST), `backend/app/routes/snake_id.py` (3 vision providers), `backend/app/routes/transcribe.py` (Groq Whisper), `backend/app/dispatch.py` + `backend/app/routes/twilio_webhook.py` (Twilio), `backend/app/main.py` (Sentry), `model/` (local GGUF)
- Auth: `GROQ_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY`, `TWILIO_*`, `SENTRY_DSN`, `JWT_SECRET` from `.env` (see `.env.example`)

## Data Flow

### Primary Request Path — Trigger SOS

1. `LiveSosDemo` collects GPS + incident details and POSTs `/api/sos` (`frontend/src/components/interactive.tsx:230` via `apiUrl`).
2. `trigger_sos` (`backend/app/routes/sos.py`) inserts `Incident` (state `DISPATCHING`) and a `PENDING` `OutboxEvent` of type `IncidentCreated` in the **same transaction** (`sos.py:22-35`), then writes an `AuditEvent` (`SOS_TRIGGERED`).
3. Response returns incident, ranked hospitals, `streamUrl` (SSE), `wsUrl` (WebSocket) and `auditUrl` (`sos.py:38-46`).
4. The outbox worker (`backend/app/eventbus.py`) drains the event and calls `_handle_incident_created` (`eventbus.py:69`): it fans out three lanes — `TRAINED`, `RESCUE`, `AMBULANCE` — inserting `DispatchAttempt` rows, emitting `DispatchAttempted` / `DispatchAccepted` bus events, and simulating first-candidate acceptance. (Note: `dispatch.py`'s real Twilio path exists but is not invoked by the worker — `eventbus.py` calls `simulate_dispatch` directly.)
5. The state machine advances `ACCEPTED → TRANSPORTING → HANDED_OFF` with sleeps between transitions (`eventbus.py:113-118`) and a `HANDOFF` audit.
6. The victim UI receives the initial snapshot + live events over SSE (`frontend/src/components/interactive.tsx:245`); server generator in `backend/app/routes/incidents.py:88-121` subscribes to bus events and re-emits with 15 s heartbeats, closing after `HANDED_OFF`. The WebSocket channel (`backend/app/routes/ws.py`) also exists for push (`broadcast()`), consumed by the wound tracker updates.

### Secondary Flow — Myth-Buster RAG

1. `MythBuster` panel POSTs `/api/myth-buster` (`frontend/src/components/interactive.tsx:846`).
2. `ask` (`backend/app/routes/myth_buster.py`) calls `rag_answer` (`backend/app/rag.py:171`): ChromaDB semantic retrieval of top-5 chunks (fallback TF-IDF; category boosts `MYTH` 1.08 / `FIRST_AID` 1.06).
3. An emergency-keyword guard (`EMERGENCY_RE`, `rag.py:117`) short-circuits to a fixed triage answer.
4. Otherwise `generate` (`backend/app/llm.py:178`) tries local GGUF → Groq → Grok → Gemini; on total failure the top chunk is returned verbatim (`source: rag-retrieval-only`).
5. Result + retrieved docIds are persisted to `MythThread` and audited (`myth_buster.py:19-30`).

### Secondary Flow — Snake Photo/Text ID

1. `SnakeIdUpload` panel POSTs `/api/snake-id` (`frontend/src/components/interactive.tsx:670`).
2. `identify` (`backend/app/routes/snake_id.py:341`) tries three vision providers in order: Groq `llama-3.2-11b-vision-instruct` → Grok `grok-2-vision-latest` → Gemini 2.5 Flash.
3. Text-only input falls back to keyword matching over the 11-species `CATALOGUE` (`snake_id.py:307-339`), with mimic warnings; responses always carry the medical disclaimer.

### Secondary Flow — Wound Reading / Pre-Arrival Packet

1. `WoundTracker` POSTs image + pixel measurement to `/api/wound/{incident_id}/reading` (`frontend/src/components/wound-tracker.tsx:111`, mounted in `interactive.tsx`).
2. `submit_wound_reading` (`backend/app/routes/wound.py`) calls Gemini Vision `analyze_wound_image` (`backend/app/llm.py:262`) with a pixel-based fallback, stores a `WoundReading`, and broadcasts `WOUND_UPDATE` over WebSocket (`wound.py:78-89`).
3. `GET /api/wound/{incident_id}/packet` assembles the pre-arrival hospital packet (`wound.py:117-173`); `GET /api/wound/{incident_id}/trend` feeds the Recharts severity chart.

### Secondary Flow — ASHA Village Audit

1. `AshaAuditTool` creates a village audit session (`POST /api/audit/village`, `backend/app/routes/audit.py:47`) then submits household forms (`POST /api/audit/village/{id}/household`).
2. `compute_household_risk` (`audit.py:15-33`) produces a weighted 0-100 risk score; `VillageAudit` aggregates `householdsVisited` and `aggregateRiskScore` (`audit.py:101-110`).
3. `DistrictRiskMap` fetches GP-level profiles via `GET /api/audit/district/{district}`.

**State Management:**
- Server-authoritative: SQLite is the source of truth; the browser holds ephemeral UI state (useState + Zustand store `frontend/src/store/sos-store.ts`)
- Live state: WebSocket (`frontend/src/lib/realtime.ts`) and SSE snapshots + events; EventSource auto-reconnects
- Outbox rows carry event state `PENDING | PROCESSED | FAILED` with an attempt counter (max 4 attempts)

## Key Abstractions

**Transactional Outbox / Event Bus:**
- Purpose: Durable event emission decoupled from request handling
- Examples: `append_outbox` (`backend/app/eventbus.py:44`), `OutboxEvent` table (`backend/app/database.py:135`), `_worker_tick` drain (`eventbus.py:129`), `subscribe`/`unsubscribe` (`eventbus.py:20-31`)
- Pattern: Write-ahead event row in the same DB transaction as the aggregate write; poller dispatches; retries with max 4 attempts then `FAILED`

**Hospital Ranking Score:**
- Purpose: Antivenom-aware routing (distance 40%, stock freshness 30%, compliance 30%)
- Examples: `rank_hospitals` (`backend/app/domain.py:103`), consumed by `get_ranked_hospitals` (`backend/app/eventbus.py:181`), surfaced at `/api/hospitals` and inside the SOS response
- Pattern: Composite scoring: distance penalty (max 50 km → 100), freshness from `stock_freshness` (CONFIRMED 100 decaying after 2 h, LOW 55, UNKNOWN 30, STALE 15, OUT 0), compliance score 0-100 from `backend/app/compliance.py`; sorted descending, `recommended` = rank 1

**LLM Provider Fallback Chain:**
- Purpose: One `generate()` call that never throws
- Examples: `generate` (`backend/app/llm.py:178`), `is_available` (`llm.py:250`), local model autodetect `_find_model` (`llm.py:43`)
- Pattern: Try local GGUF → Groq → Grok → Gemini; each adapter returns `None` on missing key/HTTP error; caller falls back to retrieval-only

**WebSocket Broadcast:**
- Purpose: Push incident + wound events to all viewers
- Examples: `broadcast` (`backend/app/routes/ws.py:49`), `_connections` map, client `useIncidentSocket` (`frontend/src/lib/realtime.ts`)
- Pattern: Per-incident connection list; broadcast serializes `{event, data}` JSON; dead connections pruned on send failure

**JWT Role Auth:**
- Purpose: Minimal RBAC for quota-burning/admin routes
- Examples: `create_token`/`require_role` (`backend/app/auth.py`), `POST /api/auth/token` (`backend/app/main.py:53`)
- Pattern: HS256 tokens with role claim, 24 h expiry; role secrets from env; `require_role()` returns a FastAPI dependency

**`get_conn()` Connection Manager:**
- Purpose: Single SQLite connection per operation with commit/rollback
- Examples: `backend/app/database.py:170-182`; used everywhere in routes/eventbus/rag
- Pattern: `@contextmanager` yielding `sqlite3.Row` rows with `PRAGMA foreign_keys = ON`; commits on success, rolls back on exception

## Entry Points

**Backend FastAPI app:**
- Location: `backend/app/main.py:36` (`app = FastAPI(...)`); lifespan at `:30-35` runs `db.init_db()`, `ensure_kb_seeded()`, `start_worker()`, `start_scheduler()`
- Run: `python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (`scripts/dev.sh`, root `package.json`)
- Health: `GET /api/health` (`main.py:47`)

**Registered API routers (endpoints):**
- `backend/app/routes/sos.py:13` — `POST /api/sos`
- `backend/app/routes/incidents.py` — `GET /api/incidents/{id}`, `GET /api/incidents/{id}/audit`, `POST /api/incidents/{id}/symptoms`, `PATCH /api/incidents/{id}/accept`, `PATCH /api/incidents/{id}/decline`, `GET /api/incidents/{id}/stream` (SSE)
- `backend/app/routes/ws.py:20` — `WS /ws/incidents/{id}` (WebSocket)
- `backend/app/routes/hospitals.py` — `GET /api/hospitals`, `PATCH /api/hospitals/{hid}/stock`
- `backend/app/routes/risk.py:17` — `GET /api/risk`
- `backend/app/routes/snake_id.py:341` — `POST /api/snake-id`
- `backend/app/routes/myth_buster.py:12` — `POST /api/myth-buster`
- `backend/app/routes/stats.py:11` — `GET /api/stats`
- `backend/app/routes/ops.py` — `GET /api/audit`, `GET /api/outbox`, `GET /api/knowledge-base`
- `backend/app/routes/architecture.py:10` — `GET /api/architecture` (self-describing system manifest)
- `backend/app/routes/transcribe.py` — `POST /api/transcribe`, `POST /api/transcribe-b64`
- `backend/app/routes/wound.py` — `POST /api/wound/{id}/reading`, `GET /api/wound/{id}/trend`, `GET /api/wound/{id}/packet`
- `backend/app/routes/audit.py` — `POST /api/audit/village`, `POST /api/audit/village/{id}/household`, `GET /api/audit/village/{id}`, `GET /api/audit/district/{district}`, `GET /api/audit/districts`
- `backend/app/routes/stakeholders.py` — `GET/POST /api/stakeholders` (POST admin-only), `DELETE /api/stakeholders/{id}` (admin-only)
- `backend/app/routes/twilio_webhook.py` — `POST /webhook/twilio`, `POST /api/responders`, `GET /api/responders`
- `backend/app/main.py:53` — `POST /api/auth/token`

**Frontend entry points:**
- `frontend/src/app/layout.tsx` — root layout (metadata, fonts, SW registration, Toaster)
- `frontend/src/app/page.tsx` — single route `/`; role switch via `activeRole` state (9 roles)
- PWA shell: `frontend/public/sw.js` (precache, network-first navigation, `NetworkOnly` for API), `frontend/public/manifest.webmanifest`, `frontend/public/offline.html`

## Architectural Constraints

- **Threading:** Backend uses a single daemon outbox poller thread (`backend/app/eventbus.py:177`) that blocks on `time.sleep` while simulating dispatch; APScheduler runs the compliance job on the async loop (`backend/app/scheduler.py`); FastAPI sync endpoints run in the default threadpool; SSE handlers and WebSocket are async. Shared state guarded by `_bus_lock` (`eventbus.py:18`), `_lock`/`_index_lock`/`_tfidf_lock` (`backend/app/rag.py`), `_lock` (`backend/app/llm.py`), `_connections` dict (single-threaded event loop, `backend/app/routes/ws.py`).
- **Global state (module singletons):** `_subscribers`/`_worker_started` (`backend/app/eventbus.py`), `_client`/`_collection`/`_tfidf_index` (`backend/app/rag.py`), `_model`/`_model_path` (`backend/app/llm.py`), `_scheduler` (`backend/app/scheduler.py`), `_connections` (`backend/app/routes/ws.py`), `GLOBAL`-attached bus in legacy frontend tests.
- **Schema ownership:** The authoritative schema is the raw SQL in `backend/app/database.py:SCHEMA`; `migrate_db()` handles `ALTER TABLE` additions. The legacy Prisma schema (`frontend/prisma/schema.prisma`) has been removed.
- **Gateway convention:** Frontend calls the backend through absolute `NEXT_PUBLIC_BACKEND_URL` (`frontend/src/lib/api.ts`) with a dev rewrite in `frontend/next.config.ts`; no more `?XTransformPort=8000`.
- **CORS:** Backend allowlist is `http://localhost:3000` / `http://127.0.0.1:3000` plus optional `FRONTEND_URL` env (`backend/app/main.py:36`); production deployments must go through the same-origin gateway.
- **Authentication:** Minimal JWT role auth — only stakeholder write routes and the token endpoint are protected; most endpoints are open.

## Anti-Patterns

### Dual-Language Domain Duplication

**What happens:** The same business logic — haversine, road factor, ETA, stock freshness, hospital ranking, dispatch simulation — exists in Python (`backend/app/domain.py`) and in TypeScript (`frontend/src/lib/nagraksha.ts`), and the two can drift (e.g. `stockFreshness` freshness thresholds differ: Python treats `CONFIRMED` ≤ 120 min as fresh at `domain.py:54` while the TS copy at `frontend/src/lib/nagraksha.ts:37-43` has a separate ≤ 30 min branch).
**Why it's wrong:** Two sources of truth for ranking/ETA math; fixes must be applied twice; the TS copy is only exercised by unit tests and its `rankHospitals` scoring (100 − 0.6·ETA style) differs from the Python composite score (distance/stock/compliance weights).
**Do this instead:** Treat `backend/app/domain.py` as the single source of truth (the runtime UI already calls the backend for ranking via `/api/hospitals`), and delete the TS mirror + its tests (`frontend/src/lib/nagraksha.ts`, `frontend/src/lib/__tests__/nagraksha.test.ts`).

### Dead Twilio Dispatch Module

**What happens:** `backend/app/dispatch.py` implements real Twilio SMS dispatch (`do_dispatch`, `get_nearest_responders`), but nothing imports it — `backend/app/eventbus.py` calls `simulate_dispatch()` directly (verified: no references to `dispatch.py` outside the file).
**Why it's wrong:** The headline "real SMS dispatch" feature is not wired into the incident flow; the responder registry (`/api/responders`) exists but SMS is never sent from an SOS.
**Do this instead:** Call `do_dispatch()` from `_handle_incident_created` in `backend/app/eventbus.py` when real responders are registered (keep the simulation fallback), and persist SMS attempt SIDs in `DispatchAttempt`.

### Mega-Component Files

**What happens:** `frontend/src/components/interactive.tsx` (1791 lines) contains 10 exported panels; `frontend/src/components/sections.tsx` (826 lines) exports 12 components, most of which (`Hero`, `Problem`, `ParallelDispatch`, `HowItFlows`, `Roles`, `Prevention`, `Routing`, `Roadmap`) are **not rendered** by `frontend/src/app/page.tsx` — only `TopAppBar`, `NavigationDrawer`, `SiteFooter` are imported.
**Why it's wrong:** Poor discoverability, merge conflicts, dead marketing sections add bundle/type-check surface (they pull in `Reveal`/`SlitherSprite`).
**Do this instead:** Split panels into one file per component under `frontend/src/components/panels/`; delete the unrendered sections from `frontend/src/components/sections.tsx`. Also remove orphaned `frontend/src/components/tri-line-dock.tsx` and `snake-progress.tsx` (no importers) and `frontend/src/lib/realtime.ts` (unused — `useIncidentSocket` has no callers).

### Client Calls Hardcoded Fake Incident IDs

**What happens:** `SymptomLogger` defaults to `incidentId = 'NR-1042'` (`frontend/src/components/interactive.tsx:1651`) and `frontend/src/app/page.tsx` passes `incidentId="NR-1042"`, but real incidents use 24-char hex IDs. The Responder view's "Accept Dispatch"/"Decline" buttons (`frontend/src/app/page.tsx:220-228`) have no `onClick` handlers.
**Why it's wrong:** Responder/hospital role views promise actions that silently fail against real data.
**Do this instead:** Wire accept/decline to `PATCH /api/incidents/{id}/accept|decline` with a real incident ID, or remove the demo buttons.

### Time-Sleep Simulation Inside the Worker

**What happens:** The outbox handler blocks the single worker thread with `time.sleep` for simulated accept delays and state transitions (`backend/app/eventbus.py:97-118` — ≈4-5 s per incident); only one incident processes at a time.
**Why it's wrong:** A real fan-out would be parallel/async; the queue stalls behind the sleep.
**Do this instead:** Accept for the demo, but note that a real implementation would move delays into per-lane timers/async tasks or a job queue.

## Error Handling

**Strategy:** Fail-open everywhere. Providers degrade rather than crash; audit writes are best-effort; the outbox marks events `FAILED` after 4 attempts instead of blocking the queue.

**Patterns:**
- LLM adapters return `None` on missing key or any HTTP/JSON error (`backend/app/llm.py:58-176`); `generate` returns `None` when all four fail (`llm.py:219`); wound analysis falls back to pixel-based estimates when Gemini is unavailable (`llm.py:262-294`).
- RAG falls back `rag-llm-chromadb → rag-retrieval-only → fallback` (`backend/app/rag.py:171-202`), with a regex emergency guard short-circuit.
- Audit is wrapped in try/except and silently skipped (`backend/app/eventbus.py:55-65`).
- Worker `_worker_tick` is fully guarded (`eventbus.py:129-163`); subscriber exceptions are swallowed (`eventbus.py:39-43`).
- Twilio SMS failures log and return `None`; dispatch falls back to simulation (`backend/app/dispatch.py:66-73`).
- Frontend panels use sonner `toast.success/error`; the service worker never caches API responses (`frontend/public/sw.js` header comment, `NetworkOnly`).
- Compliance job catches all exceptions and logs (`backend/app/compliance.py:63-67`).

## Cross-Cutting Concerns

**Logging:** Process logs to `backend.log` / `dev.log` via `tee` in root npm scripts (`package.json`); structured domain events go to the `AuditEvent` table, inspectable at `GET /api/audit` (`backend/app/routes/ops.py:10`); `print()` in compliance/dispatch/RAG modules.
**Validation:** Pydantic for API bodies (`backend/app/models.py`); typed query params with ranges on hospitals (`backend/app/routes/hospitals.py:13-18`); raw SQL row-mapping everywhere else. `risk.py` and `ops.py` still use untyped `float()`/`int()` casts on query params (see CONCERNS.md).
**Authentication:** Minimal JWT role auth — `POST /api/auth/token` (rate-limited) issues role tokens; `require_role("system_admin")` guards stakeholder writes; everything else is open. Rate limiting via slowapi at 200/min default (`backend/app/main.py:29`).
**Monitoring:** Sentry optional via `SENTRY_DSN`; `/api/health` returns service version.

---

*Architecture analysis: 2026-08-13*
