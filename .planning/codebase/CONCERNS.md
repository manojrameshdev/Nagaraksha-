# Codebase Concerns

**Analysis Date:** 2026-08-14

## Tech Debt

**[Frontend is a static demo — backend never called]:**
- Issue: The entire frontend (`frontend/app/page.tsx`, `frontend/components/nagraksha/workspaces.tsx`, `frontend/components/nagraksha/shared.tsx`, `frontend/components/nagraksha/shell.tsx`) is a hard-coded presentation layer. Every workspace renders static demo strings ("NR-DEMO-1042", "128 demo records", "642 static events") and there is exactly **zero** `fetch()`/API usage in the whole `frontend/` tree. The fully functional FastAPI backend (`backend/app/`) is unreachable from the UI.
- Files: `frontend/components/nagraksha/workspaces.tsx`, `frontend/components/nagraksha/shared.tsx`, `frontend/app/page.tsx`
- Impact: The product does nothing end-to-end. SOS, dispatch, hospital ranking, wound tracking, snake ID, myth-buster, audit — all backend features are dead code from the user's perspective.
- Fix approach: Execute phase 07 (`.planning/phases/07-connect-all-the-features-of-the-frontend-with-the-backend/` is empty — `.gitkeep` only). Restore an API layer equivalent to the deleted `frontend/src/lib/api.ts` + `frontend/src/lib/realtime.ts` (removed in the current uncommitted refactor) and wire workspaces to the endpoints defined in `backend/app/main.py`.

**[Uncommitted 27k-line refactor leaves the repo mid-migration]:**
- Issue: The working tree deletes 139 files / 27,677 lines (`frontend/src/**`, `frontend/vitest.config.ts`, `frontend/package-lock.json`, `frontend/eslint.config.mjs`, `frontend/Dockerfile`, `frontend/public/sw.js`, `frontend/public/manifest.webmanifest`, PWA assets) and adds a minimal static frontend. Every downstream consumer still references the deleted files.
- Files: `.github/workflows/ci.yml` (references `frontend/package-lock.json`, `vitest run`, `npm ci`), `docker-compose.yml` (references `frontend/Dockerfile`), `package.json` (lint-staged references `frontend/eslint.config.mjs`; `db:push`/`db:generate` reference Prisma which was removed)
- Impact: `git commit` of the current state ships a broken CI pipeline, a broken docker-compose, and a broken pre-commit hook. The refactor needs to be finished (CI/docker/lint configs re-synced) before commit.
- Fix approach: Update `.github/workflows/ci.yml` to pnpm + the current frontend layout; regenerate or delete `docker-compose.yml` frontend service; remove dead scripts from `package.json`; recreate an eslint config or drop lint-staged reference.

**[Demo pacing logic embedded in the production event handler]:**
- Issue: `_handle_incident_created` in `backend/app/eventbus.py` hard-codes `time.sleep(0.6/1.6/2.0)` to advance incidents ACCEPTED → TRANSPORTING → HANDED_OFF whenever no real responders exist. Simulation timing (`acceptAt` offsets in `backend/app/domain.py:simulate_dispatch`) and demo state progression are tangled with the real dispatch state machine.
- Files: `backend/app/eventbus.py:141-149`, `backend/app/domain.py:131-146`
- Impact: Behavior differs silently between demo mode and real mode; a regression in demo pacing changes production dispatch semantics.
- Fix approach: Extract a `DEMO_MODE` flag / config-driven pacing module separate from `_handle_incident_created`, or gate simulation behind an explicit config check.

**[Duplicated `_load_incident` and dispatch-accept logic]:**
- Issue: `_load_incident` is copy-pasted in `backend/app/routes/sos.py:50-71` and `backend/app/routes/incidents.py:17-38`; `dispatch.py` has a third variant (`_load_incident` at `backend/app/dispatch.py:28-36`). Accept/decline mutation logic is duplicated between `backend/app/routes/incidents.py:104-149` and `backend/app/routes/twilio_webhook.py:55-94`, with different side effects (the webhook path broadcasts `dispatch_accepted`/`dispatch_declined`, the REST path does not; the REST path accepts *any* pending attempt regardless of which responder, same as the webhook).
- Files: `backend/app/routes/sos.py`, `backend/app/routes/incidents.py`, `backend/app/dispatch.py`, `backend/app/routes/twilio_webhook.py`
- Impact: Fixing a bug in one copy (e.g. binding accepts to `activeIncidentId`) leaves the other inconsistent.
- Fix approach: Move `_load_incident` into a shared module (e.g. `backend/app/incident_repo.py`) and give `accept_dispatch`/`decline_dispatch` a single service function used by both the REST routes and the webhook.

