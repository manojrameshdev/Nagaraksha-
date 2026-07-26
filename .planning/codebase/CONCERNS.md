# Codebase Concerns

**Analysis Date:** 2026-07-25

## Tech Debt

### 1. Duplicate RAG Implementation (Now Partially Resolved)
- **Issue:** The RAG pipeline was originally implemented in both frontend TypeScript (`frontend/src/lib/rag.ts`) and backend Python (`backend/app/rag.py`). The frontend copy has been deleted (shown in git history as `D frontend/src/lib/rag.ts`), but the knowledge base seed data remains duplicated.
- **Files:**
  - `backend/app/rag.py` — active RAG pipeline (TF-IDF + LLM)
  - `backend/app/knowledge_base_data.py` — Python seed data (81 lines)
  - `frontend/src/lib/knowledge-base.ts` — TypeScript seed data (203 lines)
  - `frontend/scripts/seed.ts` — TypeScript seed script using the TS knowledge base
  - `backend/app/seed.py` — Python seed script using the Python knowledge base
- **Impact:** Knowledge base content must be kept in sync across two files (`knowledge_base_data.py` and `knowledge-base.ts`). Any medical review update must be made in both places. Drift between the two corpora will cause different RAG results depending on which seed script was run last.
- **Fix approach:** Consolidate to a single source of truth. Either:
  - (a) Remove `frontend/src/lib/knowledge-base.ts` and `frontend/scripts/seed.ts`; only seed via the Python backend.
  - (b) Store knowledge base as a SQLite seed file or JSON and have both scripts read from the same source.

### 2. Frontend Accesses Prisma/DB Directly (Security Concern + Architectural Violation)
- **Issue:** The frontend Next.js client code (`frontend/src/lib/eventbus.ts`) imports Prisma directly via `import { db } from "@/lib/db"` and performs database CRUD operations — creating dispatch attempts, updating incidents, querying hospitals, etc. This code runs server-side in Next.js API routes/SSR, but it means the frontend monolith performs DB writes that bypass the Python backend API entirely.
- **Files:**
  - `frontend/src/lib/db.ts` — exports PrismaClient singleton
  - `frontend/src/lib/eventbus.ts` — uses `db.dispatchAttempt.create()`, `db.incident.update()`, `db.outboxEvent.findMany()`, `db.hospital.findMany()`
  - `frontend/src/lib/nagraksha.ts` — contains domain logic duplicated from Python backend
- **Impact:** The event bus / outbox worker runs in two places: Python backend (`backend/app/eventbus.py`) and frontend Node.js (`frontend/src/lib/eventbus.ts`). Events processed by the frontend worker write directly to SQLite via Prisma, while the Python backend uses raw SQL to the same DB file. This dual-writer pattern can cause race conditions, data inconsistency, and makes the architecture both harder to understand and harder to secure.
- **Fix approach:** Remove the frontend event bus entirely. All event processing should happen in the Python backend. The frontend should only call the Python API (as done in `frontend/src/lib/api.ts` via `apiUrl()`).

### 3. Duplicated Domain Logic Between Frontend and Backend
- **Issue:** Core domain logic (haversine distance, hospital ranking, dispatch simulation, freshness calculations) is implemented twice:
  - `frontend/src/lib/nagraksha.ts` — TypeScript (135 lines)
  - `backend/app/domain.py` — Python (97 lines)
- **Files:**
  - `frontend/src/lib/nagraksha.ts` — `haversineKm()`, `roadKm()`, `etaMin()`, `stockFreshness()`, `rankHospitals()`, `simulateDispatch()`
  - `backend/app/domain.py` — `haversine_km()`, `road_km()`, `eta_min()`, `stock_freshness()`, `rank_hospitals()`, `simulate_dispatch()`
  - `backend/app/eventbus.py` — also imports and uses `get_ranked_hospitals()`
  - `frontend/src/lib/eventbus.ts` — also imports and uses `rankHospitals()` and `simulateDispatch()`
- **Impact:** Any change to ranking logic, ETA formulas, or dispatch simulation must be updated in both languages. Logic divergence will cause the Python backend and frontend Node process to produce different hospital rankings or dispatch simulations.
- **Fix approach:** Remove duplicated domain logic from the frontend. The frontend should only display data returned by the Python API.

