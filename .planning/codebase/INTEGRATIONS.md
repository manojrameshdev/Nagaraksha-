# External Integrations

**Analysis Date:** 2026-08-11

## APIs & External Services

**LLM / Chat (fallback chain, tried in order):**
- Local GGUF model — offline LLM via `llama-cpp-python`, auto-detected from `model/*.gguf`
  - Location: `backend/app/llm.py:39-77` (`_find_model`, `_load_gguf`, `_generate_gguf`)
  - Config: place any `.gguf` file in `model/` — no API key
  - Docs: `README.md` recommends `llama-3.2-1b-instruct-q4_k_m.gguf`, `gemma-2-2b-it-Q4_K_M.gguf`, `qwen2.5-1.5b-instruct-q4_k_m.gguf`
- Groq (Groq Inc.) — OpenAI-compatible chat completions
  - Endpoint: `POST https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile` (`backend/app/llm.py:82-108`)
  - SDK: raw `httpx` (no SDK package)
  - Auth: `GROQ_API_KEY` env var (Bearer header)
- Grok (xAI) — OpenAI-compatible chat completions
  - Endpoint: `POST https://api.x.ai/v1/chat/completions`, model `grok-2-latest` (`backend/app/llm.py:113-138`)
  - SDK: raw `httpx`
  - Auth: `GROK_API_KEY` env var (Bearer header)
- Gemini (Google) — Generative Language API
  - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=...` (`backend/app/llm.py:143-173`)
  - SDK: raw `httpx`
  - Auth: `GEMINI_API_KEY` env var (passed as `?key=` query param — note: key in URL)
  - Role: secondary fallback after local GGUF and Grok

**Vision / Snake ID (multi-provider pipeline, tried in order):**
- Groq Vision — `POST https://api.groq.com/openai/v1/chat/completions`, model `llama-3.2-11b-vision-instruct`, base64 image in message (`backend/app/routes/snake_id.py:192-228`); auth `GROQ_API_KEY`
- Grok Vision — `POST https://api.x.ai/v1/chat/completions`, model `grok-2-vision-latest` (`backend/app/routes/snake_id.py:231-269`); auth `GROK_API_KEY`
- Gemini Vision — `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...` (`backend/app/routes/snake_id.py:272-304`); auth `GEMINI_API_KEY`
- Offline fallback — keyword/natural-language matcher against a 15-species catalogue (no network): `backend/app/routes/snake_id.py:21-154, 307-339`
- Prompt contract: `_VISION_PROMPT` at `backend/app/routes/snake_id.py:161-189` — JSON schema output required

**Speech-to-Text:**
- Groq Whisper — `POST https://api.groq.com/openai/v1/audio/transcriptions`, model `whisper-large-v3-turbo` (`backend/app/routes/transcribe.py:24-89` file upload, `92-145` base64 variant); auth `GROQ_API_KEY`
  - Accepts WAV, MP3, WebM, M4A, OGG; multilingual (Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, English)
  - Client-side fallback: browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, `lang: 'hi-IN'`) in `frontend/src/components/voice-input.tsx:57-101`

**Frontend-fetched fonts:**
- Google Fonts — `next/font/google` (Inter, JetBrains_Mono, Lexend) in `frontend/src/app/layout.tsx:2,7-17` plus a manual Google Fonts stylesheet link (`layout.tsx:93-99`)

**Browser-native APIs (not backend services):**
- Geolocation API — `navigator.geolocation.getCurrentPosition` with high accuracy in `frontend/src/hooks/use-geolocation.ts:45-61`; falls back to fixed Bannerghatta coordinates
- MediaRecorder + `getUserMedia` — audio capture for voice input (`frontend/src/components/voice-input.tsx:103-171`)
- EventSource (SSE) — live incident stream consumer (`frontend/src/components/interactive.tsx:242`); backend producer at `backend/app/routes/incidents.py:63-107` (`/api/incidents/{id}/stream`)

## Data Storage

**Databases:**
- SQLite — primary store, default path `backend/db/nagraksha.db` (file committed in repo; runtime DB dir gitignored)
  - Python client: raw `sqlite3` with raw SQL, connection context manager + PRAGMA foreign_keys — `backend/app/database.py` (11 tables: Incident, DispatchAttempt, Hospital, AntivenomStock, SymptomObservation, SnakeObservation, RiskReport, MythThread, KnowledgeChunk, OutboxEvent, AuditEvent)
  - Node client: Prisma ORM — `frontend/prisma/schema.prisma` (10 models, mirrored schema) instantiated in `frontend/src/lib/db.ts`
  - Connection override: `NAGRAKSHA_DB` env var (`backend/app/database.py:17`); Prisma uses `DATABASE_URL` env (`frontend/prisma/schema.prisma:10`)
- PostgreSQL + PostGIS — documented production target only (`README.md` "Project Status", `.env.example` commented `DATABASE_URL` + `PG*` vars); no live Postgres code paths

**File Storage:**
- Local filesystem only — no object storage. Snake photos are passed as base64 in API payloads (`backend/app/routes/snake_id.py`), audio as multipart upload; no disk/cloud persistence for user media
- `frontend/public/` — static assets (icons, SVG logo, offline.html, service worker)

