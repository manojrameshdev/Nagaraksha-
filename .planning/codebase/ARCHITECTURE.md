# Architecture

**Analysis Date:** 2026-08-15

## Pattern Overview

**Overall:** Full-stack monorepo — Next.js (App Router) SPA frontend + monolithic FastAPI backend, with a transactional outbox + in-process event bus for real-time dispatch coordination.

**Key Characteristics:**
- Two independent services: FastAPI on `:8000`, Next.js on `:3000`, wired via REST + WebSocket
- Backend is a layered monolith: route modules → domain helpers → SQLite/ChromaDB data layer
- Event-driven dispatch: transactional write → durable outbox → worker threads fan out 3 parallel lanes → WebSocket broadcast
- Local-first demo: SQLite + ChromaDB on disk, optional external LLM/SMS providers with graceful fallbacks
- Role-based demo auth (victim / hospital_admin / system_admin) via JWT

## Layers

**Frontend (React/Next.js):**
- Purpose: Role-based emergency workspaces, SOS trigger, incident tracking
- Contains: App Router pages (`frontend/app/`), client components (`frontend/components/`), hooks (`frontend/hooks/`), Zustand store (`frontend/store/sos-store.ts`), API client (`frontend/lib/`)
- Depends on: Backend REST (`frontend/lib/api.ts`) and WebSocket (`frontend/lib/realtime.ts`)
- Used by: end users (Victim, Hospital, First-aider roles)

**API Layer (FastAPI routes):**
- Purpose: HTTP surface — SOS, incidents, hospitals, risk, snake ID, myth buster, stats, audit, stakeholders, transcribe, wound, ops, architecture
- Contains: 16 route modules in `backend/app/routes/`; Pydantic request models in `backend/app/models.py`
- Depends on: domain/data/event layers
- Used by: frontend client, Twilio webhook

**Domain Layer:**
- Purpose: Business logic — geo ranking, ETA, dispatch simulation, compliance scoring, household risk
- Contains: `backend/app/domain.py`, `backend/app/dispatch.py`, `backend/app/compliance.py`, `backend/app/audit.py` (route module with scoring), `backend/app/llm.py`, `backend/app/rag.py`
- Depends on: data layer, external providers (Twilio, LLM APIs)
- Used by: API routes and the outbox worker

**Data Layer:**
- Purpose: Persistence — SQLite relational store + ChromaDB vector store
- Contains: `backend/app/database.py` (schema + `get_conn()` context manager), `backend/app/seed.py` (seed data), `backend/app/knowledge_base_data.py` (KB corpus), `backend/chroma_db/`
- Depends on: nothing internal
- Used by: all other layers

**Event/Realtime Layer:**
- Purpose: Durable outbox processing + in-process pub/sub + WebSocket push
- Contains: `backend/app/eventbus.py` (outbox worker, `ThreadPoolExecutor(max_workers=4)`, subscribe/emit), `backend/app/routes/ws.py` (per-incident WebSocket channels, `broadcast_sync` from worker threads), `backend/app/scheduler.py` (APScheduler 15-min compliance job)
- Depends on: dispatch + data layers
- Used by: SOS/incident routes, clients via WS

## Data Flow

**SOS Trigger (HTTP + Outbox):**
1. Client `POST /api/sos` (`backend/app/routes/sos.py`) with lat/lng/address
2. Route inserts `Incident` (state `DISPATCHING`) **and** an `OutboxEvent` (`IncidentCreated`) in one transaction
3. Audit event (`SOS_TRIGGERED`) appended to `AuditEvent`
4. Response returns incident + ranked hospitals + `wsUrl`/`streamUrl`/`auditUrl`
5. Outbox worker (`backend/app/eventbus.py`) picks up the PENDING event and fans out 3 parallel dispatch lanes (ambulance, hospital, first-aider/snake rescue)
6. Each lane sends SMS via Twilio (or `simulate_dispatch()` in demo), records `DispatchAttempt`, and broadcasts WS events (`dispatch_attempted`, `dispatch_accepted`, `incident_state`)
7. Client receives updates over `ws://…/ws/incidents/{id}` (`frontend/lib/realtime.ts` → `frontend/store/sos-store.ts`)

**Responder ACCEPT (Webhook):**
1. Twilio calls `POST /webhook/twilio` with SMS reply
2. Signature validated (when token configured); responder matched by phone
3. `DispatchAttempt` updated to ACCEPTED/DECLINED; WS broadcast pushes the state change
4. Client's incident page reflects it live (`frontend/app/incidents/[id]/page.tsx`)

