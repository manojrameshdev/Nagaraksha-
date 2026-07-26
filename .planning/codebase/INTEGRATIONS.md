# External Integrations

**Analysis Date:** 2026-07-25

## External APIs

### LLM Providers — Grok (xAI)

- **Endpoint:** `https://api.x.ai/v1/chat/completions`
- **Model:** `grok-2-latest`
- **Auth:** Bearer token via `GROK_API_KEY` env var
- **Client:** `httpx` (synchronous) — `backend/app/llm.py` `_generate_grok()`
- **Role:** Secondary fallback in the LLM chain (tried if no local GGUF model is available)

### LLM Providers — Gemini (Google)

- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- **Model:** `gemini-2.0-flash`
- **Auth:** API key passed as query parameter `?key=` via `GEMINI_API_KEY` env var
- **Client:** `httpx` (synchronous) — `backend/app/llm.py` `_generate_gemini()`
- **Role:** Tertiary fallback (last resort in the LLM chain)

### LLM Fallback Chain

Implementated in `backend/app/llm.py` function `generate()`:

1. **Local GGUF** — `model/*.gguf` files via `llama-cpp-python` `Llama` class
2. **Grok (xAI)** — if GGUF missing or fails, and `GROK_API_KEY` is set
3. **Gemini (Google)** — if Grok missing or fails, and `GEMINI_API_KEY` is set
4. **Retrieval-only fallback** — if all LLM providers fail, return top retrieved KB chunk verbatim (handled in `rag.py`)

### RAG Retrieval

- **Library:** `scikit-learn` (TF-IDF vectorizer + cosine similarity)
- **Not an external API** — all retrieval is local/in-process
- **Corpus:** Curated medical knowledge base seeded from `backend/app/knowledge_base_data.py` / `frontend/src/lib/knowledge-base.ts`
- **Categories:** FIRST_AID, MYTH, SPECIES, RISK, ANTIVENOM, PROTOCOL
- **Review status:** "NagRaksha medical review (demo corpus)"

### Snake ID (Mock)

- **Route:** `POST /api/snake-id` (`backend/app/routes/snake_id.py`)
- **Implementation:** Hardcoded catalogue of 5 species, keyword-matched against text input, random choice as default
- **No external CV/ML API** — this is a stub/mock

## Database

### Primary: SQLite (Development + Hackathon)

| Detail | Value |
|--------|-------|
| **Provider** | `sqlite3` (Python stdlib) + `Prisma` (TypeScript ORM) |
| **File location** | `backend/db/nagraksha.db` |
| **URL** | `DATABASE_URL` env var (defaults to file-based SQLite) |
| **Schema source** | `frontend/prisma/schema.prisma` (Prisma schema) |
| **Backend access** | Raw SQL via `sqlite3` module (`backend/app/database.py`) |
| **Frontend access** | Prisma Client (`frontend/src/lib/db.ts` singleton) |

### Tables (defined in `frontend/prisma/schema.prisma`)

| Table | Purpose |
|-------|---------|
| `Incident` | SOS lifecycle with state machine (PENDING → DISPATCHING → ACCEPTED → TRANSPORTING → HANDED_OFF → CLOSED) |
| `DispatchAttempt` | Fan-out records for 3 responder lanes (TRAINED, RESCUE, AMBULANCE) |
| `Hospital` | Hospital registry with geolocation |
| `AntivenomStock` | Antivenom inventory snapshots per hospital (time-series, latest per hospital) |
| `SymptomObservation` | Structured symptom timeline logged by trained first responder |
| `SnakeObservation` | Snake identification records (image ref, predicted class, confidence) |
| `RiskReport` | Weather/season-based risk areas |
| `MythThread` | Q&A history from the myth-buster assistant |
| `KnowledgeChunk` | Curated RAG knowledge base corpus chunks |
| `OutboxEvent` | Durable outbox for event-driven dispatch (System Design §3) |
| `AuditEvent` | Immutable audit trail (NFR-8) |

### Production Path

- `.env.example` documents Postgres as production target: `DATABASE_URL=postgresql://user:pass@host:5432/nagraksha`
- Prisma schema is database-agnostic; migration path is `prisma db push` (dev) → `prisma migrate deploy` (prod)

## Authentication / Authorization

- **Not yet implemented.** No auth provider is integrated.
- `backend/app/routes/snake_id.py` line 52 comments note "Authentication + RBAC at API boundary" in the architecture manifest
- The architecture layer doc (`backend/app/routes/architecture.py`) lists "Authentication + RBAC" as a future API layer component
- Currently all endpoints are unauthenticated

## Event / Message Bus

### In-Process Event Bus (No External Message Broker)

| Detail | Value |
|--------|-------|
| **Pattern** | EventEmitter singleton (Node.js `events` module in frontend, `threading + dict` in Python backend) |
| **Durability** | `OutboxEvent` table (SQLite) — events written in same transaction as the aggregate |
| **Worker** | Background poller drains outbox every 2.5s |
| **Retry** | Up to 4 attempts before marking event as FAILED |
| **Subscribers** | In-process callbacks registered via `subscribe()` / `unsubscribe()` |

