# External Integrations

**Analysis Date:** 2026-08-14

## APIs & External Services

**LLM / Text Generation (fallback chain in `backend/app/llm.py:179-220`):**
- Local GGUF model (optional, offline) — first choice.
  - Location: `model/` directory (repo root; currently only `.gitkeep`).
  - Library: `llama-cpp-python` (`backend/app/llm.py:53`) — lazy import, NOT in `backend/requirements.txt`.
  - Model file discovery: any `*.gguf` in `model/` (`backend/app/llm.py:39-41`).
- Groq — `https://api.groq.com/openai/v1/chat/completions`
  - Model: `llama-3.3-70b-versatile` (`backend/app/llm.py:95`).
  - Auth: `GROQ_API_KEY` header `Authorization: Bearer`.
  - SDK/Client: raw `httpx` calls, 30s timeout.
- Grok (xAI) — `https://api.x.ai/v1/chat/completions`
  - Model: `grok-2-latest` (`backend/app/llm.py:122`).
  - Auth: `GROK_API_KEY` header `Authorization: Bearer`.
  - SDK/Client: raw `httpx` calls, 60s timeout.
- Gemini (Google) — `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
  - Model: `gemini-2.5-flash`.
  - Auth: `GEMINI_API_KEY` via `X-Goog-Api-Key` header (`backend/app/llm.py:150`).
  - SDK/Client: raw `httpx` calls, 60s timeout.

**Vision AI (Snake ID — `backend/app/routes/snake_id.py`):**
- Groq Vision — `llama-3.2-11b-vision-instruct` (`backend/app/routes/snake_id.py:205`), first priority.
- Grok Vision — `grok-2-vision-latest` (`backend/app/routes/snake_id.py:244`), second priority.
- Gemini Vision — `gemini-2.5-flash` (`backend/app/routes/snake_id.py:282`), third priority.
- All accept base64 JPEG images, return JSON schema parsed from response; 35s timeouts.
- Fallback: local morphological keyword matcher over 11-species catalogue (`backend/app/routes/snake_id.py:307-339`).

**Vision AI (Wound Progression — `backend/app/routes/wound.py` + `backend/app/llm.py:247-293`):**
- Gemini Vision `gemini-2.5-flash` with inline base64 image data.
- Pixel-based heuristic fallback when no `GEMINI_API_KEY` or API failure (`backend/app/llm.py:255-261`).

**Speech-to-Text — Groq Whisper (`backend/app/routes/transcribe.py`):**
- Endpoint: `https://api.groq.com/openai/v1/audio/transcriptions`.
- Model: `whisper-large-v3-turbo` (`backend/app/routes/transcribe.py:54,118`).
- Auth: `GROQ_API_KEY`.
- Two routes: `POST /api/transcribe` (multipart file upload) and `POST /api/transcribe-b64` (base64 payload). Writes temp files server-side, deletes after use.
- Fallback: browser speech recognition when no key (`backend/app/routes/transcribe.py:32-36`).

## Data Storage