### 4. Seed Data Duplicated Across Stack
- **Issue:** Hospital seed data, risk report seed data, and knowledge base chunks exist in three places:
  - `frontend/scripts/seed.ts` (160 lines) — TypeScript Prisma-based seeder
  - `backend/app/seed.py` (63 lines) — Python SQL-based seeder
  - `frontend/src/lib/knowledge-base.ts` (203 lines) — TS knowledge base data used by `seed.ts`
  - `backend/app/knowledge_base_data.py` (81 lines) — Python knowledge base data used by `rag.py`
- **Impact:** Seed data can drift. The Python `seed.py` deletes and re-inserts hospitals while the frontend `seed.ts` uses upsert semantics. Knowledge base content in `knowledge_base_data.py` and `knowledge-base.ts` must be manually kept in sync.
- **Fix approach:** Consolidate all seeding to the Python backend. Remove `frontend/scripts/seed.ts`, `frontend/src/lib/knowledge-base.ts`.

### 5. All TypeScript ESLint Rules Disabled
- **Issue:** The ESLint config at `eslint.config.mjs` explicitly disables **19 rules**, including:
  - `@typescript-eslint/no-explicit-any`: "off"
  - `@typescript-eslint/no-unused-vars`: "off"
  - `no-unused-vars`: "off"
  - `no-console`: "off"
  - `no-debugger`: "off"
  - `prefer-const`: "off"
  - `no-case-declarations`: "off"
  - `no-irregular-whitespace`: "off"
  - `react-hooks/exhaustive-deps`: "off"
  - `@next/next/no-img-element`: "off"
  - `@next/next/no-html-link-for-pages`: "off"
  - Plus 9 more disabled rules
- **Impact:** Dead code, unused imports, implicit `any` types, console.log statements, and broken dependency arrays in hooks will not be caught. Code quality degrades silently. The `no-explicit-any` disable means TypeScript's primary value (type safety) is largely negated.
- **Fix approach:** Re-enable rules incrementally. Start with `no-unused-vars`, `no-console`, and `prefer-const`. Fix violations in batches. Keep `no-explicit-any` off only for pragmatic cases, not globally.

### 6. TypeScript `ignoreBuildErrors: true` in Production Builds
- **Issue:** `frontend/next.config.ts` sets `typescript: { ignoreBuildErrors: true }`. This means TypeScript errors (including type errors, missing types, and broken imports) will not fail the production build.
- **Impact:** Type errors can ship to production. The application may crash at runtime on code paths that have type mismatches. This undermines the entire benefit of using TypeScript.
- **Fix approach:** Remove `ignoreBuildErrors: true` and fix all type errors. At minimum, set it to `false` in CI.

### 7. Frontend `reactStrictMode: false`
- **Issue:** `frontend/next.config.ts` sets `reactStrictMode: false`. Strict Mode helps detect potential issues by double-invoking effects and rendering functions.
- **Impact:** Side-effect bugs, memory leaks from missing cleanup functions, and impure render functions may go undetected during development.
- **Fix approach:** Set `reactStrictMode: true` in `frontend/next.config.ts` and fix the resulting double-invocation warnings.

### 8. `noImplicitAny: false` in tsconfig
- **Issue:** `frontend/tsconfig.json` sets `noImplicitAny: false`. This allows TypeScript to infer `any` for variables without explicit type annotations.
- **Impact:** Type safety is silently bypassed. Combined with `no-explicit-any` being disabled, most of the codebase effectively runs with untyped variables.
- **Fix approach:** Set `noImplicitAny: true` and add explicit type annotations throughout.

