# Architecture

**Analysis Date:** 2026-07-25

## Pattern Overview

**Overall:** Modular monolith with an event-driven core.

NagRaksha is built as a two-service system (Next.js frontend + Python FastAPI backend) with no external message broker. The backend uses an in-process event bus backed by a durable SQLite outbox table. This pattern is chosen explicitly for hackathon velocity while preserving clean domain boundaries that could later be split into microservices.

**Key Characteristics:**
- Separate frontend (Next.js 16, TypeScript, React 19) and backend (Python 3.12, FastAPI, scikit-learn)
- No ORM on the backend — pure `sqlite3` raw SQL
- Prisma ORM on the frontend (Node prototype data layer, kept for schema consistency)
- Caddy reverse proxy gateway on port 81 routing `?XTransformPort=8000` to the backend
- Single-launcher script `start.py` that starts both services
- All UI views co-located on a single Next.js page with lazy-loaded client components
- In-process event bus with `threading.Thread` worker (backend) / `EventEmitter` (frontend prototype)
- Durable outbox pattern: transactional insert into `OutboxEvent` table, background poller drains events

## High-Level Architecture

```
User Browser/Phone
    │
    ▼
Caddy Gateway (:81)
    │
    ├── ?XTransformPort=8000  ──►  Python FastAPI (:8000)
    │                                   │
    │                                   ├── /api/sos          → Incident + Outbox
    │                                   ├── /api/incidents    → Incident CRUD + SSE
    │                                   ├── /api/myth-buster  → RAG pipeline
    │                                   ├── /api/snake-id     → Mock CV
    │                                   ├── /api/risk         → Risk advisory
    │                                   ├── /api/hospitals    → Hospital ranking
    │                                   ├── /api/stats        → Admin analytics
    │                                   ├── /api/audit        → Audit trail
    │                                   ├── /api/outbox       → Outbox state
    │                                   ├── /api/knowledge-base → KB browser
    │                                   └── /api/architecture → System manifest
    │
    └── (default)            ──►  Next.js (:3000)
                                        │
                                        ├── src/app/page.tsx      → Single-page app
                                        ├── src/app/layout.tsx    → Root layout + PWA
                                        ├── src/components/      → React components
                                        └── src/lib/             → API helpers + domain
```

## Layers

**Client Layer (PWA):**
- Purpose: Browser-based single-page application, installable as PWA
- Location: `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/`
- Contains: `layout.tsx`, `page.tsx`, all React components, hooks, API helpers
- Depends on: Backend API via `api.ts` helper (appends `?XTransformPort=8000`)
- Used by: End users via browser/PWA

**API Layer (FastAPI):**
- Purpose: Exposes REST endpoints for all frontend operations
- Location: `backend/app/main.py`, `backend/app/routes/`
- Contains: 9 route modules (sos, incidents, hospitals, risk, snake_id, myth_buster, stats, ops, architecture)
- Depends on: `database.py`, `models.py`, `eventbus.py`, `rag.py`, `llm.py`, `domain.py`
- Used by: Frontend (via Caddy gateway)

**Core Domain Layer:**
- Purpose: Encapsulates business logic for each domain aggregate
- Location: `backend/app/`
- Contains:
  - `domain.py` — geo helpers (`haversine_km`, `road_km`, `eta_min`), hospital ranking (`rank_hospitals`), dispatch simulation (`simulate_dispatch`)
  - `models.py` — Pydantic request models (`SosRequest`, `StockUpdate`, `MythRequest`, `SnakeIdRequest`)
  - `rag.py` — RAG pipeline: TF-IDF retrieval + LLM generation + emergency guard
  - `llm.py` — LLM fallback chain (local GGUF → Grok → Gemini)
  - `eventbus.py` — In-process event bus, outbox worker, audit logger, hospital ranking

**Data Layer:**
- Purpose: SQLite persistence with raw SQL (backend) and Prisma (frontend)
- Location: `backend/app/database.py`, `backend/db/nagraksha.db`, `frontend/prisma/schema.prisma`
- Contains: Table DDL, connection management (`get_conn` context manager), schema definition in Prisma
- Tables: Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread, KnowledgeChunk, OutboxEvent, AuditEvent

