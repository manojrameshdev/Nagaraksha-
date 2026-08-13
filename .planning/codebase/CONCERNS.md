# Codebase Concerns

**Analysis Date:** 2026-08-13

## Tech Debt

### Legacy Prisma event-bus test is broken (fails `vitest run`)
- Issue: `frontend/src/lib/__tests__/eventbus.test.ts` imports `../eventbus` (`eventbus.test.ts:27`), but `frontend/src/lib/eventbus.ts` and `frontend/src/lib/db.ts` were deleted when the backend migrated to Python. `npx vitest run` fails immediately with `Failed to resolve import "../eventbus"`.
- Files: `frontend/src/lib/__tests__/eventbus.test.ts`, missing `frontend/src/lib/eventbus.ts`
- Why: The Node/Prisma prototype's outbox bus was replaced by `backend/app/eventbus.py`, and the frontend lib modules were removed, but the test referencing them was not.
- Impact: Any run of the frontend test suite fails; CI does not run vitest, so this is silently green (`frontend-build` job only runs `next build`).
- Fix approach: Delete `frontend/src/lib/__tests__/eventbus.test.ts` (the Python bus is now the runtime), and add `npx vitest run` to the CI frontend-build job so regressions surface.

### Dual-language domain duplication still present
- Issue: `backend/app/domain.py` (authoritative) and `frontend/src/lib/nagraksha.ts` both implement haversine, road factor, ETA, stock freshness, hospital ranking, and dispatch simulation; logic has already drifted (TS `stockFreshness` special-cases 30 min at `nagraksha.ts:37-43`; Python uses ≤120 min at `domain.py:54`; ranking weights differ entirely — TS `rankHospitals` uses stock-status constants, Python uses distance/stock/compliance composite).
- Files: `backend/app/domain.py`, `frontend/src/lib/nagraksha.ts`, `frontend/src/lib/__tests__/nagraksha.test.ts`
- Impact: Fixes must be applied twice; the TS copy only exists for tests and can mislead.
- Fix approach: Delete the TS mirror + its tests once the backend is confirmed as the runtime source of truth (UI already calls `/api/hospitals`).

### Dead Twilio dispatch module — real SMS never wired into SOS flow
- Issue: `backend/app/dispatch.py` implements `do_dispatch()` (real Twilio SMS to registered responders) and `get_nearest_responders()`, but nothing imports or calls it. `backend/app/eventbus.py:_handle_incident_created` calls `simulate_dispatch()` directly (`eventbus.py:73`), so even with Twilio credentials + registered responders, an SOS sends no SMS.
- Files: `backend/app/dispatch.py`, `backend/app/eventbus.py`, `backend/app/routes/twilio_webhook.py`, `backend/app/routes/incidents.py`
- Impact: The headline "real SMS dispatch" feature is non-functional end-to-end; the responder registry (`POST /api/responders`) and webhook exist but are disconnected from the incident pipeline.
- Fix approach: Call `do_dispatch()` from `_handle_incident_created` when real responders are registered (fall back to simulation otherwise), persist SMS SIDs/outcomes in `DispatchAttempt`, and wire `activeIncidentId` on responders at dispatch time.

### Dead/unused frontend components
- Issue: `frontend/src/components/sections.tsx` (826 lines) exports 12 components but `frontend/src/app/page.tsx` imports only `TopAppBar`, `NavigationDrawer`, `SiteFooter` — `Hero`, `Problem`, `ParallelDispatch`, `HowItFlows`, `Roles`, `Prevention`, `Routing`, `Roadmap`, `Section` are never rendered (they pull in `Reveal`/`SlitherSprite`). `frontend/src/components/tri-line-dock.tsx`, `snake-progress.tsx`, `frontend/src/lib/realtime.ts` (exports `useIncidentSocket`) have no importers. `LazyArchitecture`/other lazy wrappers in `frontend/src/components/lazy-sections.tsx` are not rendered by `page.tsx` either.
- Files: `frontend/src/components/sections.tsx`, `frontend/src/components/tri-line-dock.tsx`, `frontend/src/components/snake-progress.tsx`, `frontend/src/lib/realtime.ts`, `frontend/src/components/lazy-sections.tsx`
- Impact: Dead bundle surface, confused onboarding, and a WebSocket hook (`useIncidentSocket`) that exists but is never used — realtime WS updates (e.g. `dispatch_accepted` via `backend/app/routes/ws.py`) reach no client.
- Fix approach: Delete unrendered sections from `sections.tsx`, remove orphaned components, and either wire `useIncidentSocket` into the SOS flow or remove it.