### 9. In-Process Event Bus / Outbox Pattern Has Reliability Concerns
- **Issue:** Both the frontend (`frontend/src/lib/eventbus.ts`) and backend (`backend/app/eventbus.py`) implement an in-process event bus with a polling outbox worker. Key concerns:
  - The frontend outbox worker runs in the Node.js process via `setInterval`. If the process restarts (e.g., during dev hot-reload), pending outbox events could be lost or duplicated.
  - The Python worker is a daemon thread (`threading.Thread(daemon=True)`). If the main thread exits, the worker is killed immediately, potentially leaving events unprocessed.
  - Both workers have a 2.5s poll interval, which means events are not processed in real-time.
  - Error handling swallows exceptions silently: `except Exception: pass` in multiple places.
  - The frontend worker updates the outbox event to PROCESSED before the handlers finish (handlers are fire-and-forget via `.catch(() => {})`), meaning a handler failure could lose the event.
- **Files:**
  - `frontend/src/lib/eventbus.ts` — lines 201-256 (outbox worker)
  - `backend/app/eventbus.py` — lines 130-179 (outbox worker)
- **Impact:** In production, outbox events could be lost, duplicated, or left in PENDING/FAILED state without alerting. The silent error handling makes debugging near impossible.
- **Fix approach:** For hackathon: Accept as known limitation. For production: Replace with a proper message queue (Redis pub/sub, RabbitMQ, or AWS SQS). At minimum, add error logging instead of silent `except Exception: pass`.

### 10. Hardcoded Strings in Components
- **Issue:** UI components contain hardcoded strings for labels, descriptions, and placeholders throughout the frontend. No i18n or string extraction is used.
- **Files:**
  - `frontend/src/components/sections.tsx` — hundreds of hardcoded strings (e.g., "Nagathon · 2026 · PWA", "One tap. Three responders dispatched...", etc.)
  - `frontend/src/components/interactive.tsx` — hardcoded strings for labels, button text, placeholders (e.g., "Victim / Bystander view", "Dispatching…", "Re-trigger SOS")
  - `frontend/src/app/layout.tsx` — hardcoded metadata strings
  - `frontend/src/app/page.tsx` — hardcoded section titles and subtitles
- **Impact:** Impossible to localize the app for regional Indian languages (Hindi, Kannada, Tamil, Telugu, etc.) without rewriting every component. This is a significant gap for a product targeting rural India.
- **Fix approach:** Extract all user-facing strings into a locale file (JSON/YAML). Start with a single English locale, then add regional languages.

## Security

### 1. No Authentication or RBAC Anywhere in Codebase
- **Issue:** There is zero authentication, authorization, or RBAC implemented in either frontend or backend. All API endpoints are publicly accessible:
  - `POST /api/sos` — anyone can create an incident
  - `PATCH /api/hospitals/{id}/stock` — anyone can update hospital stock
  - `GET /api/incidents/{id}` — anyone can view any incident's full data
  - `GET /api/audit` — anyone can view all audit events
  - All other endpoints
- **Files:** All route files in `backend/app/routes/*.py` (10 route modules), all frontend components
- **Risk:** Complete lack of access control. Malicious actors could:
  - Create fake SOS incidents (DoS/harassment)
  - Modify hospital antivenom stock data (could cause a victim to be routed to a hospital falsely claiming stock)
  - View all incident data including victim locations and personal details
  - View the full audit trail
- **Fix approach:** Implement authentication (JWT or session-based) and RBAC with roles matching the system design (victim, responder, rescue, ambulance, hospital, admin). The architecture doc at `backend/app/routes/architecture.py` already lists authentication + RBAC as a planned API component but it's not implemented.

### 2. CORS Misconfigured (Potentially Wide Open in Production)
- **Issue:** The backend CORS middleware in `backend/app/main.py` allows specific origins (`localhost:3000`, `127.0.0.1:3000`), which is fine for development. However:
  - `allow_methods=["*"]` and `allow_headers=["*"]` allow all methods and headers.
- **Files:**
  - `backend/app/main.py` — lines 25-31
- **Risk:** In production, if the backend is reached directly, all cross-origin requests are permitted. Combined with no authentication, this means any website can make authenticated requests.
- **Fix approach:** For production, restrict to the actual production domain, restrict methods and headers to what's needed.