**Async Layer (Event Bus):**
- Purpose: Durable outbox-backed event processing for dispatch fan-out
- Location: `backend/app/eventbus.py`
- Contains: `subscribe`, `unsubscribe`, `append_outbox`, `audit`, `start_worker` (background poller)
- Pattern: Thread-based poller drains `OutboxEvent` table every 2.5s, dispatches `IncidentCreated` → `_handle_incident_created` → three independent dispatch lanes (TRAINED, RESCUE, AMBULANCE)

**External Layer:**
- LLM inference: Local GGUF (via `llama-cpp-python`), Grok API (xAI), Gemini API (Google)
- Map/routing: Not integrated (mock data in `domain.py`)
- Weather API: Not integrated (seed data in `seed.py`)

## Key Abstractions

**Outbox (Transactional Outbox Pattern):**
- Purpose: Ensures reliable event publication after database commit
- Files: `backend/app/eventbus.py` (lines 46-52), `frontend/src/lib/eventbus.ts` (lines 54-67)
- Pattern: Write event to `OutboxEvent` table in the same SQLite transaction as the Incident INSERT. A background worker polls PENDING events and dispatches them.
- Worker: `start_worker()` in `backend/app/eventbus.py` starts a daemon thread that polls every 2.5s with a max fetch of 25 events per tick. Events that fail 4+ times are marked FAILED.

**RAG Pipeline:**
- Purpose: Retrieval-augmented generation for the myth-buster assistant
- Files: `backend/app/rag.py`, `backend/app/llm.py`, `backend/app/knowledge_base_data.py`
- Pattern:
  1. `retrieve(query, k=4)` → TF-IDF vectorization + cosine similarity over `KnowledgeChunk` corpus with category boosts (MYTH +1.08, FIRST_AID +1.06)
  2. `rag_answer(question)` → emergency guard regex check → if LLM available, generate with RAG context → else return top chunk verbatim → else fallback message
  3. `ensure_kb_seeded()` → seeds `KnowledgeChunk` from curated corpus in `knowledge_base_data.py` (21 chunks across FIRST_AID, MYTH, SPECIES, ANTIVENOM, RISK, PROTOCOL)

**LLM Fallback Chain:**
- Files: `backend/app/llm.py`
- Order: Local GGUF (`_generate_gguf`) → Grok API (`_generate_grok`) → Gemini API (`_generate_gemini`)
- State: `_model` is a global singleton loaded once via `_load_gguf()`; thread-safe with `_lock`

**Hospital Ranking:**
- Files: `backend/app/domain.py` (lines 48-75), `backend/app/eventbus.py` (lines 182-205)
- Pattern: Score hospitals by stock status (CONFIRMED > LOW > UNKNOWN > STALE > OUT) and freshness, then by ETA. Recommended hospital = highest score.

**Incident State Machine:**
- States: `PENDING` → `DISPATCHING` → `ACCEPTED` → `TRANSPORTING` → `HANDED_OFF` → `CLOSED`
- Files: `backend/app/eventbus.py` (`_set_state`), `backend/app/routes/sos.py`
- Progression: Simulated via `time.sleep` in the outbox worker after dispatch events

## Data Flow

**SOS Dispatch Flow:**

1. User triggers SOS from frontend — `POST /api/sos` with lat/lng/optional details
2. Backend creates Incident row in SQLite with state=DISPATCHING
3. In the same transaction, appends `IncidentCreated` event to OutboxEvent table
4. Backend returns incident ID, hospital ranking, stream URL to frontend
5. Background outbox worker polls and finds the PENDING event
6. Worker calls `_handle_incident_created` which:
   a. Logs audit: `DISPATCH_FANOUT`
   b. Simulates dispatch for 3 lanes (TRAINED, RESCUE, AMBULANCE) — each with 2 candidates
   c. Inserts DispatchAttempt rows for each candidate
   d. Emits `DispatchAttempted` events (via in-process bus to SSE subscribers)
   e. After simulated delay, marks first candidate as ACCEPTED in each lane
   f. Emits `DispatchAccepted` events
   g. Advances incident state: ACCEPTED → TRANSPORTING → HANDED_OFF with delays