### Response-shape inconsistency in routes
- Issue: Some routes raise `HTTPException` (proper 404 — `backend/app/routes/wound.py`, `audit.py`), others return `{"error": ...}` with HTTP 200 (`backend/app/routes/hospitals.py:update_stock`, `backend/app/routes/incidents.py:log_symptom`/`accept_dispatch`, and the SSE stream returns `{"error": "Not found"}` for a missing incident, which breaks `EventSource` parsing).
- Files: `backend/app/routes/hospitals.py`, `backend/app/routes/incidents.py`, `backend/app/routes/wound.py`
- Impact: Clients must special-case 200-with-error; `EventSource` cannot consume the SSE stream when the incident id is wrong.
- Fix approach: Standardize on `HTTPException(404)` for missing resources, keep the SSE endpoint 404-consistent.

## Known Bugs

### Frontend tests fail out of the box
- Symptoms: `cd frontend && npx vitest run` → `Error: Failed to resolve import "../eventbus"`; 1 of 2 test files fails before any test runs (13 nagraksha tests still pass).
- Trigger: Any vitest run.
- Files: `frontend/src/lib/__tests__/eventbus.test.ts`
- Workaround: Delete the file or run with `--exclude`.
- Root cause: Test for a removed module survived the backend migration.

### Unvalidated query params crash endpoints with 500
- `backend/app/routes/ops.py:51` — `int(request.query_params.get("k", 4))` raises `ValueError` → unhandled 500 on `/api/knowledge-base?k=abc`; `k` is also unbounded (minor DoS via huge slice in `rag.py:retrieve`).
- `backend/app/routes/risk.py:19-20` — `float(request.query_params.get("lat", ...))` raises `ValueError` on non-numeric input → 500; no range checks on lat/lng.
- Files: `backend/app/routes/ops.py`, `backend/app/routes/risk.py`
- Trigger: `GET /api/knowledge-base?k=x`, `GET /api/risk?lat=foo`
- Fix approach: Use FastAPI typed query params (`k: int = Query(4, ge=1, le=50)`, `lat: float = Query(..., ge=-90, le=90)`) as already done in `backend/app/routes/hospitals.py:13-18`.

### Mismatched ISO timestamp formats in stats trend
- Issue: `backend/app/routes/stats.py:41-44` compares `day.isoformat()` (`...+00:00` suffix) against `createdAt` stored by `backend/app/database.py:now_iso()` with a `Z` suffix using string comparison. It happens to order correctly today but is fragile and timezone-dependent.
- Files: `backend/app/routes/stats.py`, `backend/app/database.py`
- Fix approach: Parse to tz-aware `datetime` and compare.

### SSE stream returns 200 with JSON body for missing incident
- Issue: `GET /api/incidents/{inc_id}/stream` returns `{"error": "Not found"}` with status 200 (`backend/app/routes/incidents.py:69-70`) — the client's `EventSource` fails with a parse error instead of a clear 404.
- Fix approach: Raise `HTTPException(404)` (currently returns a plain dict; the route is async so raising is safe).

### Responder accept/decline buttons in UI are no-ops
- Symptoms: "Accept Dispatch" / "Decline / Re-route" buttons on the Responder view have no `onClick` handlers; `SymptomLogger` is passed the hardcoded fake id `"NR-1042"` (`frontend/src/app/page.tsx:229`, default in `interactive.tsx:1651`) which never matches real 24-hex incident ids.
- Files: `frontend/src/app/page.tsx:220-228`, `frontend/src/components/interactive.tsx:1651`
- Fix approach: Wire buttons to `PATCH /api/incidents/{id}/accept|decline` (endpoints exist) and pass a real incident id.

### `no-console` lint rule conflicts with existing code
- Symptoms: `frontend/eslint.config.mjs` sets `no-console: 'error'` but `frontend/src/lib/realtime.ts` and other components call `console.log`/`console.warn`; a `cd frontend && eslint .` run will flag them.
- Files: `frontend/eslint.config.mjs`, `frontend/src/lib/realtime.ts:14,19,24,36`
- Fix approach: Either allow console in specific files via overrides, or remove the debug logs.

