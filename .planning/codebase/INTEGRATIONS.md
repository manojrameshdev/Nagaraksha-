# External Integrations

**Analysis Date:** 2026-08-15

## APIs & External Services

**LLM / Vision (RAG chatbot + Snake ID + wound analysis):**
- Local GGUF model - Optional offline inference via `llama-cpp-python` (not in requirements; lazily loaded)
  - Location: `model/*.gguf` (gitignored, empty in repo)
  - Loader: `backend/app/llm.py` (`_load_gguf`, `_generate_gguf`)
- Groq - Fast RAG responses (Llama-3)
  - Auth: `GROQ_API_KEY` env var; HTTP via `httpx`
- Google Gemini - Vision (Snake ID) + RAG fallback (Gemini 2.5 Flash)
  - Auth: `GEMINI_API_KEY` env var
- xAI Grok - Snake ID Vision fallback
  - Auth: `GROK_API_KEY` env var
- Fallback chain order in `backend/app/llm.py`: local GGUF → Grok → Gemini → `None` (retrieval-only mode)

**SMS Dispatch (Twilio):**
- Twilio - Real SMS to first-aiders / snake rescuers / ambulance
  - SDK/Client: `twilio` Python package (`backend/app/dispatch.py`, lazy client)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - Outbound: SMS templates per lane (`_build_message` in `dispatch.py`)
  - Inbound: `POST /webhook/twilio` (`backend/app/routes/twilio_webhook.py`) handles ACCEPT/READY/DECLINE replies
  - Verification: `X-Twilio-Signature` validated via `RequestValidator` when `TWILIO_AUTH_TOKEN` is set
  - Fallback: if no Twilio credentials, dispatch falls back to `simulate_dispatch()` in `backend/app/domain.py` (demo mode)

**Error Monitoring:**
- Sentry - Backend errors
  - DSN: `SENTRY_DSN` env var; `sentry_sdk.init` with FastAPI/Starlette integrations, `traces_sample_rate=0.2` (`backend/app/main.py`)
  - Only initialized when DSN present; environment from `ENV` (default `development`)

**Analytics:**
- Vercel Analytics - Frontend page analytics
  - `@vercel/analytics` in `frontend/app/layout.tsx`, rendered only in production

## Data Storage

**Databases:**
- SQLite (local file) - Primary data store
  - Connection: `NAGRAKSHA_DB` env var, default `backend/db/nagraksha.db` (`backend/app/database.py`)
  - Client: stdlib `sqlite3` with raw SQL; `PRAGMA journal_mode = WAL`, `foreign_keys = ON`
  - Migrations: idempotent `CREATE TABLE IF NOT EXISTS` schema + `migrate_db()` ALTER-TABLE additions
  - Tables: Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread, KnowledgeChunk, OutboxEvent, AuditEvent, WoundReading, Responder, VillageAudit, HouseholdAudit, Stakeholder

**Vector Storage:**
- ChromaDB (local persistent) - RAG knowledge base embeddings
  - Path: `backend/chroma_db/` (gitignored, rebuilt from seed data)
  - Client: `chromadb.PersistentClient` with `DefaultEmbeddingFunction` (ONNX-based, no PyTorch)
  - Collection: `nagraksha_kb`, cosine space (`backend/app/rag.py`)
  - Seeded from `backend/app/knowledge_base_data.py` via `ensure_kb_seeded()`

**Caching:**
- None external (SQLite WAL + in-process collections only)

## Authentication & Identity

**Auth Provider:**
- Custom JWT (HS256 via python-jose) - role-keyed demo auth
  - Implementation: `backend/app/auth.py`; tokens minted at `POST /api/auth/token`
  - Token storage: `localStorage` keys `nagraksha_token` / `nagraksha_role` (frontend `frontend/hooks/use-auth.ts`)
  - Session: 24h expiry (`TOKEN_EXPIRE_HOURS = 24`); roles `victim`, `hospital_admin`, `system_admin`
  - Role secrets: `ROLE_SECRET_VICTIM/HOSPITAL/ADMIN` env vars; demo fallbacks refused when `ENV=production`
  - Enforcement: `require_role_if_enforced()` — optional (only when `AUTH_ENFORCED=true` or `ENV=production`)

**OAuth Integrations:**
- None

## Monitoring & Observability

**Logs:**
- Backend: stdout via uvicorn, `backend.log` / `dev.log` in dev (gitignored)
- No structured logging service

## CI/CD & Deployment

**Hosting:**
- Docker Compose - `docker-compose.yml` (backend `:8000`, frontend `:3000`), volumes for `chroma_db`
- Vercel-compatible frontend (`next start` via pnpm in the Docker image)

**CI Pipeline:**
- GitHub Actions - `.github/workflows/ci.yml`
  - `backend-test`: Ruff lint, `py_compile` syntax check, `pytest tests/ -v`
  - `frontend-build`: corepack pnpm install, `npx vitest run`, `pnpm run lint`, `npx tsc --noEmit`, `next build` with `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`
  - `gatekeeper`: requires both jobs
- No deploy workflow defined yet

## Environment Configuration

**Development:**
- Required env vars: `NEXT_PUBLIC_BACKEND_URL` (frontend); backend runs fine with demo defaults
- Secrets location: root `.env` (gitignored), template at `.env.example`
- Mock/stub services: Twilio absent → `simulate_dispatch()`; LLM absent → retrieval-only RAG; DB is a local SQLite file
- Tests: backend uses temp SQLite file (`NAGRAKSHA_DB`), frontend uses MSW mock handlers

**Staging/Production:**
- `ENV=production` refuses demo JWT/role secrets at import (fail-fast)
- Compose passes `GEMINI_API_KEY`, `GROQ_API_KEY`, `TWILIO_*`, `JWT_SECRET`, `SENTRY_DSN` through to backend container

## Webhooks & Callbacks

**Incoming:**
- Twilio - `POST /webhook/twilio` (`backend/app/routes/twilio_webhook.py`)
  - Verification: `X-Twilio-Signature` via `twilio.request_validator` when token configured
  - Events: responder SMS replies `ACCEPT` / `READY` / `DECLINE` → updates `DispatchAttempt`, broadcasts over WebSocket

**Outgoing:**
- Twilio SMS - triggered by the outbox dispatch worker (`backend/app/eventbus.py` → `backend/app/dispatch.py`) fanning out 3 lanes per incident
- WebSocket push - `ws.broadcast` from the outbox worker thread onto the app event loop (`backend/app/routes/ws.py`)

---

*Integration audit: 2026-08-15*
*Update when adding/removing external services*