7. Frontend receives all events via SSE stream at `/api/incidents/{id}/stream`
8. Frontend renders live lane state (alerted/accepted) and hospital rankings

**Myth Buster Flow:**

1. User types question in chat UI → `POST /api/myth-buster` with `{question: "..."}`
2. Backend calls `rag_answer(question)`:
   a. Checks emergency regex — if matched, returns redirect to SOS
   b. Retrieves top-4 chunks via TF-IDF cosine similarity
   c. If LLM available, generates answer with system prompt + context
   d. Falls back to top chunk verbatim or generic message
3. Returns answer, sources, mythFlagged, emergency flag
4. Backend logs MythThread and AuditEvent
5. Frontend renders assistant message with source badges

**Risk Advisory Flow:**

1. Frontend calls `GET /api/risk?lat=...&lng=...`
2. Backend loads all RiskReport rows, finds nearest by haversine distance
3. Returns level (LOW/MODERATE/HIGH/SEVERE), score, advisory text, likely snakes

**State Management:**
- Backend: Stateless — all state in SQLite. In-process memory only for TF-IDF index and event bus subscribers.
- Frontend: React state via `useState`/`useRef` for UI state. SSE stream drives live incident state. No global state management library (no Redux, no Zustand).

## Entry Points

**Main Backend:**
- Location: `backend/app/main.py`
- Trigger: `uvicorn app.main:app --port 8000`
- Responsibilities: CORS setup, route registration (`include_router` for 9 modules), startup hooks (`init_db`, `ensure_kb_seeded`, `start_worker`), health endpoint

**Main Frontend (Root Layout):**
- Location: `frontend/src/app/layout.tsx`
- Responsibilities: Global metadata (PWA manifest, Open Graph, SEO), font loading (Inter, JetBrains Mono), dark theme, service worker registration, Toaster component

**Main Frontend (Page):**
- Location: `frontend/src/app/page.tsx`
- Responsibilities: Composes all sections (Hero, Problem, ParallelDispatch, HowItFlows, Roles, Prevention, Routing, Architecture, Demo, Roadmap, Footer). Uses lazy-loaded components (`@/components/lazy-sections.tsx`) with `dynamic(import(), { ssr: false })` for code-splitting below-fold sections.

**Launcher:**
- Location: `start.py`
- Triggers: `python start.py` starts both backend (uvicorn) and frontend (next dev) as subprocesses
- Signal handling: SIGINT/SIGTERM terminates both processes



## Error Handling

**Strategy:** Best-effort with fallbacks at every level.

**Patterns:**
- LLM `generate()` returns `None` on failure → caller `rag_answer()` falls back to retrieval-only or generic message
- Outbox worker retries up to 4 times, then marks event as FAILED
- Audit is best-effort (`except Exception: pass`)
- Event bus subscribers are guarded — a crash in one subscriber never kills the worker
- Frontend SSE reconnects automatically; EventSource fetches canonical state on reconnect
- Route handlers that parse query params use `.get()` with defaults (no 422 on missing params)

## Cross-Cutting Concerns

**Logging:** Not used — the backend uses `print()` in `seed.py` only. Frontend uses `sonner` toast notifications for user-facing errors. No structured logging.

**Validation:** Pydantic models for request bodies (`SosRequest`, `StockUpdate`, `MythRequest`, `SnakeIdRequest`). Query params are parsed manually with `float(request.query_params.get(...))` — no Pydantic validation for query params.

**Authentication:** Not implemented. No auth middleware, no RBAC enforcement in routes. The `/api/architecture` endpoint lists RBAC roles conceptually, but the codebase has no authentication logic. `.env.example` may contain API keys for LLM providers only.