### 3. Frontend Prisma Client Has Direct Database Access
- **Issue:** The `frontend/src/lib/db.ts` exports a `PrismaClient` that connects to the same SQLite database file as the Python backend. The frontend event bus uses this to perform DB operations directly (bypassing any API security).
- **Risk:** If the frontend is compromised (e.g., via XSS), the attacker gains direct database access through the Prisma client. With no authentication layer between client code and the database, this is a serious vulnerability.
- **Files:** `frontend/src/lib/db.ts`, `frontend/src/lib/eventbus.ts`
- **Fix approach:** Remove Prisma from the frontend entirely. All database access should go through the Python API.

### 4. SQLite Database File Tracked in Git (PII Risk)
- **Issue:** The SQLite database file at `backend/db/nagraksha.db` is tracked in git (confirmed via `git ls-files`). This file may contain incident data including victim locations, phone numbers, addresses, and medical information.
- **Files:** `backend/db/nagraksha.db` (committed to git)
- **Risk:** PII and medical data committed to version control. Any developer with repo access can read the full database. Even if the current data is demo data, in production this would be a catastrophic data leak.
- **Fix approach:** Add `*.db` to `.gitignore` and remove the existing database from git history with `git rm --cached`. Ensure seed scripts generate databases at runtime.

### 5. API Keys and Secrets Configured via .env with Potential for Leakage
- **Issue:** The `.env.example` file at the project root documents that API keys for Grok (xAI) and Gemini (Google) are loaded from `.env` files. While `.env*` is gitignored (except `.env.example`), the pattern `.env*` matches `.env.example` too, so `.env.example` is not ignored but is committed. The key risk is:
  - If a developer creates `.env` with real keys, it is gitignored (good).
  - However, environment variables may be leaked through logs, error messages, or the `dev.log` file generated by `next dev 2>&1 | tee ../dev.log`.
  - The `dev.log` file is listed in `.gitignore` but could be committed if not careful.
- **Files:**
  - `.env.example` — documents key names
  - `backend/app/llm.py` — reads `GROK_API_KEY` and `GEMINI_API_KEY` from environment
  - `frontend/package.json` — `dev` script redirects output to `../dev.log`
  - `.gitignore` — has `.env*` and `*.log`
- **Risk:** API key leakage through logs or accidental commit of `.env` files.
- **Fix approach:** Ensure `.env*` is strictly gitignored. Never log environment variables or request headers that may contain auth tokens. Consider using a secrets manager for production.

### 6. Snake Photo ID Accepts Base64 Images Over Plain HTTP
- **Issue:** The `/api/snake-id` endpoint (`backend/app/routes/snake_id.py`) accepts a `SnakeIdRequest` with an `image` field (base64 data URL). There is no validation, rate limiting, or size check on the image payload. The endpoint currently ignores the image (uses mock logic), but the risk remains for when real CV is integrated.
- **Files:** `backend/app/routes/snake_id.py`, `backend/app/models.py`
- **Risk:** Potential for denial-of-service via large image uploads.
- **Fix approach:** Add request size limits, validate image format and size, add rate limiting.

## Performance

### 1. TF-IDF Index Rebuilt on Every Query
- **Issue:** The `_ensure_index()` function in `backend/app/rag.py` (line 45-50) checks the KnowledgeChunk count on every call to `retrieve()`. If the count has changed (even by one), it rebuilds the entire TF-IDF index — re-vectorizing all documents from scratch.
- **Files:** `backend/app/rag.py` — lines 24-50
- **Impact:** On every user query to the myth-buster, the system reads all knowledge base chunks from SQLite, converts them to TF-IDF vectors, and recomputes the similarity matrix. For a corpus of ~20 chunks this is negligible, but it does not scale. Each query pays an O(n) penalty for the count check plus O(n * m) for vectorization if the count changed.
- **Fix approach:** (a) Avoid rebuilding on every query — only rebuild on explicit re-index trigger or at startup. (b) Incremental indexing for added/removed chunks. (c) For the hackathon corpus size, pre-build at startup and disable the per-query check.

