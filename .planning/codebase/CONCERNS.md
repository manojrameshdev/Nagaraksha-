# Codebase Concerns

**Analysis Date:** 2026-08-11

## Tech Debt

### Dual backends — Prisma event bus is dead code
- Issue: The project shipped a Node/Prisma event bus (`frontend/src/lib/eventbus.ts`, `frontend/src/lib/db.ts`, `frontend/prisma/schema.prisma`) and later rebuilt the same domain logic in Python (`backend/app/eventbus.py`, `backend/app/domain.py`, `backend/app/database.py`). The frontend now calls the Python backend exclusively via `fetch(apiUrl(...))` (e.g. `frontend/src/components/interactive.tsx:227`), and nothing imports `@/lib/eventbus` outside its own test (`frontend/src/lib/__tests__/eventbus.test.ts`).
- Files: `frontend/src/lib/eventbus.ts`, `frontend/src/lib/db.ts`, `frontend/prisma/schema.prisma`, `frontend/scripts/seed.ts`, `backend/app/eventbus.py`
- Impact: Two copies of the outbox/dispatch/audit logic must stay in sync manually; `@prisma/client` + `prisma` remain in `frontend/package.json` and CI installs them for dead code. `frontend/src/lib/nagraksha.ts` duplicates `backend/app/domain.py` (ranking, simulation, ETA) — drift risk.
- Fix approach: Delete the Prisma-based layer (`frontend/src/lib/db.ts`, `frontend/src/lib/eventbus.ts`, `frontend/prisma/`, `frontend/scripts/seed.ts`, Prisma deps from `frontend/package.json`), keep one domain implementation server-side, and update `frontend/src/lib/__tests__/eventbus.test.ts` to test the Python bus via HTTP or remove it.

### Entire dispatch pipeline is simulated
- Issue: Responders, ETAs, and acceptances are hardcoded fake data (`backend/app/domain.py:78-92` `simulate_dispatch`, `frontend/src/lib/nagraksha.ts:128-185`). Incident state advances on fixed `time.sleep` values (`backend/app/eventbus.py:113-118`, `frontend/src/lib/eventbus.ts:176-186`) — not on real events.
- Files: `backend/app/domain.py`, `backend/app/eventbus.py`, `frontend/src/lib/nagraksha.ts`
- Impact: The product's core emergency-coordination loop is a demo; nothing can be trusted for real incidents. The worker thread is blocked by these sleeps (see Scaling Limits).
- Fix approach: Replace with real responder registry + message delivery, or clearly gate the simulation behind a feature flag for demo mode.

### No migration framework for SQLite schema
- Issue: Schema lives as a raw SQL string in `backend/app/database.py:19-160` (`SCHEMA`) and is applied with `CREATE TABLE IF NOT EXISTS` at startup. There is no versioned migration path; the Prisma schema (`frontend/prisma/schema.prisma`) is a second, manually-maintained copy.
- Files: `backend/app/database.py`, `frontend/prisma/schema.prisma`
- Impact: Any schema change must be edited in two places and existing DBs are never altered (new columns silently missing).
- Fix approach: Adopt a lightweight migration tool (e.g. `alembic` or SQL migration files with a `schema_version` table); drop the Prisma copy.

### `?XTransformPort=8000` gateway artifact
- Issue: `frontend/src/lib/api.ts` appends `?XTransformPort=8000` to every API call, referencing a Caddy gateway that no longer exists. Actual routing happens through the Next.js rewrite in `frontend/next.config.ts:9-16`, which hardcodes `http://127.0.0.1:8000/api/:path*`.
- Files: `frontend/src/lib/api.ts`, `frontend/next.config.ts`
- Impact: Misleading parameter; the rewrite binds the frontend to a Python backend running on the same host/port — any deployment without the local backend returns 502 for all `/api/*`. The query param is meaningless to the rewrite.
- Fix approach: Remove the XTransformPort param, make the backend base URL an env var, and route via the rewrite only.