**Caching:**
- None external (no Redis/Memcached). In-process caches:
  - TF-IDF retrieval index rebuilt on corpus change — `backend/app/rag.py:20-51`
  - Lazy singleton LLM model — `backend/app/llm.py:22-24,44-56`
  - Prisma client singleton on globalThis — `frontend/src/lib/db.ts:7-13`

**Async / Eventing (internal):**
- In-process event bus (Python `threading` + subscribers) + durable `OutboxEvent` SQLite table + poller worker every 2.5s — `backend/app/eventbus.py:130-179`
- Next.js-side twin implementation with `EventEmitter` + Prisma outbox worker — `frontend/src/lib/eventbus.ts`
- SSE streams push live incident state to the client (`backend/app/routes/incidents.py:63-107`)

## Authentication & Identity

**Auth Provider:**
- None implemented. No user accounts, sessions, JWT, or OAuth in the codebase
- Server-side API keys only: `GROQ_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY` (read from env in `backend/app/llm.py`, `backend/app/routes/snake_id.py`, `backend/app/routes/transcribe.py`)
- "Authentication + RBAC at API boundary" is listed as a future layer in the architecture manifest (`backend/app/routes/architecture.py:26`)
- No rate limiting or key storage beyond env vars

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Bugsnag). Errors swallowed defensively throughout backend (`except Exception: pass` / best-effort patterns in `backend/app/eventbus.py:63-65,162-163`)

**Logs:**
- File logs: `backend.log` (uvicorn), `dev.log` (Next.js dev) — written by `start.py` and `scripts/dev.sh`
- `console` logging only in frontend; `no-console` is an ESLint error in `frontend/eslint.config.mjs:18`
- Prisma logging restricted to `['error', 'warn']` (`frontend/src/lib/db.ts:10-12`)
- Audit trail persisted in `AuditEvent` table via `audit()` helper (`backend/app/eventbus.py:55-65`, `frontend/src/lib/eventbus.ts:68-88`)
- Health check: `GET /api/health` (`backend/app/main.py:43-45`), polled by `python start.py --status`

## CI/CD & Deployment

**Hosting:**
- Self-hosted / local dev model: Next.js standalone bundle served by `bun` on :3000, FastAPI/uvicorn on :8000 (`frontend/package.json` `build`/`start`, `backend/run.sh`)
- Caddy gateway expected in front of both services — client code appends `?XTransformPort=8000` to route to the backend port (`frontend/src/lib/api.ts:10-13`, comments in `backend/app/main.py`, `backend/app/routes/sos.py:44`)
- Domain `nagraksha.app` referenced in metadata/OG tags (`frontend/src/app/layout.tsx:20,39,61`)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`
  - Frontend job: `npm ci`, `eslint . --max-warnings 0`, `tsc --noEmit`, `vitest run` (Node 20, npm cache)
  - Backend job: `pip install -r requirements.txt` + `bandit pytest httpx pytest-asyncio`, `bandit -r . -c ../.bandit.yaml`, `pytest tests/ -v` (Python 3.11)
  - Gatekeeper job aggregates both results
- Local gate: Husky pre-commit → `lint-staged` (Prettier + ESLint `--max-warnings 0`) — `/.husky/pre-commit`, `package.json` lint-staged config
- PWA: service worker `frontend/public/sw.js` registered in production only (`frontend/src/app/layout.tsx:106-110`), manifest `frontend/public/manifest.webmanifest`, offline shell `frontend/public/offline.html`

## Environment Configuration

**Required env vars:**
- `GROK_API_KEY` — Grok (xAI) chat + vision (`backend/app/llm.py:208`, `backend/app/routes/snake_id.py:233`)
- `GROQ_API_KEY` — Groq chat + vision + Whisper transcription (`backend/app/llm.py:202`, `backend/app/routes/snake_id.py:194`, `backend/app/routes/transcribe.py:30`)
- `GEMINI_API_KEY` — Gemini chat + vision fallback (`backend/app/llm.py:214`, `backend/app/routes/snake_id.py:274`)
- `NAGRAKSHA_DB` — SQLite path override (default `backend/db/nagraksha.db`) (`backend/app/database.py:17`)
- `DATABASE_URL` — Prisma SQLite connection string (`frontend/prisma/schema.prisma:10`; required by `prisma generate`/`db push`)
- Optional (documented, unused in code): `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` for future Postgres (`/.env.example:18-23`)

**Secrets location:**
- `.env` at repo root (gitignored; `.env.example` committed). `python setup.py` copies `.env.example` → `.env` if absent (`setup.py:44-63`)
- Keys are read at runtime from process env — never in code or git history

## Webhooks & Callbacks

**Incoming:**
- None — no external webhook endpoints; the only streaming endpoint is the internal SSE feed `/api/incidents/{id}/stream` consumed by the frontend (`backend/app/routes/incidents.py:63`)

**Outgoing:**
- None — responder dispatch is simulated in-process and written to SQLite (`backend/app/domain.py` `simulate_dispatch`, `backend/app/eventbus.py:68-121`); no SMS/push/email providers wired up

---

*Integration audit: 2026-08-11*