### 2. No Connection Pool or Query Optimization for SQLite
- **Issue:** The Python backend opens and closes a new SQLite connection for virtually every database operation. The `get_conn()` context manager in `backend/app/database.py` creates a new `sqlite3.connect()` for each `with db.get_conn()` block. Many API endpoints (e.g., `get_incident` in `incidents.py`) execute 4+ separate queries in sequence, each opening a new connection.
- **Files:**
  - `backend/app/database.py` — `get_conn()` context manager, lines 170-182
  - All route files — heavy use of `with db.get_conn()` per query
- **Impact:** Connection overhead for every query. SQLite operates in serialized mode with file-level locking — multiple connections to the same DB file causes contention under load.
- **Fix approach:** Use a single persistent connection (FastAPI event lifespan) or a small connection pool. Batch queries within a single transaction where possible.

### 3. Event Bus Polling Interval Causes Latency
- **Issue:** Both outbox workers poll every 2.5 seconds. This means the minimum latency from "event emitted" to "handler invoked" is up to 2.5 seconds.
- **Files:**
  - `frontend/src/lib/eventbus.ts` — line 254: `setInterval(safeTick, 2500)`
  - `backend/app/eventbus.py` — line 176: `time.sleep(2.5)`
- **Impact:** The SOS demo shows a streaming experience, but the actual dispatch fan-out has a built-in 2.5s delay. For a real emergency response system, this is too slow.
- **Fix approach:** Reduce poll interval to 100-500ms for production, or switch to event-driven notification (SQLite triggers, LISTEN/NOTIFY, or external message queue).

### 4. SSE Stream Events Simulated With `time.sleep()`
- **Issue:** The Python eventbus handler at `backend/app/eventbus.py` lines 112-120 uses blocking `time.sleep()` calls (0.6s, 1.6s, 2.0s) to simulate state transitions. This blocks the worker thread and delays processing of subsequent outbox events.
- **Files:** `backend/app/eventbus.py` — lines 113-117
- **Impact:** While one incident is being processed, other pending outbox events queue up. Under load, this creates a processing backlog.
- **Fix approach:** Replace sleep-based state simulation with actual domain logic or async scheduling.

## Fragile Areas

### 1. Prisma Schema and Python SQL Schema Must Be Kept in Sync
- **Issue:** The database schema is defined in two places:
  - `frontend/prisma/schema.prisma` — Prisma schema (SQLite)
  - `backend/app/database.py` — `SCHEMA` string with raw CREATE TABLE statements (193 lines)
- **Files:** `frontend/prisma/schema.prisma`, `backend/app/database.py`
- **Risk:** If tables are added/modified in Prisma, the Python raw SQL must be manually updated. Any mismatch causes runtime errors on the backend side. Currently the schemas are in sync, but this is fragile and must be maintained manually.
- **Safe modification:** Always update both files simultaneously when changing the schema. Consider generating the Python schema from the Prisma schema file.

### 2. Threading Lock Used in `rag.py` But Not Across All Concurrency-Critical Paths
- **Issue:** The RAG index in `backend/app/rag.py` is protected by `_index_lock = threading.Lock()`. However, the database context manager in `backend/app/database.py` does not use any connection-level locking, and the event bus in `backend/app/eventbus.py` uses its own `_bus_lock`. There is no global coordination for concurrent access to shared resources.
- **Files:**
  - `backend/app/rag.py` — line 20: `_index_lock = threading.Lock()`
  - `backend/app/database.py` — no locking on connections
  - `backend/app/eventbus.py` — line 18: `_bus_lock = threading.Lock()`
- **Risk:** Under concurrent request load, multiple threads may:
  - Open overlapping connections to SQLite (which has file-level locking)
  - Read stale RAG index while it's being rebuilt
  - Corrupt subscriber lists during iteration in `_emit()`
- **Safe modification:** Audit all shared mutable state and add appropriate locking. Consider using asyncio with a single database connection instead of threading.

### 3. Frontend Lazy Sections Pattern Is Fragile
- **Issue:** The lazy-loading pattern in `frontend/src/components/lazy-sections.tsx` uses `dynamic(() => import("..."), { ssr: false })` for 9 separate components. Each component uses `Suspense` with a `Fallback` component. All lazy sections are client-only (ssr: false).
- **Risk:** If any dynamic import fails (network error, bundle corruption, dead code elimination), the entire section fails silently with a spinner that never resolves. The try/catch in the interactive components may catch fetch errors, but dynamic import failures are not handled. SSR cannot render these sections, which affects SEO and initial paint.
- **Files:** `frontend/src/components/lazy-sections.tsx`
- **Safe modification:** Add error boundaries to each lazy section. Provide fallback UI when dynamic imports fail. Consider using `ssr: true` for non-interactive sections.