**Databases:**
- SQLite — primary datastore.
  - Path: `backend/db/nagraksha.db` (overridable via `NAGRAKSHA_DB` env var, `backend/app/database.py:17`).
  - Client: stdlib `sqlite3`, raw SQL, no ORM. Schema in `backend/app/database.py:19-236` (tables: Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread, KnowledgeChunk, OutboxEvent, AuditEvent, WoundReading, Responder, VillageAudit, HouseholdAudit, Stakeholder).
  - Pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON` (`backend/app/database.py:266-280`).
  - Lightweight migrations via `PRAGMA table_info` + `ALTER TABLE` in `backend/app/database.py:244-261`.

**Vector / Embedding Store:**
- ChromaDB — RAG knowledge base (`backend/app/rag.py`).
  - Persistent client at `backend/chroma_db/` (`backend/app/rag.py:18`).
  - Collection: `nagraksha_kb`, cosine space (`backend/app/rag.py:37-41`).
  - Embeddings: `DefaultEmbeddingFunction` (ONNX, no PyTorch).
  - Docker volume: `backend_data:/app/chroma_db` (`docker-compose.yml`).
  - Fallback: scikit-learn TF-IDF retrieval (`backend/app/rag.py:50-102`) when ChromaDB unavailable.

**File Storage:**
- Local filesystem only. No object storage. Audio temp files written under system temp dir (`backend/app/routes/transcribe.py:47`). Wound photos deliberately NOT persisted (`backend/app/routes/wound.py:45-48`). Public assets in `frontend/public/`.

**Caching:**
- None (no Redis/Memcached). In-process Python state: RAG collection singleton + TF-IDF index (`backend/app/rag.py:20-21`), WebSocket connection registry (`backend/app/routes/ws.py:17`).

## Authentication & Identity

**Auth Provider:**
- Custom JWT (HS256) via `python-jose` — no external OAuth provider (`backend/app/auth.py`).
  - Implementation: `POST /api/auth/token` exchanges `{role, secret}` for a 24h JWT (`backend/app/main.py:94-103`).
  - Role secrets from env: `ROLE_SECRET_VICTIM`, `ROLE_SECRET_HOSPITAL`, `ROLE_SECRET_ADMIN`.
  - Roles: `victim`, `hospital_admin`, `system_admin`.
  - Enforcement: `AUTH_ENFORCED` env or `ENV=production` turns on `require_role_if_enforced()` on mutating routes; otherwise demo runs open.
  - Production guard: `ENV=production` rejects demo/placeholder secrets at import (`backend/app/auth.py:32-37,47-52`).

## Messaging / Realtime

**WebSocket (in-process, no external service):**
- Endpoint: `WS /ws/incidents/{incident_id}` (`backend/app/routes/ws.py:40`).
- Server-push only; clients subscribe per incident; background outbox worker broadcasts via `broadcast_sync` (`backend/app/routes/ws.py:29-37`).

**Event Bus / Outbox (in-process):**
- SQLite-backed outbox table (`OutboxEvent`) + worker thread polling every 2.5s (`backend/app/eventbus.py:250-263`).
- ThreadPoolExecutor (max 4 workers) for dispatch jobs (`backend/app/eventbus.py:25`).

## SMS Dispatch

**Twilio (`backend/app/dispatch.py`, `backend/app/routes/twilio_webhook.py`):**
- Send: `client.messages.create()` from `twilio` SDK, `TWILIO_PHONE_NUMBER` as from-address. Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.
- Inbound webhook: `POST /webhook/twilio` — responder replies ACCEPT/READY/DECLINE/BUSY/NO via SMS.
  - Signature validation: `RequestValidator` + `X-Twilio-Signature` header when `TWILIO_AUTH_TOKEN` set (`backend/app/routes/twilio_webhook.py:27-33`).
  - Responds with TwiML XML (`_twiml_response`).
  - Updates `DispatchAttempt` outcome and broadcasts over WebSocket.
- Fallback: `simulate_dispatch()` demo flow when no Twilio credentials or no registered responders (`backend/app/dispatch.py:148-150`, `backend/app/domain.py`).
- Responder registration: `POST /api/responders` (multipart form, system_admin role when enforced).

## Monitoring & Observability

**Error Tracking:**
- Sentry — `sentry_sdk.init()` with `FastApiIntegration` + `StarletteIntegration` in `backend/app/main.py:37-44`.
  - DSN: `SENTRY_DSN` env var (optional; init skipped if unset).
  - Traces sample rate 0.2, environment from `ENV` (default `development`).

**Logs:**
- Console `print()` to stdout — backend has no logging framework setup (e.g. `backend/app/eventbus.py:163`, `backend/app/dispatch.py:133`).
- Dev logs written to `backend.log` and `dev.log` at repo root (root `package.json` scripts, `scripts/dev.sh`).

## Analytics

**Vercel Analytics:**
- `@vercel/analytics` in `frontend/app/layout.tsx:43` — rendered only when `NODE_ENV === 'production'`.

## CI/CD & Deployment

**Hosting:**
- Not deployed to a live platform; Docker Compose for local containerized run. `.vercel` dir is gitignored (Vercel potential target; `@vercel/analytics` present).
- Remote: GitHub (`git log` shows `github.com/manojrameshdev/Nagaraksha-`).

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`.
  - Backend job: `actions/setup-python@v5` (3.11), `ruff check backend/app`, `py_compile` all backend files, `pytest tests/ -v`.
  - Frontend job: `actions/setup-node@v4` (Node 20), `npm ci --legacy-peer-deps` (cache path `frontend/package-lock.json` — file missing, see STACK.md), `npx vitest run`, `npm run lint`, `npm run build`.
  - Known CI drift: frontend has no `vitest.config.*`, no test files, no eslint config, and no `package-lock.json` in the current tree.

## Environment Configuration

**Required env vars (critical for full functionality):**
- `GEMINI_API_KEY` — Gemini chat + vision (RAG fallback, wound analysis).
- `GROQ_API_KEY` — Groq chat + vision + Whisper transcription.
- `GROK_API_KEY` — xAI Grok chat + vision.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — real SMS dispatch + webhook.
- `JWT_SECRET` — JWT signing (production must be non-demo).
- `ROLE_SECRET_VICTIM`, `ROLE_SECRET_HOSPITAL`, `ROLE_SECRET_ADMIN` — role token issuance.
- `SENTRY_DSN` — error monitoring (optional).

**Operational env vars:**
- `NEXT_PUBLIC_BACKEND_URL` — frontend→backend base URL (dev `http://localhost:8000`, compose `http://backend:8000`).
- `FRONTEND_URL` — appended to CORS allowlist (`backend/app/main.py:72-73`).
- `NAGRAKSHA_DB` — SQLite path override.
- `ENV` — `production` enables auth enforcement + rejects demo secrets + sets Sentry env.
- `AUTH_ENFORCED` — `true/1/yes/on` enables role enforcement without `ENV=production`.

**Secrets location:**
- `.env` at repo root (gitignored). `.env.example` committed as the template. docker-compose reads host `.env` for backend vars.

## Webhooks & Callbacks

**Incoming:**
- `POST /webhook/twilio` (`backend/app/routes/twilio_webhook.py:20`) — Twilio SMS reply webhook; validates `X-Twilio-Signature`; returns TwiML.

**Outgoing:**
- None (no registered outbound webhooks). Real-time updates flow over WebSocket (`WS /ws/incidents/{incident_id}`).

## External API Dependency Notes

- All LLM/vision/transcription calls use raw `httpx` (no vendor SDKs); failures degrade gracefully to local fallbacks (retrieval-only, pixel heuristics, morphology matcher, simulation).
- Outbound calls fail silently (return `None`) so the demo works fully offline — see `backend/app/llm.py:76-77,102-108,136-138,173-174`.

---

*Integration audit: 2026-08-14*