**[411-line route file with an embedded 11-species catalogue]:**
- Issue: `backend/app/routes/snake_id.py` mixes a large hard-coded `CATALOGUE` data structure (species facts, first-aid text, keywords) with three vision-API clients and the HTTP route.
- Files: `backend/app/routes/snake_id.py`
- Impact: Data is not independently maintainable/reviewable (medical copy lives in code); the file is the largest in the app.
- Fix approach: Move `CATALOGUE` into a data module (e.g. `backend/app/snake_catalogue.py`) with a schema validation layer.

**[Dead/misleading config and scripts]:**
- Issue: Root `package.json` scripts `db:push` and `db:generate` invoke Prisma, but Prisma and `frontend/prisma/` were removed; `scripts/dev.sh` uses `next dev --webpack` (Webpack-dev flag) and root `dev:frontend` pipes to `tee ../dev.log`; `start.py --stop` on Windows runs `taskkill /F /FI "IMAGENAME eq node.exe"` which kills **every** Node process on the machine, not just the frontend.
- Files: `package.json:12-14`, `scripts/dev.sh:12`, `start.py:146-152`
- Impact: Confusing DX and a dangerous stop command.
- Fix approach: Remove Prisma scripts, and narrow `start.py --stop` to kill only the spawned PIDs (it already tracks `_procs`).

**[Stray artifacts in repo root]:**
- Issue: `nag-raksha.zip` (72 KB, untracked), `backend.log`, and `dev.log` live at the repo root.
- Files: `nag-raksha.zip`, `backend.log`, `dev.log`
- Impact: Repo noise; the zip may contain the old frontend build.
- Fix approach: Delete the zip; logs are already gitignored.

## Known Bugs

**[Compliance "updates in last 30 days" window never matches by time]:**
- Symptoms: `updates_30d` overcounts — every stock row whose *date* is inside the window is counted regardless of time-of-day.
- Files: `backend/app/compliance.py:28-32`
- Trigger: `verifiedAt` is stored as ISO-8601 with a `Z` suffix (`db.now_iso()` in `backend/app/database.py:291-292`), but the query compares against SQLite's `datetime('now', '-30 days')` which yields `'YYYY-MM-DD HH:MM:SS'`. On the boundary date, `'T'` (0x54) > `' '` (0x20), so `verifiedAt >= cutoff` is always true for rows on the cutoff date — a row 30 days + 1 hour old still counts as "within 30 days".
- Workaround: None in code; impact is a slightly inflated `activity_bonus` (capped at +30).
- Fix approach: Compare against `db.now_iso()` computed 30 days ago in Python (e.g. `(datetime.now(timezone.utc) - timedelta(days=30)).isoformat()`), which matches the stored `'...Z'` format.