## Security Considerations

**JWT defaults + weak role secrets:**
- Risk: `backend/app/auth.py` hardcodes fallback secrets (`nagraksha-demo-secret-change-in-prod`, `victim-demo`, `hospital-demo`, `admin-demo`) when env vars are unset; anyone can mint admin tokens against a default-configured deployment.
- Current mitigation: `POST /api/auth/token` rate-limited to 10/min (`backend/app/main.py:55`); only stakeholder write routes are protected.
- Recommendations: Require `JWT_SECRET`/role secrets in production (fail startup, not silently default); add `require_role` to more mutating routes (stock updates, symptom logs, responders).

**Twilio webhook has no signature validation:**
- Risk: `POST /webhook/twilio` (`backend/app/routes/twilio_webhook.py`) accepts any POST and acts on the `From` phone number; an attacker spoofing a responder's number could accept/decline dispatches.
- Current mitigation: Responders matched by phone; Twilio signature validation (`X-Twilio-Signature`) is not implemented.
- Recommendations: Validate Twilio signatures (templibs `twilio.request_validator`) before mutating dispatch state.

**Open endpoints / no auth on incident data:**
- Risk: Incident, audit, outbox, wound, and responder data are readable/writable without auth (`backend/app/routes/*.py` — only stakeholders use `require_role`).
- Current mitigation: CORS restricted to localhost:3000 + `FRONTEND_URL`; `backend/app/main.py:36`.
- Recommendations: Add role gates (`victim`/`hospital_admin`/`system_admin`) to sensitive routes before any public deployment.

**Sensitive data in SQLite + base64 images:**
- Risk: `WoundReading.imageB64` stores full wound photos base64 in the DB file (`backend/app/database.py`), and `SymptomObservation`/`Incident` hold personal health/location data with no encryption.
- Current mitigation: DB file gitignored (`backend/db/`); no access control on reads.
- Recommendations: Encrypt at rest or move images to object storage; add audit-gated access.

## Performance Bottlenecks

**Outbox worker is single-threaded with sleeps:**
- Problem: `_handle_incident_created` blocks the lone worker thread with `time.sleep` for simulated accept delays + state transitions (`backend/app/eventbus.py:97-118`, ≈4-5 s per incident); only one incident processes at a time, and `_worker_tick` iterates pending events serially.
- Files: `backend/app/eventbus.py`
- Cause: Demo-grade simulation inside the poller.
- Improvement path: Move delays to per-lane async timers or a job queue; process lanes in parallel.

**N+1 queries in ranking/stats:**
- Problem: `get_ranked_hospitals` (`backend/app/eventbus.py:181-207`) issues one stock query per hospital; `stats.py` similarly re-queries freshest stock per hospital; `risk.py` loads all reports then scans for nearest.
- Files: `backend/app/eventbus.py`, `backend/app/routes/stats.py`, `backend/app/routes/risk.py`
- Cause: Raw SQL without join aggregation.
- Improvement path: Single `JOIN` on latest `AntivenomStock` per hospital; nearest-report query via SQL.

## Fragile Areas

**`backend/app/routes/incidents.py` SSE stream:**
- Why fragile: Manually manages `asyncio.Queue`, per-connection bus subscriptions, heartbeat timeouts, and closes on `HANDED_OFF` (`incidents.py:88-121`); a missed unsubscribe leaks callbacks; WebSocket (`ws.py`) is the preferred channel but the SSE path remains the one `LiveSosDemo` actually uses (`interactive.tsx:245`).
- Safe modification: Keep both transports; extract shared event-subscription logic; test with a real client.
- Test coverage: Explicitly noted as untestable via ASGI transport (`test_routes.py:75-77`); no WS tests.

**ChromaDB/TF-IDF dual retrieval (`backend/app/rag.py`):**
- Why fragile: ChromaDB collection + TF-IDF index are lazily built module singletons; the fallback path (`_retrieve_tfidf`) and ChromaDB path return different shapes (`content` vs `text`), and `rag_answer` keys off `content` for context but `myth_buster.py` reads `docId`/`title`/`category` from both. Onnx embedding download at first startup adds latency.
- Safe modification: Test both paths (patch `_get_collection` to `None`); keep fallback behavior when ChromaDB is absent.
- Test coverage: None.