### Dead/broken UI features
- Issue: The responder SymptomLogger posts to `/api/incidents/{id}/symptoms` (`frontend/src/components/interactive.tsx:1651`), but no such route exists in the backend (`backend/app/routes/` has no symptom endpoint) — always 404s. The default `incidentId="NR-1042"` (`frontend/src/components/interactive.tsx:1637`) also doesn't match uuid-style incident IDs. The "Accept Dispatch" / "Decline / Re-route" buttons in `frontend/src/app/page.tsx:220-228` have no `onClick` handlers.
- Files: `frontend/src/components/interactive.tsx`, `frontend/src/app/page.tsx`, `backend/app/routes/`
- Impact: Responder/hospital role views promise actions that silently fail.
- Fix approach: Add a backend `POST /api/incidents/{id}/symptoms` route wired to `SymptomObservation`, wire the accept/decline buttons, or remove the UI.

## Known Bugs

### Unvalidated query params crash endpoints with 500
- `backend/app/routes/ops.py:51` — `int(request.query_params.get("k", 4))` raises `ValueError` → unhandled 500 on `/api/knowledge-base?k=abc`.
- `backend/app/routes/hospitals.py:14` and `backend/app/routes/risk.py:20` — `float(request.query_params.get("lat", ...))` raises `ValueError` on non-numeric input → 500. No lat/lng range validation anywhere.
- Files: `backend/app/routes/ops.py`, `backend/app/routes/hospitals.py`, `backend/app/routes/risk.py`
- Trigger: `GET /api/hospitals?lat=foo`, `GET /api/risk?lng=bar`, `GET /api/knowledge-base?k=x`
- Fix approach: Use FastAPI typed query params (`lat: float = Query(...)`, `k: int = Query(4, ge=1, le=50)`) so Pydantic returns 422 instead of 500; add range checks.

### Mismatched ISO timestamp formats in stats trend
- Issue: `backend/app/routes/stats.py:43` compares `day.isoformat()` (`...+00:00` suffix) against `createdAt` stored by `backend/app/database.py:186` with `Z` suffix using string comparison. It happens to order correctly today but is fragile and timezone-dependent.
- Files: `backend/app/routes/stats.py`, `backend/app/database.py`
- Fix approach: Parse to `datetime` and compare tz-aware objects.

### `k` limit unbounded in retrieval
- Issue: `backend/app/routes/ops.py:51` passes user-controlled `k` straight to `retrieve(q, k)` (`backend/app/rag.py:53`), which indexes `sims_adj` over the whole corpus — `k=100000` forces a huge slice, minor DoS.
- Fix approach: Clamp `k` (e.g. 1–20) via Pydantic query validation.

### SSE stream returns 200 with JSON for missing incident
- Issue: `GET /api/incidents/{inc_id}/stream` returns a plain JSON body with 200 when the incident doesn't exist (`backend/app/routes/incidents.py:68`), so the client's `EventSource` fails with a parse error instead of a clear 404.
- Fix approach: Raise `HTTPException(404)`.

### EventSource re-connects loop after stream closes
- Issue: `frontend/src/components/interactive.tsx:271-273` keeps the EventSource open with an empty `onerror`; after HANDED_OFF the server closes the stream and the browser retries the SSE endpoint forever (browsers auto-reconnect ~3s), re-triggering `start_worker()` and re-emitting state. `closeStream()` is only called after a 1.5s timeout in the `HANDED_OFF` branch (`interactive.tsx:268`).
- Fix approach: Add a `closed` flag; on `es.onerror` check `readyState` and call `closeStream()` once the stream is terminal.

## Security Considerations