### 4. Snake ID Endpoint Uses Mock/Random Logic
- **Issue:** The snake ID endpoint at `backend/app/routes/snake_id.py` does not perform actual computer vision. It either returns a random species from a catalogue of 5 or does basic keyword matching on the text description. The "confidence" score is hardcoded and bears no relation to actual model confidence.
- **Risk:** Users may trust the snake ID result and delay medical care based on an incorrect identification. The disclaimer "Identification is uncertain. Do NOT delay medical care based on this result." is present but may not be read.
- **Files:** `backend/app/routes/snake_id.py`
- **Safe modification:** Mark the endpoint clearly as "mock/simulation" in the UI with more prominent disclaimers. Replace with actual ML model for production.

### 5. Dual Event Bus (Frontend + Backend) Is Architecturally Fragile
- **Issue:** The event bus / outbox worker runs in both the frontend Node.js process (`frontend/src/lib/eventbus.ts`) and the Python backend (`backend/app/eventbus.py`). Both:
  - Poll the same OutboxEvent table
  - Process the same event types
  - Write back to the same tables
  - Are started on module import (frontend) or app startup (backend)
- **Risk:** If both processes are running simultaneously (which happens during development), outbox events are processed twice — once by each worker. The frontend worker's updates may be overwritten by the Python worker and vice versa. This leads to duplicate dispatch attempts, double-counted events, and inconsistent state.
- **Files:**
  - `frontend/src/lib/eventbus.ts` — `startOutboxWorker()`
  - `backend/app/eventbus.py` — `start_worker()`
  - `backend/app/main.py` — calls `start_worker()` on startup
- **Safe modification:** Disable one of the event buses. Since the Python backend is the canonical data layer, remove the frontend event bus entirely.

## Gaps vs Design Docs

The system design document specifies several features that are not yet implemented:

| Document Requirement | Status | Evidence |
|---------------------|--------|----------|
| Authentication + RBAC at API boundary | **Missing** | No auth middleware in `backend/app/main.py` or any route. Architecture doc at `backend/app/routes/architecture.py` lists it as planned but not wired |
| PostgreSQL + PostGIS for geospatial queries | **Not done** | Using SQLite with in-memory haversine calculations (`backend/app/domain.py`, `frontend/src/lib/nagraksha.ts`) |
| Maps/routing provider integration | **Missing** | No external maps API integration. Mock coordinates used throughout |
| Weather API integration | **Missing** | Risk data is static seed data, not fetched from a weather API |
| Web Push / browser push notifications | **Missing** | Service worker exists (`frontend/public/sw.js`) but only for offline cache, no push notifications |
| Object storage for snake photos | **Missing** | Snake photos are sent as base64 in request body, no persistent storage |
| SMS fallback for low connectivity | **Missing** | No SMS integration |
| IndexedDB for offline UI state | **Missing** | Service worker caches the shell, but no IndexedDB usage detected |
| Idempotency key for SOS requests | **Missing** | No idempotency key validation in `POST /api/sos` |
| Atomic compare-and-set for responder acceptance | **Missing** | No optimistic locking on DispatchAttempt acceptance |
| Timeout-based responder escalation | **Missing** | Worker accepts first candidate immediately with no timeout window |
| Real CV model for snake ID (FR-6.1, FR-6.2) | **Missing** | Uses mock/random logic in `backend/app/routes/snake_id.py` |
| Real LLM integration for RAG (not mock) | **Partial** | Has GGUF/Grok/Gemini chain (`backend/app/llm.py`) but no model file committed (only `model/` directory with `.gitkeep`) |
| Production-ready database (PostgreSQL) | **Not done** | Still using SQLite per `frontend/prisma/schema.prisma` |

---

*Concerns audit: 2026-07-25*