**RAG Question (Chatbot/Myth buster):**
1. `GET/POST` knowledge-base route (`backend/app/routes/myth_buster.py`, `backend/app/routes/ops.py`)
2. `rag.retrieve()` embeds the query via ChromaDB and returns top-k chunks
3. `llm.generate()` tries local GGUF → Grok → Gemini; if none available, returns retrieval-only answer

**State Management:**
- Backend: SQLite is the source of truth; outbox is the durable event log; WebSocket is a live projection
- Frontend: Zustand store (`frontend/store/sos-store.ts`) holds incident + dispatch lanes; WS events mutate it, then a full incident refetch re-syncs

## Key Abstractions

**Route module (APIRouter):**
- Purpose: One feature = one module with its own router, included in `backend/app/main.py`
- Examples: `backend/app/routes/sos.py`, `incidents.py`, `hospitals.py`, `stakeholders.py`, `ws.py`
- Pattern: FastAPI `APIRouter` + Pydantic models

**database.get_conn():**
- Purpose: Context-managed SQLite connection with WAL, FK enforcement, commit/rollback
- Examples: used in nearly every route module
- Pattern: context manager; `db.new_id()` (24-hex uuid), `db.now_iso()` (UTC ISO with `Z`)

**Outbox / eventbus:**
- Purpose: Durable event queue decoupling request handling from dispatch side-effects
- Examples: `append_outbox`, `start_worker`, `broadcast_sync` in `backend/app/eventbus.py`
- Pattern: transactional outbox + bounded `ThreadPoolExecutor` + in-process pub/sub

**API client (frontend/lib/api.ts + nagraksha.ts):**
- Purpose: Typed fetch wrapper with Bearer token injection and `ApiError`
- Examples: `apiFetch`, `triggerSos`, `getIncident`, `updateStock`
- Pattern: generic `apiFetch<T>` + per-endpoint typed functions

**Role-based auth:**
- Purpose: Protect mutating routes by role
- Examples: `require_role("hospital_admin", "system_admin")` in `backend/app/auth.py`
- Pattern: JWT (HS256) dependency injection, optional enforcement

## Entry Points

**Backend:**
- `backend/app/main.py` — FastAPI app factory; lifespan runs `init_db()`, `ensure_kb_seeded()`, `ws.set_loop()`, `start_worker()`, `start_scheduler()`; mounts all routers; `GET /api/health`
- `backend/run.sh` — uvicorn launcher (`app.main:app` on `:8000`)

**Frontend:**
- `frontend/app/layout.tsx` — root layout (metadata, Vercel Analytics)
- `frontend/app/page.tsx` — home: role picker + one-tap SOS (`handleSos` → `triggerSos` → router push to `/incidents/{id}`)
- `frontend/app/incidents/[id]/page.tsx` — live incident tracking (WS + refetch loop)

## Error Handling

**Strategy:** Backend raises HTTP exceptions at the route boundary; frontend surfaces them as typed `ApiError` with status.

**Patterns:**
- FastAPI `HTTPException` (404s for missing incidents, 401 for auth) with JSON `detail`
- Global `RateLimitExceeded` handler via slowapi (`backend/app/main.py`)
- Backend helper functions swallow/retry best-effort background work (outbox retries with `attempts` count, WS broadcast try/except)
- Frontend `ApiError` thrown on `!res.ok` (`frontend/lib/api.ts`); stores/hooks catch and expose `error` state — no console usage (lint forbids `console`)
- `sentry_sdk` captures unhandled exceptions when DSN configured

## Cross-Cutting Concerns

**Logging:**
- Backend: uvicorn stdout; no structured logger. Audit trail is a first-class concern: every mutating action appends to `AuditEvent` (`backend/app/eventbus.py` `audit()`)

**Validation:**
- Pydantic models at the API boundary (`backend/app/models.py`)
- Frontend: TypeScript types mirror backend response shapes (`frontend/lib/nagraksha.ts`); MSW handlers keep tests honest

**Authentication:**
- JWT middleware via `Depends` on protected routes; demo role secrets in env; production guard in `auth.py`
- Frontend stores token in `localStorage` and attaches `Authorization: Bearer` in `apiFetch`

**Rate limiting:**
- slowapi default `200/minute`; `POST /api/auth/token` limited to `10/minute`

**Real-time:**
- WebSocket per incident (`backend/app/routes/ws.py`); client auto-reconnects with 2s backoff + 10s ping (`frontend/lib/realtime.ts`)
- SSE `/stream` endpoint retained for backward compat (`backend/app/routes/incidents.py`) but the frontend uses WS

---

*Architecture analysis: 2026-08-15*
*Update when major patterns change*