### No authentication or authorization anywhere
- Risk: Every endpoint is anonymous. `POST /api/sos` (`backend/app/routes/sos.py:15`) can be spammed (creates incidents + DB rows per call); `PATCH /api/hospitals/{id}/stock` (`backend/app/routes/hospitals.py:19`) lets anyone overwrite antivenom stock; `POST /api/snake-id` (`backend/app/routes/snake_id.py:342`), `POST /api/transcribe` (`backend/app/routes/transcribe.py:24`), and `POST /api/myth-buster` (`backend/app/routes/myth_buster.py:14`) burn paid third-party API quota per request with no rate limiting. The architecture manifest even claims "Authentication + RBAC at API boundary" (`backend/app/routes/architecture.py:26`).
- Files: `backend/app/routes/*.py`
- Current mitigation: CORS restricted to `localhost:3000` (`backend/app/main.py:36`); uvicorn bound to `127.0.0.1` in dev (`start.py:91`).
- Recommendations: Add token/API-key auth per role (victim, responder, hospital, admin), rate limiting (e.g. slowapi), idempotency keys for SOS (the design doc step 2 requires them — `backend/app/routes/architecture.py:52` — but they're not implemented), and a cap on body size for uploads.

### Gemini API key sent as URL query parameter
- Risk: `backend/app/llm.py:149` and `backend/app/routes/snake_id.py:282` build `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}`. The key leaks into proxy logs, access logs, and any request-tracing middleware.
- Files: `backend/app/llm.py`, `backend/app/routes/snake_id.py`
- Current mitigation: `.env` is gitignored (`.gitignore:35`); no hardcoded keys found in source.
- Recommendations: Use the `X-Goog-Api-Key` header instead of the query param.

### Unbounded uploads / base64 bodies
- Risk: `POST /api/snake-id` accepts an arbitrarily large base64 `image` string in the JSON body (`backend/app/routes/snake_id.py:342`, model at `backend/app/models.py:28-30`) with no size limit — memory exhaustion. `POST /api/transcribe` writes whatever the client sends to a temp file (`backend/app/routes/transcribe.py:47`) with the client-supplied filename extension used as the temp suffix (`transcribe.py:46`, `:111`) — path-separator characters in the extension would be interpolated into the temp path.
- Files: `backend/app/routes/snake_id.py`, `backend/app/routes/transcribe.py`
- Recommendations: Enforce max body size (e.g. 5–10 MB) and validate/sanitize `file.filename` extension against a whitelist.

### LLM output presented as actionable medical guidance
- Risk: `POST /api/snake-id` returns a "venom" classification and `firstAid` text driven by an unvalidated LLM JSON blob (`backend/app/routes/snake_id.py:396-411`); `POST /api/myth-buster` returns LLM text. A hallucinated species/venom classification is shown with confidence numbers. The emergency guard in `backend/app/rag.py:120-125` intercepts only a fixed regex; users can phrase around it.
- Files: `backend/app/routes/snake_id.py`, `backend/app/rag.py`, `backend/app/llm.py`
- Current mitigation: Prompts enforce JSON schema + disclaimers (`snake_id.py:156-189`), RAG prompt has hard safety rules (`rag.py:93-113`).
- Recommendations: Post-validate the LLM JSON against the `CATALOGUE` list, clamp confidence to a ceiling, and require disclaimers in the response renderer.

### Fake seed data with real-looking contact details
- Risk: `backend/app/seed.py:18-27` seeds "District Hospital A", "+91 80 2655 0100" etc. and `backend/app/routes/architecture.py:71` claims "WHO SEARO … reviewed" — demo data that would present fabricated hospitals/phones as real if deployed.
- Files: `backend/app/seed.py`
- Recommendation: Gate demo seeding behind `NODE_ENV != production` / an explicit flag.

## Performance Bottlenecks

### Outbox worker serializes all incident processing
- Problem: `backend/app/eventbus.py:99,113,115,117` — `time.sleep(...)` inside `_handle_incident_created` blocks the single worker thread. One incident ties up the worker for ~4.5s of simulated delays; a burst of SOS events queues in the outbox and waits (drain limit 25/tick, 2.5s tick).
- Files: `backend/app/eventbus.py`
- Cause: Fake acceptance delays run synchronously in the drain loop.
- Improvement path: Make dispatch handling async (asyncio tasks) or move simulated delays out of the worker (e.g. schedule via `asyncio`/a scheduler).

### N+1 queries in hospital ranking
- Problem: `backend/app/eventbus.py:182-203` `get_ranked_hospitals` runs one stock query per hospital in a loop; called on every `GET /api/hospitals` and inside every `POST /api/sos`.
- Files: `backend/app/eventbus.py`
- Improvement path: Single JOIN query (`SELECT h.*, s.* FROM Hospital h LEFT JOIN AntivenomStock s ON s.id = (SELECT id ... LIMIT 1)`).

### RAG retrieval is fully in-memory per request
- Problem: `backend/app/rag.py:53-83` re-transforms the query and computes cosine similarity over the whole corpus per request; the TF-IDF index rebuild (`_build_index`) runs synchronously on the first request after any corpus change (`rag.py:45-50`).
- Files: `backend/app/rag.py`
- Improvement path: Cache query vectors/results for repeated queries; warm the index at startup.

### Admin panels poll continuously
- Problem: `frontend/src/components/interactive.tsx:1103` (audit, every 8s) and `:1231` (outbox) poll `/api/audit` and `/api/outbox` whenever in view; each call opens/closes a SQLite connection and re-queries.
- Files: `frontend/src/components/interactive.tsx`
- Improvement path: Use SSE/push or increase interval; batch queries.

## Fragile Areas

### Monolithic frontend components
- `frontend/src/components/interactive.tsx` is ~1777 lines (all interactive panels in one file), `frontend/src/components/sections.tsx` ~800, `frontend/src/components/ui/sidebar.tsx` ~640. Any change risks touching unrelated panels; multiple components share a giant props surface.
- Safe modification: Split per-feature (SosPanel, RiskPanel, SnakeIdPanel, AuditPanel, OutboxPanel, HospitalConsole, SymptomLogger) before adding features.

### Duplicated domain logic across stacks
- Files: `frontend/src/lib/nagraksha.ts` vs `backend/app/domain.py`; `frontend/src/lib/eventbus.ts` vs `backend/app/eventbus.py`.
- Why fragile: Ranking weights, ETA speeds, freshness thresholds, dispatch lanes are copied. A change in one (e.g. stock freshness threshold `mins <= 30` vs `m<=120` — already inconsistent: `nagraksha.ts:37-40` vs `domain.py:41`) silently diverges.
- Test coverage: No cross-check tests between the two implementations.

### Schema drift between Prisma and Python SCHEMA
- Files: `frontend/prisma/schema.prisma` vs `backend/app/database.py:19-160`.
- Why fragile: Two hand-maintained schemas; e.g. Prisma has `@@index([type])` on OutboxEvent which Python lacks; defaults/types differ (Boolean vs INTEGER). Tests only exercise the Python side.

### Event loss in the in-memory bus
- Files: `backend/app/eventbus.py:18-19` (`_subscribers`), `backend/app/routes/incidents.py:84-86`.
- Why fragile: SSE subscribers are process-local. Events emitted while no subscriber is connected are dropped (only the outbox table retains them). Restarting the backend mid-incident loses all live state updates; the client only gets the next `snapshot` on reconnect.

### `conftest.py` mocks away the worker
- Files: `backend/tests/conftest.py:19-27`.
- Why fragile: Tests patch `start_worker` everywhere, so the outbox → dispatch → state-machine path is never exercised end-to-end; `test_routes.py:76-78` explicitly skips the SSE endpoint. The riskiest logic (event handler, state transitions) is the least tested.

## Scaling Limits

- **SQLite single file** (`backend/db/nagraksha.db`, ignored via `.gitignore:66`): one writer; `get_conn()` opens a new connection per call (`backend/app/database.py:170-182`) with no WAL mode or connection pooling. Fine for a demo; fails under concurrent SOS traffic.
- **In-process outbox worker**: single thread, 2.5s tick, 25 events/tick (`backend/app/eventbus.py:135`), plus ~4.5s of sleeps per incident → throughput of roughly one incident every few seconds.
- **SSE subscribers**: unbounded `_subscribers` list growth (cleanup relies on generator `finally`, `backend/app/routes/incidents.py:102-104`); no per-IP cap.
- **RAG corpus**: TF-IDF matrix is dense and fully in-memory (`backend/app/rag.py`); a corpus of thousands of chunks will slow every query.
- **`snake_id.py` and `transcribe.py`**: every call invokes paid third-party APIs with no rate limit — quota/cost exhaustion is the first scaling wall in production.

## Dependencies at Risk

- **`llama-cpp-python>=0.3`** (`backend/requirements.txt:10`): heavy native build; installed unconditionally in CI (`ci.yml:43`) even though the model folder is empty (`model/.gitkeep`) — the local GGUF path is dead weight in CI and adds startup import cost.
- **`grok-2-latest`, `llama-3.3-70b-versatile`, `gemini-2.5-flash`, `whisper-large-v3-turbo`** pinned in code (`backend/app/llm.py:95,122,149`, `backend/app/routes/snake_id.py:205,244,282`, `transcribe.py:54`): provider model renames/deprecations fail silently (all exceptions swallowed → `None` → fallback), hiding degradation. No monitoring of which provider answered.
- **`next@^16.1.1`, `react@^19`** (`frontend/package.json:53,56`): very new majors; Next 16 standalone output build flow is custom (`frontend/package.json:7`) and CI never runs `next build` — build breaks ship unnoticed.
- **`@prisma/client@^6.11.1`**: kept alive by dead code (see Tech Debt).
- **`scikit-learn==1.5.2`** pinned while `numpy>=1.26` is loose — wheel/ABI mismatch risk on fresh installs.

## Missing Critical Features

- **Authentication/RBAC and rate limiting** — no auth at all; the architecture manifest claims it (`backend/app/routes/architecture.py:26`).
- **Idempotency keys on SOS** — design requires `POST /api/sos with idempotency key` (`backend/app/routes/architecture.py:52`); retries create duplicate incidents (each POST inserts a new incident, `backend/app/routes/sos.py:21-27`).
- **Symptom logging endpoint** — UI posts to `/api/incidents/{id}/symptoms` which doesn't exist (see Tech Debt).
- **Offline SMS SOS** — UI copy claims it (`frontend/src/app/page.tsx:163`, emergency-guide); no `sms:`/`tel:`/Web Push/notification code exists anywhere.
- **Real weather/risk data** — `/api/risk` returns seeded rows only (`backend/app/routes/risk.py:22-25`, `backend/app/seed.py:43-53`); no weather API integration despite architecture claims (`architecture.py:36`).
- **Web Push / SMS delivery** — listed in the architecture manifest (`architecture.py:36,46`) but not implemented; SSE is the only realtime channel.

## Test Coverage Gaps

- **Backend routes untested**: `rag.py`, `llm.py`, `eventbus.py` worker, `snake_id.py`, `transcribe.py`, `risk.py`, `stats.py`, `architecture.py`, `ops.py`, `myth_buster.py`, and the SSE stream have zero tests (`backend/tests/` covers only SOS, incident GET/audit, hospitals — `test_routes.py`, `test_domain.py`).
- **Frontend tests cover dead code**: `frontend/src/lib/__tests__/eventbus.test.ts` tests the orphaned Prisma bus; `nagraksha.test.ts` tests duplicated helpers. No tests for `interactive.tsx`, SOS flow, `page.tsx`, `voice-input.tsx`, or `emergency-guide.tsx`.
- **CI never builds**: `.github/workflows/ci.yml:26-29` runs eslint/tsc/vitest only — `next build` (custom standalone copy in `frontend/package.json:7`) and `prisma generate` are never exercised; build/runtime errors slip through.
- **Priority**: High — the outbox/dispatch state machine (`backend/app/eventbus.py`) and RAG safety guard (`backend/app/rag.py:120-125`) are the highest-risk untested code.

---

*Concerns audit: 2026-08-11*