**[`next.config.mjs` ignores all TypeScript errors]:**
- Symptoms: `frontend/next.config.mjs:3-5` sets `typescript: { ignoreBuildErrors: true }`, so `next build` succeeds even with type errors.
- Files: `frontend/next.config.mjs:3-5`
- Trigger: Any TS error in `frontend/` — CI's `npm run build` (`.github/workflows/ci.yml:65-68`) will still pass.
- Workaround: Run `npx tsc --noEmit` manually.
- Fix approach: Remove `ignoreBuildErrors` (ROADMAP Phase 2 success criterion #2 explicitly requires the build to fail on TS errors).

**[Twilio webhook can accept/decline without binding to the dispatched responder]:**
- Symptoms: A responder's ACCEPT/READY reply updates the *first* PENDING attempt for the incident, not necessarily the attempt addressed to that responder; there is no check that `responder.activeIncidentId` matches the incident (the lookup only resolves the phone number to a responder row, `backend/app/routes/twilio_webhook.py:40-50`).
- Files: `backend/app/routes/twilio_webhook.py:55-94`
- Trigger: Two responders text ACCEPT in quick succession — both hit the same first PENDING attempt.
- Fix approach: Match on `attempt.responderId = responder.id` and reject when the responder was not dispatched for that attempt.

**[SSE + WebSocket connections leak on silent disconnect]:**
- Symptoms: `backend/app/routes/incidents.py:177-197` heartbeats every 15 s so `is_disconnected()` is only checked between heartbeats, and the WebSocket handler at `backend/app/routes/ws.py:46-49` blocks on `receive_text()` — a client that stops reading (or a dead mobile connection) holds a subscriber/broadcast slot until the OS notices.
- Files: `backend/app/routes/incidents.py:177-197`, `backend/app/routes/ws.py:40-53`
- Fix approach: Track last-ping timestamps and reap idle connections on a timer; bound `_connections[incident_id]` size.

**[`_wait_for_accept_then_advance` stalls the outbox worker for 5 minutes]:**
- Symptoms: With real responders registered, an unaccepted incident keeps its executor thread polling for up to 300 s (`backend/app/eventbus.py:168-189`). The pool is bounded at 4 workers (`backend/app/eventbus.py:25`), so 4 stuck incidents block all subsequent dispatch processing; the 5th outbox event stays PENDING forever.
- Files: `backend/app/eventbus.py:25,168-189,208-217`
- Trigger: Register responders, create 5+ SOS with no SMS replies.
- Fix approach: Make the wait non-blocking (schedule a follow-up check on the event loop / store a `dispatchDeadline` on the incident instead of occupying a worker thread).

## Security Considerations

**[Authorization is off by default — anonymous callers can mutate core data]:**
- Risk: `AUTH_ENFORCED` defaults to `False` unless `ENV=production` (`backend/app/auth.py:63-66`). Every mutating route uses `require_role_if_enforced(...)`, so with default config any anonymous caller can update hospital stock (`backend/app/routes/hospitals.py:21-39`), accept/decline dispatches (`backend/app/routes/incidents.py:104-149`), log symptoms, submit wound readings (`backend/app/routes/wound.py:20-81`), and register responders (`backend/app/routes/twilio_webhook.py:106-124`).
- Files: `backend/app/auth.py:63-66,115-130`, `backend/app/routes/hospitals.py:25`, `backend/app/routes/incidents.py:86,107,131`, `backend/app/routes/wound.py:25`, `backend/app/routes/twilio_webhook.py:114`
- Current mitigation: `ENV=production` flips enforcement on and rejects demo secrets at import (`backend/app/auth.py:32-37,47-51`).
- Recommendations: Ship `AUTH_ENFORCED=true` in the compose/CI environments; add a startup warning (or refuse to start in dev with default secrets) when enforcement is off.

**[Known demo secrets are committed defaults — tokens are forgeable when not enforced]:**
- Risk: `JWT_SECRET` defaults to `"nagraksha-demo-secret-change-in-prod"` and role secrets to `victim-demo`/`hospital-demo`/`admin-demo` (hard-coded in `backend/app/auth.py:25-26,55-59`). Anyone can mint a `system_admin` token via `POST /api/auth/token` (rate-limited at 10/min only, `backend/app/main.py:95-103`) whenever `AUTH_ENFORCED` is off.
- Files: `backend/app/auth.py:25-59`, `backend/app/main.py:94-103`
- Current mitigation: Production-mode import guard.
- Recommendations: Fail startup if `JWT_SECRET` is the demo value regardless of `ENV`; add a random per-deployment default.

**[WebSocket channel has no authentication]:**
- Risk: `backend/app/routes/ws.py:40-53` accepts any connection for any `incident_id` with no token check, so any client can subscribe to an incident's live stream (location, severity, symptoms).
- Files: `backend/app/routes/ws.py:40-53`
- Recommendations: Require a valid role token (query param or subprotocol) on connect, matching `backend/app/auth.py:get_role`.

**[No request-size limits on upload endpoints — quota/cost abuse vectors]:**
- Risk: `backend/app/routes/transcribe.py:24-89` (file upload + `transcribe-b64` base64 endpoint), `backend/app/routes/wound.py:20-37` (wound photo), and `backend/app/routes/snake_id.py:342-411` (image) read arbitrary-size payloads fully into memory, base64-encode them, and forward them to paid third-party APIs (Groq/Gemini/Grok). An attacker can burn API quota and memory with multi-MB uploads. None of these endpoints are authenticated or rate-limited.
- Files: `backend/app/routes/transcribe.py:41-47,105-113`, `backend/app/routes/wound.py:36-37`, `backend/app/routes/snake_id.py:200-304`
- Recommendations: Enforce a max upload size (e.g. 4–10 MB) at the endpoint, add `@limiter.limit(...)`, and require a role token.

**[Twilio webhook signature check is conditional]:**
- Risk: `backend/app/routes/twilio_webhook.py:27-33` only validates `X-Twilio-Signature` when `TWILIO_AUTH_TOKEN` is set. In a deployment with SMS enabled but the token unset (or the check skipped because the env var is missing), anyone who knows a responder's phone number can spoof ACCEPT/READY/DECLINE replies.
- Files: `backend/app/routes/twilio_webhook.py:27-33`
- Recommendations: Refuse to enable SMS dispatch (`backend/app/dispatch.py:15-22`) unless the auth token is also configured, and always validate signatures when the webhook is live.

**[JWT claims are minimal]:**
- Risk: Tokens carry only `role`, `iat`, `exp` (`backend/app/auth.py:69-76`) — no issuer/audience/jti. There is no revocation mechanism; a leaked 24-hour token is valid until expiry across all deployments sharing the secret.
- Files: `backend/app/auth.py:69-76`
- Recommendations: Add `iss`/`aud` claims and support `AUTH_DISABLE`/key rotation for incidents.

**[Rate limiter keyed by IP without proxy trust]:**
- Risk: `main.py:47` uses `get_remote_address` with no proxy headers configuration; behind a reverse proxy all clients share the proxy IP and exhaust the 200/min budget together.
- Files: `backend/app/main.py:47,64-65`
- Recommendations: Configure `ProxyHeadersMiddleware`/trusted proxy settings or key on a per-client token.

## Performance Bottlenecks

**[Sequential LLM fallback chain can block requests for minutes]:**
- Problem: `backend/app/llm.py:generate()` tries local GGUF → Groq → Grok → Gemini sequentially, each with 30–60 s timeouts (`llm.py:100,130,163,281`). With all three keys set and providers down, a single RAG question (`rag.py:190-226`) or snake-id (`snake_id.py:342-411`) request blocks the request thread for up to ~2.5 minutes before falling back.
- Files: `backend/app/llm.py:179-220`, `backend/app/routes/snake_id.py:342-411`
- Cause: Strict sequential fallback with full timeout per provider.
- Improvement path: Run providers concurrently and take the first success; cap total fallback time; move generation off the request thread.

**[Single-threaded synchronous SQLite with per-call connections]:**
- Problem: Every `db.get_conn()` opens a fresh connection (`backend/app/database.py:274-288`); the outbox poller opens one every 2.5 s and each incident job opens dozens. Writes serialize on SQLite's single writer lock, and the worker threads + FastAPI event loop contend.
- Files: `backend/app/database.py:274-288`, `backend/app/eventbus.py:200-224`
- Cause: No connection pooling, no write batching.
- Improvement path: Use a small connection pool (e.g. `sqlite3` with a single writer thread or aiosqlite), batch outbox drains.

**[GGUF model loads into API process memory]:**
- Problem: `backend/app/llm.py:44-55` loads a multi-GB `.gguf` into the API process RAM on first use; there is no separate inference service and no eviction.
- Files: `backend/app/llm.py:44-55`
- Cause: In-process llama-cpp.
- Improvement path: Run local inference as a separate service/process or keep cloud-only.

**[`seed_kb` loads the full ChromaDB id list on every seed]:**
- Problem: `backend/app/rag.py:140` calls `col.get()["ids"]` which materializes all document IDs; fine at 22 chunks today, unbounded as the KB grows.
- Files: `backend/app/rag.py:140`
- Improvement path: Query `collection.count()` and skip seeding entirely when counts match, or track a seed version.

## Fragile Areas

**[The uncommitted refactor itself]:**
- Files: everything under `frontend/` (new `app/`, `components/`, `lib/`) plus deleted `frontend/src/`, `frontend/vitest.config.ts`, `frontend/package-lock.json`, `frontend/eslint.config.mjs`, `frontend/Dockerfile`
- Why fragile: The tree is mid-migration; `git status` shows 139 changed files. CI (`ci.yml`), docker-compose, husky `pre-commit` (runs `npx lint-staged`, `package.json` lint-staged references the deleted `frontend/eslint.config.mjs`), and root scripts all reference removed files. `frontend/node_modules` is not even installed.
- Safe modification: Finish the migration before committing; re-sync CI/docker/lint config; install frontend deps (`pnpm install`).
- Test coverage: None for the new frontend; the 16 vitest tests were deleted with `frontend/src/`.

**[Backend auth module changes semantics at import time]:**
- Files: `backend/app/auth.py:29-66`
- Why fragile: `_env_secret`/`_role_secret` raise `RuntimeError` at import when `ENV=production` with demo values — startup depends on environment ordering; `.env` loading happens in `main.py:14` *before* the auth import chain, but any test/import path that loads `app.auth` without `load_dotenv()` gets demo defaults silently.
- Safe modification: Keep `load_dotenv()` at the top of `app/__init__.py` or make the guard lazy.
- Test coverage: None for `auth.py` (no test of token minting/403 enforcement).

**[Eventbus global state (`_worker_started`, `_inflight`, `_executor`, `_subscribers`)]:**
- Files: `backend/app/eventbus.py:20-28`
- Why fragile: Module-level singletons; tests must patch `start_worker` and `time.sleep` (see `backend/tests/conftest.py:19-27`, `test_eventbus.py:69`); a second `start_worker()` call after a failure leaves a partially-started worker; `_loop` in `ws.py:21-26` is only set in the app lifespan, so broadcasts from threads before lifespan complete are dropped silently.
- Safe modification: Make the worker lifecycle explicit (start/stop idempotent, loop-bound broadcasting via a queue).
- Test coverage: `test_eventbus.py` covers retry/FAILED and happy path; no coverage for the real-time broadcast path or the WS loop.

**[`app/manifest.ts` regenerates PWA manifest but no service worker remains]:**
- Files: `frontend/app/manifest.ts`, deleted `frontend/public/sw.js`
- Why fragile: The old `sw.js`, `offline.html`, and manifest icons were deleted in the refactor; the app still declares PWA metadata (`frontend/app/layout.tsx:5-27`), so install prompts may appear for a shell that has no offline capability.
- Safe modification: Decide — either re-add a service worker or drop PWA claims.
- Test coverage: None.

## Scaling Limits

**[Outbox worker concurrency]:**
- Current capacity: 4 concurrent incident jobs (`backend/app/eventbus.py:25`), poller drains up to 25 events per tick every 2.5 s.
- Limit: Real-dispatch incidents hold a worker for up to 300 s (`eventbus.py:168-189`), so ≥4 unaccepted incidents saturate dispatch processing entirely.
- Scaling path: Replace blocking wait with deadline-based rescheduling; scale the pool with config; move to a real broker when multi-instance is needed.

**[SQLite single-node storage]:**
- Current capacity: demo scale (a handful of rows); WAL allows concurrent readers.
- Limit: Single-file DB serializes writes; `chroma_db` and `nagraksha.db` both live on one disk; no replication.
- Scaling path: Postgres + dedicated vector store when multi-instance deployment is required.

**[In-process event bus]:**
- Current capacity: in-process `_subscribers` dict + thread executor.
- Limit: No cross-instance delivery; a second uvicorn worker would duplicate dispatch jobs (each worker polls the same outbox table).
- Scaling path: Use the outbox table as the source of truth and add a distributed lock/lease per event, or move to Redis Streams.

## Dependencies at Risk

**[`next` 16.3.0 (new major) + mixed lockfiles]:**
- Risk: `frontend/package.json` pins `next: 16.3.0`, `react: ^19`; lockfile is `frontend/pnpm-lock.yaml` while CI still caches/installs via `frontend/package-lock.json` (deleted). `package.json` also carries a `pnpm.overrides` for `hono` (`frontend/package.json:33-37`) with no hono dependency visible — likely a stale override.
- Impact: CI frontend job cannot install dependencies at all (`npm ci` fails on missing lockfile); builds only pass locally if a pnpm install is done manually.
- Migration plan: Rewrite `ci.yml` frontend job to `pnpm`; drop the hono override.

**[`eslint-config-next`/`typescript-eslint` present at root but no eslint config or runner in frontend]:**
- Risk: Root `package.json` devDeps include `eslint-config-next`, `eslint-plugin-security`, `typescript-eslint`, but `frontend/eslint.config.mjs` was deleted and `frontend/package.json` has no `eslint` dependency. `npm run lint` (`package.json:11`) fails.
- Impact: Phase 4 "ESLint Hardening" (ROADMAP) is silently undone; pre-commit lint-staged breaks.
- Migration plan: Re-add an eslint flat config in `frontend/` (or root) and add eslint to frontend devDeps.

**[`chromadb>=0.5.0` + `scikit-learn` fallback]:**
- Risk: Two overlapping retrieval stacks; `scikit-learn` kept only as a fallback (`backend/requirements.txt:13-14`). ChromaDB pulls `onnxruntime` (~40 MB); on constrained containers the fallback path may activate without warning to the operator.
- Impact: Behavior drift between environments (semantic vs TF-IDF results).
- Migration plan: Decide on a single retrieval backend; surface which mode is active in `/api/health`.

**[Python version skew: CI 3.11 vs local 3.13]:**
- Risk: `ci.yml:17-18` uses Python 3.11; local `backend/.venv` is 3.13 (pyvenv.cfg). `llama-cpp-python` (optional) and `chromadb` have version-sensitive native wheels.
- Impact: Locally green, CI red (or vice versa) on native-dependency edges.
- Migration plan: Align CI to 3.12/3.13 or pin a shared `.python-version`.

## Missing Critical Features

**[Idempotency key on SOS]:**
- Problem: The architecture manifest claims "POST /api/sos with idempotency key — retry safely" (`backend/app/routes/architecture.py:52`), but `backend/app/routes/sos.py:15-47` accepts no idempotency key; duplicate taps create duplicate incidents and duplicate SMS fan-outs.
- Blocks: Safe retry under flaky rural connectivity — a core requirement for an emergency app.

**[Responder escalation on no-accept]:**
- Problem: `_wait_for_accept_then_advance` merely times out and logs (`backend/app/eventbus.py:168-189`); there is no escalation to the next candidate, and the incident is left in `DISPATCHING` forever.
- Blocks: The "escalation on timeout" behavior in `backend/app/routes/architecture.py:56`.

**[Frontend auth/login flow]:**
- Problem: The demo UI has no login, so `AUTH_ENFORCED=true` would lock out every UI action. The security and the UI are mutually exclusive today.
- Blocks: Enabling production authorization.

**[Web Push / object storage / maps (advertised in the architecture manifest)]:**
- Problem: `backend/app/routes/architecture.py:35-37` advertises "Web Push / browser push", "Object storage (snake photos)", and "Maps/routing provider" — none are implemented. Snake photos are deliberately not persisted (`backend/app/routes/wound.py:45-47`; `imageB64` column is always NULL).

**[Wound image persistence]:**
- Problem: `WoundReading.imageB64` exists in the schema (`backend/app/database.py:173`) but is always stored as `NULL` (`backend/app/routes/wound.py:52`); there is no way to review the source photo later, and the trend chart (`GET /api/wound/{id}/trend`) has no image.
- Blocks: Clinical review / re-analysis workflows.

## Test Coverage Gaps

**[Frontend — zero tests]:**
- What's not tested: The entire new frontend (`frontend/app/`, `frontend/components/`); the 16 vitest tests that existed in `frontend/src/lib/__tests__/` were deleted.
- Files: `frontend/app/page.tsx`, `frontend/components/nagraksha/*.tsx`
- Risk: Workspace role switching, demo SOS state, and any future API wiring have no regression net; CI's `npx vitest run` fails outright (no config).
- Priority: High

**[Backend routes with no coverage]:**
- What's not tested: `wound.py` (submit/trend/packet), `transcribe.py` (both endpoints), `snake_id.py` (vision + text matcher), `audit.py` (ASHA village/household), `stakeholders.py`, `myth_buster.py`, `stats.py`, `architecture.py`, `ops.py` knowledge-base, `ws.py` WebSocket, `scheduler.py`, `auth.py` (token minting, 403/401 enforcement, `AUTH_ENFORCED` behavior), rate limiting, and the `llm.py` fallback chain.
- Files: `backend/app/routes/wound.py`, `backend/app/routes/transcribe.py`, `backend/app/routes/snake_id.py`, `backend/app/routes/audit.py`, `backend/app/routes/stakeholders.py`, `backend/app/routes/myth_buster.py`, `backend/app/routes/stats.py`, `backend/app/auth.py`, `backend/app/llm.py`
- Risk: The most safety-critical paths (wound severity, snake identification, auth) are the least tested.
- Priority: High

**[Integration/E2E — none]:**
- What's not tested: The SOS → outbox → dispatch → WebSocket → frontend flow end-to-end; Twilio webhook against the real state machine; ChromaDB seeding path (tests only exercise the TF-IDF fallback, `backend/tests/test_rag.py:4-18`).
- Files: `backend/app/eventbus.py`, `backend/app/dispatch.py`, `backend/app/rag.py`
- Risk: The headline feature (parallel dispatch) is only covered via the simulated/unit path.
- Priority: Medium

---

*Concerns audit: 2026-08-14*