**Demo seed vs runtime schema drift:**
- Why fragile: `backend/app/seed.py` wipes/inserts `AntivenomStock`, `Hospital`, `RiskReport`; `migrate_db()` adds compliance columns. Re-running seed deletes stock history; hospital ids change each run (24-hex), breaking any hardcoded references.
- Safe modification: Make seed idempotent by name or stable ids.
- Test coverage: Seed not covered by tests.

## Scaling Limits

**SQLite single file:**
- Current capacity: Single writer via `get_conn()`; fine for demo (hundreds of rows).
- Limit: Concurrent writes serialize; WAL not enabled; large `WoundReading.imageB64` blobs bloat the file.
- Scaling path: Enable WAL, move images to storage, migrate to Postgres for multi-writer production.

**ChromaDB default ONNX embeddings:**
- Current capacity: ~40MB model, in-memory index over the small KB corpus.
- Limit: Full-scan retrieval on each query; onnxruntime memory grows with corpus.
- Scaling path: Pre-computed embeddings + server-mode ChromaDB or a dedicated vector DB.

## Dependencies at Risk

**llama-cpp-python (optional local GGUF):**
- Risk: Imported lazily inside `_load_gguf` (`backend/app/llm.py:84`) but **not listed in `backend/requirements.txt`** — local-GGUF generation silently never works in fresh installs (import error caught → returns `None`).
- Impact: Offline mode unavailable; RAG falls to cloud providers only.
- Migration plan: Add `llama-cpp-python` as an optional extra or document the manual install step.

**Supabase / TanStack Query / Sentry frontend deps:**
- Risk: `@supabase/supabase-js`, `@tanstack/react-query`, `@sentry/nextjs` are in `frontend/package.json` (and supabase keys in `docker-compose.yml`/`.env.example`) but nothing in `frontend/src` imports them — dead dependency weight.
- Impact: Larger installs/builds; misleading env docs.
- Migration plan: Remove unused deps or implement the planned integrations.

## Missing Critical Features

**Accept/decline flow not wired end-to-end:**
- Problem: Backend has `PATCH /api/incidents/{id}/accept|decline` and a Twilio webhook, but the UI buttons are no-ops and the worker auto-accepts via simulation.
- Blocks: Real responder workflow; judge demo of two-way dispatch.
- Implementation complexity: Low (wire buttons + call `do_dispatch`).

**Real-time WS consumer:**
- Problem: `backend/app/routes/ws.py` broadcasts (`WOUND_UPDATE`, `dispatch_accepted`), but no frontend component subscribes (`useIncidentSocket` in `frontend/src/lib/realtime.ts` is unused).
- Blocks: Live hospital view updates beyond SSE.
- Implementation complexity: Low (import hook into `LiveSosDemo`/wound views).

**Auth beyond stakeholder routes:**
- Problem: Only `POST/DELETE /api/stakeholders` require a role.
- Blocks: Safe multi-role deployment.
- Implementation complexity: Medium.

## Test Coverage Gaps

**Frontend CI gap:**
- What's not tested: Vitest suite (currently broken) — CI only builds.
- Risk: Regression in `nagraksha.ts`/domain mirrors goes unnoticed.
- Priority: High (suite is red; CI is green).
- Difficulty: Low (add vitest step to `.github/workflows/ci.yml`; delete dead test).

**RAG/LLM/Wound/WS/Twilio routes:**
- What's not tested: `rag.py`, `llm.py`, `wound.py`, `audit.py`, `stakeholders.py`, `twilio_webhook.py`, `ws.py` broadcast.
- Risk: Fail-open fallback chains could silently return degraded results.
- Priority: Medium.
- Difficulty: Medium (mock providers, patch `_get_collection`, ASGI WS test client).

**Outbox worker state machine:**
- What's not tested: `_handle_incident_created` transitions and outbox retry/FAILED logic (sleeps make it slow).
- Risk: Dispatch simulation regressions.
- Priority: Medium.
- Difficulty: Medium (patch `time.sleep`).

**Compliance scoring:**
- What's not tested: `backend/app/compliance.py` formula and scheduler job.
- Risk: Hospital ranking weights could mis-route with bad compliance data.
- Priority: Low-Medium.
- Difficulty: Low (pure function tests).

---

*Concerns audit: 2026-08-13*