### Event Types

| Event | Emitted When | Subscribers |
|-------|-------------|-------------|
| `IncidentCreated` | SOS POST creates incident + outbox event | Dispatch Orchestrator (3-lane fanout) |
| `DispatchAttempted` | Each responder candidate is notified | SSE stream, UI updates |
| `DispatchAccepted` | A responder accepts the dispatch | SSE stream, UI updates |
| `IncidentStateChanged` | Incident state transitions | SSE stream, UI layer |
| `IncidentClosed` | Incident lifecycle ends | (reserved) |

### Implementation Locations
- **Frontend bus:** `frontend/src/lib/eventbus.ts` — uses Node.js `EventEmitter`, Prisma outbox CRUD, 2.5s poller
- **Backend bus:** `backend/app/eventbus.py` — uses `threading + dict`, raw SQL outbox CRUD, 2.5s poller thread
- **Both run independently** — the frontend bus simulates dispatch locally; the backend bus does the same on the server side

## SSE (Server-Sent Events)

- **Route:** `GET /api/incidents/{inc_id}/stream` (`backend/app/routes/incidents.py`)
- **Response type:** `text/event-stream` with `Cache-Control: no-cache`
- **Events emitted:** `snapshot` (initial state), `dispatch_attempted`, `dispatch_accepted`, `incident_state`
- **Heartbeat:** `: heartbeat` every 15s
- **Client:** `EventSource` API in `frontend/src/components/interactive.tsx`
- **Cleanup:** Unsubscribe handlers on connection close

## Storage / CDN

### File Storage
- **Local filesystem only.** No external object storage (S3, etc.) is integrated.
- The `SnakeObservation.imageRef` field exists in the schema for future snake photo uploads
- The architecture manifest (`backend/app/routes/architecture.py`) lists "Object storage (snake photos)" as future external integration

### Static Assets
- **Next.js standalone build** serves JS/CSS/fonts from `.next/static/`
- **Service worker** (`frontend/public/sw.js`) caches app shell assets (network-first for navigation, stale-while-revalidate for static)

### CDN
- Not detected. Assets are served directly from the Next.js server (localhost:3000 in dev, standalone server in production)

## Monitoring / Logging

### Logging

| Layer | Method | Location |
|-------|--------|----------|
| Frontend dev | Console logs, file via tee: `next dev ... 2>&1 | tee ../dev.log` | `dev.log` |
| Backend dev | Console logs, file via tee: `uvicorn ... 2>&1 | tee ../backend.log` | `backend.log` |
| Prisma | Log level: `['error', 'warn']` (explicitly silencing query logs) | `frontend/src/lib/db.ts` |
| Start script | `start.py` redirects both to log files | `backend.log`, `dev.log` |

### Error Tracking
- **None detected.** No Sentry, Datadog, or similar integration.

### Audit Trail
- `AuditEvent` table logs all domain actions with actor, action, entity, metadata, and timestamp
- Actions logged: SOS_TRIGGERED, DISPATCH_FANOUT, RESPONDER_ACCEPTED, STATE_CHANGE, STOCK_UPDATED, RAG_QUERY, HANDOFF

## CI/CD & Deployment

### Hosting
- **Not deployed to production.** All services run locally.
- Target domain: `nagraksha.app` (configured in frontend metadata and OG tags)

### CI Pipeline
- **None detected.** No CI config files found (no GitHub Actions, CircleCI, etc.)

## Service Worker / PWA

- **File:** `frontend/public/sw.js`
- **Strategy:** Network-first for navigation, stale-while-revalidate for static assets
- **Never cache** `/api/*` endpoints (medical data privacy)
- **App shell:** Pre-caches `/`, manifest, icons, and `/offline.html`
- **Manifest:** `frontend/public/manifest.webmanifest` — standalone display, portrait, dark theme (#0A1812)
- **Shortcuts:** "Trigger SOS" and "Identify a Snake"
- **Registration:** Inline script in `frontend/src/app/layout.tsx`

## External Services Summary

| Service | Type | Status | Config Variable | Implementation File |
|---------|------|--------|----------------|-------------------|
| Grok (xAI) | LLM API | Optional fallback | `GROK_API_KEY` | `backend/app/llm.py` |
| Gemini (Google) | LLM API | Optional fallback | `GEMINI_API_KEY` | `backend/app/llm.py` |
| Local GGUF | Local LLM | Optional (auto-detect) | `model/*.gguf` | `backend/app/llm.py` |
| SQLite | Database | Default | `DATABASE_URL` | `backend/app/database.py`, `frontend/src/lib/db.ts` |
| Postgres | Database | Production target | `DATABASE_URL` | schema in `frontend/prisma/schema.prisma` |

| No auth provider | Auth | Not implemented | — | — |
| No object storage | File storage | Not implemented | — | — |
| No error tracking | Monitoring | Not implemented | — | — |
| No CI/CD | Pipeline | Not implemented | — | — |

---

*Integration audit: 2026-07-25*
