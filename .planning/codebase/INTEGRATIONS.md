# External Integrations

**Analysis Date:** 2026-08-13

## APIs & External Services

**LLM Chat Generation (RAG myth-buster):**
- Local GGUF via llama-cpp-python - First-choice local fallback (`backend/app/llm.py`, models in `model/*.gguf`, gitignored)
- Groq - `llama-3.3-70b-versatile` chat completions (`backend/app/llm.py`)
  - Auth: `GROQ_API_KEY` env var, Bearer header
- Grok (xAI) - `grok-2-latest` chat completions (`backend/app/llm.py`)
  - Auth: `GROK_API_KEY` env var, Bearer header
- Gemini (Google) - `gemini-2.5-flash` generateContent (`backend/app/llm.py`)
  - Auth: `GEMINI_API_KEY` env var, `X-Goog-Api-Key` header
  - Fallback chain order: local GGUF → Groq → Grok → Gemini; `generate()` returns `None` if all fail, caller falls back to retrieval-only (`backend/app/llm.py:178`)

**Vision APIs (Snake ID):**
- Groq Vision - `llama-3.2-11b-vision-instruct` (`backend/app/routes/snake_id.py`)
- Grok Vision - `grok-2-vision-latest` (`backend/app/routes/snake_id.py`)
- Gemini 2.5 Flash Vision - snake photo ID + wound analysis (`backend/app/routes/snake_id.py`, `backend/app/llm.py:analyze_wound_image`)
  - Auth: same keys as above; attempt order Groq → Grok → Gemini

**Speech-to-Text:**
- Groq Whisper - `whisper-large-v3-turbo` transcription (`backend/app/routes/transcribe.py`)
  - Auth: `GROQ_API_KEY`
  - Endpoints: `POST /api/transcribe` (multipart), `POST /api/transcribe-b64` (base64)

**SMS Dispatch:**
- Twilio - Real SMS to first-aider / rescue / hospital lanes (`backend/app/dispatch.py`)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - Webhook: `POST /webhook/twilio` handles ACCEPT/READY/DECLINE replies (`backend/app/routes/twilio_webhook.py`)
  - Falls back to `simulate_dispatch()` when credentials absent or no registered responders

**Error Monitoring:**
- Sentry - Backend errors + traces (`backend/app/main.py:22-29`)
  - Auth: `SENTRY_DSN` env var; `sentry-sdk[fastapi]` integration; traces_sample_rate 0.2

## Data Storage

**Databases:**
- SQLite - Primary operational store (single file `backend/db/nagraksha.db`, gitignored)
  - Connection: raw `sqlite3` via `get_conn()` context manager (`backend/app/database.py:170`)
  - Client: stdlib sqlite3, no ORM; schema in `backend/app/database.py:SCHEMA`; `migrate_db()` for ALTER-style changes
  - Overridable via `NAGRAKSHA_DB` env var (used by tests)
- ChromaDB - Vector store for RAG retrieval (persistent dir `backend/chroma_db`)
  - Client: `chromadb.PersistentClient` + `DefaultEmbeddingFunction` (ONNX) (`backend/app/rag.py`)
  - Docker volume `backend_data` persists it in compose; fails back to scikit-learn TF-IDF if unavailable

**File Storage:**
- Local filesystem only — no object storage; wound photos stored base64 in `WoundReading.imageB64` column (`backend/app/database.py`)

**Caching:**
- None external. In-process singletons: RAG Chroma client/collection (`backend/app/rag.py`), TF-IDF index, LLM model handle

## Authentication & Identity

**Auth Provider:**
- Custom minimal JWT (`backend/app/auth.py`)
  - Implementation: HS256 via python-jose; role-keyed secrets in env (`ROLE_SECRET_VICTIM/HOSPITAL/ADMIN`); `POST /api/auth/token` issues role tokens (rate-limited 10/min)
  - Token storage: `Authorization: Bearer` header
  - Protected routes: stakeholder registry write/delete require `system_admin` (`backend/app/routes/stakeholders.py`); `require_role()` dependency factory in `backend/app/auth.py`
  - Default secrets hardcoded as fallbacks (`auth.py:ROLE_SECRETS`) — demo-grade, not production

**OAuth Integrations:**
- None

## Monitoring & Observability

**Error Tracking:**
- Sentry - backend only, no DSN in dev by default (optional via `SENTRY_DSN`)
  - Frontend has `@sentry/nextjs` in `frontend/package.json` but no `Sentry.init` in `frontend/src`

**Logs:**
- Process logs: root npm scripts tee to `backend.log` / `dev.log` (`package.json:dev:frontend/dev:backend`)
- Domain events: `AuditEvent` table, inspectable at `GET /api/audit` (`backend/app/routes/ops.py`)
- `print()` statements in backend modules (compliance, dispatch, RAG seed)

## CI/CD & Deployment

**Hosting:**
- Docker Compose (`docker-compose.yml`): backend :8000 + frontend :3000, with env passthrough for Gemini/Groq/Twilio/JWT/Sentry and `NEXT_PUBLIC_BACKEND_URL=http://backend:8000`
- Individual Dockerfiles in `backend/Dockerfile` and `frontend/Dockerfile` (Next.js standalone)

**CI Pipeline:**
- GitHub Actions - `.github/workflows/ci.yml`
  - `backend-test` job: Python 3.11, `ruff check backend/app`, `py_compile`, pytest
  - `frontend-build` job: Node 20, `npm ci --legacy-peer-deps`, `next build` with `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`
  - Frontend vitest tests are NOT run in CI

## Environment Configuration

**Development:**
- Required env vars: `NEXT_PUBLIC_BACKEND_URL` (defaults to `http://localhost:8000`), `JWT_SECRET` (has fallback)
- Secrets location: `.env` at repo root (gitignored); `.env.example` documents all vars; never commit real keys
- Mock/stub services: all LLM/vision/SMS calls fail-open — no keys = simulated dispatch, pixel-based wound fallback, retrieval-only RAG

**Production:**
- Secrets via docker-compose env passthrough (docker-compose.yml) or platform env vars
- Backend CORS allowlist: localhost:3000/127.0.0.1:3000 + optional `FRONTEND_URL` env (`backend/app/main.py:36`)

## Webhooks & Callbacks

**Incoming:**
- Twilio - `POST /webhook/twilio` (`backend/app/routes/twilio_webhook.py`)
  - Verification: none (no signature validation) — matches responder by `From` phone against `Responder.phone`
  - Events: ACCEPT/READY → attempt ACCEPTED; DECLINE/BUSY/NO → attempt DECLINED; broadcasts via WebSocket

**Outgoing:**
- None

---

*Integration audit: 2026-08-13*