**Audit:** `audit()` function in `eventbus.py` writes to `AuditEvent` table. Used for SOS triggers, dispatch fan-out, stock updates, and RAG queries. Best-effort — never blocks the main flow.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Modular monolith (not microservices) | Hackathon velocity; clean domain boundaries for future split |
| Raw SQL (not ORM) on backend | Dependency-light for hackathon; Prisma retained on frontend for schema consistency with Node prototype |
| SQLite (not PostgreSQL) | Zero setup, portable; satisfies hackathon constraints |
| In-process event bus (not Kafka/Redis) | No external infrastructure needed; outbox table provides durability |
| SSE (not WebSocket) | Simpler implementation; browser-native EventSource API |
| TF-IDF (not embeddings/vector DB) | No external vector DB dependency; scikit-learn is already a dependency |
| LLM fallback chain | Graceful degradation: local model free, cloud API as backup |
| Caddy gateway routing via query param | Simple routing without path prefix rewriting; single origin for frontend |
| Single-page app (not multi-route) | All marketing + demo content on one page; no routing complexity |
| Lazy-loaded components with `ssr: false` | Reduces compile memory for heavy sections; improves initial page load |

## Document Compliance

Comparison of implemented codebase against design documents in `docs/`:

| Requirement | Document | Status | Notes |
|---|---|---|---|
| FR-1.1: One-tap SOS | SRS | ✅ Implemented | `POST /api/sos`, one click in UI |
| FR-1.2: Three-way parallel dispatch | SRS | ✅ Implemented | Three lanes fan out from outbox worker |
| FR-1.3: GPS capture | SRS | ✅ Implemented | lat/lng in SOS request |
| FR-1.4: Optional bite details | SRS | ✅ Implemented | biteTime, bodyPart, snakeType optional |
| FR-1.5: Live ETA on accept | SRS | ✅ Implemented | SSE stream updates lane state |
| FR-1.6: Escalation on timeout | SRS | ⚠️ Partial | Second candidate listed but no timeout logic |
| FR-2.1: Alert trained individual | SRS | ✅ Implemented | Simulated dispatch with navigation data |
| FR-2.3: Structured symptom logging | SRS | ✅ Implemented | SymptomObservation table created |
| FR-4.2: Stock-aware ranking | SRS | ✅ Implemented | `rank_hospitals` with stock-first scoring |
| FR-4.3: Dijkstra routing | SRS | ⚠️ Partial | Mock ETA via road_km formula, no real road graph |
| FR-5.1: RAG assistant | SRS | ✅ Implemented | `rag_answer()` with TF-IDF + LLM |
| FR-5.2: Myth flagging | SRS | ✅ Implemented | `mythFlagged` in response |
| FR-5.3: Emergency redirect | SRS | ✅ Implemented | EMERGENCY_RE regex guard |
| FR-6.1: Snake photo ID | SRS | ⚠️ Partial | Text-based mock only; no actual CV model |
| FR-7.1: Weather-based risk | SRS | ✅ Implemented | RiskReport table, nearest-query |
| FR-8.1: Hospital stock console | SRS | ✅ Implemented | `PATCH /api/hospitals/{id}/stock` |
| FR-9.1: Admin dashboard | SRS | ✅ Implemented | `/api/stats` endpoint |
| NFR-4: One-tap SOS, no mandatory text | SRS | ✅ Implemented | All SOS fields optional |
| NFR-8: Audit trail | SRS | ✅ Implemented | AuditEvent table, audit() calls throughout |
| WebSocket/SSE state delivery | System Design | ✅ Implemented | SSE at `/api/incidents/{id}/stream` |
| Outbox/event IncidentCreated | System Design | ✅ Implemented | OutboxEvent table + worker |
| Three independent dispatch jobs | System Design | ✅ Implemented | Three lanes in _handle_incident_created |
| Modular monolith | System Design | ✅ Implemented | Clear domain modules in backend/app/ |
| PWA shell | System Design | ✅ Implemented | manifest.webmanifest, sw.js, offline.html |
| Offline never false-success | System Design | ✅ Implemented | SOS shows Pending until server ack |
| RBAC | System Design | ❌ Not implemented | No auth middleware; conceptual only |
| Weather API integration | SRS | ❌ Not implemented | Static seed data only |
| SMS fallback | SRS | ❌ Not implemented | |
| Multilingual UI | SRS | ❌ Not implemented | English only |
| Web Push notifications | System Design | ❌ Not implemented | SSE only |
| Real road-graph routing | System Design | ❌ Not implemented | Haversine + road factor formula |
| Per-responder role interfaces | SRS | ❌ Not implemented | Single-page demo only |

---

*Architecture analysis: 2026-07-25*
