# Codebase Concerns

**Analysis Date:** 2026-08-15

## Tech Debt

**Stale Prisma scripts in root `package.json`:**
- Issue: `db:push` / `db:generate` scripts run `prisma db push` / `prisma generate` inside `frontend/`, but Prisma no longer exists anywhere in the repo — no `frontend/prisma/` directory, no `prisma` dependency in either `package.json`
- Why: Remnants of the older Node/Prisma prototype; the backend now owns the schema in raw SQLite (`backend/app/database.py`)
- Impact: `npm run db:push` fails with a misleading error; newcomers may assume Prisma is the DB layer
- Fix approach: Delete both scripts from root `package.json` (backend schema is the single source of truth)

**Repo-root `nag-raksha.zip`:**
- Issue: Untracked 2026-08-14 zip bundle at the repo root containing an old frontend layout (`app/`, `globals.css`, `layout.tsx`, …)
- Why: Packaging artifact left during the `frontend/src/` → root migration
- Impact: Confusing — looks like a deployable artifact, ~easily mistaken for current source; adds repo noise
- Fix approach: Delete it, or add `*.zip` / `nag-raksha.zip` to `.gitignore` if it's a required deliverable

**Package-manager inconsistency:**
- Issue: `README.md` claims "we use bun-lock but npm works too"; `setup.py` runs `npm install` in `frontend/`; but the frontend actually uses **pnpm** (`pnpm-lock.yaml`, Dockerfile + CI via corepack) and the repo root uses npm (`package-lock.json`)
- Why: The toolchain evolved (npm → pnpm) without updating all docs/scripts
- Impact: `python setup.py` may install with npm while CI pins pnpm; lockfile drift between `pnpm-lock.yaml` and any generated `package-lock.json` in `frontend/`
- Fix approach: Standardize on pnpm everywhere; update `setup.py` and `README.md`; add a root `packageManager` field

**`.gitignore` bare `test` entry:**
- Issue: Root `.gitignore` line 50 is a bare `test` (no leading slash), which ignores **any** file or directory named `test` at any depth
- Why: Intent was likely to ignore a root-level scratch dir; `frontend/test/` files are tracked only because they were force-added
- Impact: New files added to `frontend/test/` (e.g. more MSW handlers) will be silently ignored by plain `git add` — CI drift risk
- Fix approach: Change to `/test` (root-only) or remove and rely on `*.log`/explicit entries

**Frontend package name is a template leftover:**
- Issue: `frontend/package.json` `"name": "my-project"`
- Why: Never renamed from the Next.js scaffold
- Impact: Cosmetic, but shows up in tooling output and could confuse dependency reports
- Fix approach: Rename to `nagraksha-frontend`

**Demo-first security posture:**
- Issue: `JWT_SECRET`, role secrets, and Twilio placeholders in `.env.example` are demo values; tokens stored in `localStorage`
- Why: Deliberate demo choices (see `backend/app/auth.py` docstring) with a production guard
- Impact: Acceptable for demo; `ENV=production` guard is opt-in (only fails when explicitly set)
- Fix approach: Keep as-is but document that `AUTH_ENFORCED=true` / real secrets are required for any real deployment

## Known Bugs

**WS-driven incident refresh skipped on deep links:**
- Symptoms: Visiting `/incidents/{id}` directly (without triggering SOS first) still loads the incident, but post-WS-event refetches don't fire — `updateFromWsEvent` only refreshes when `get().incidentId` is set, and `setIncident` never populates `incidentId`
- Trigger: Open `/incidents/{id}` in a new tab, then have a dispatch event arrive over WebSocket
- Workaround: The page's own fetch + the WS lane merge still update visible lanes; only the consistency refetch is skipped
- Root cause: `frontend/store/sos-store.ts` — `setIncident` sets `incident`/`dispatchLanes` but not `incidentId`; `updateFromWsEvent` gates the refetch on `incidentId`
- Fix: Have `setIncident` (or the incident page) also set `incidentId`

**SSE endpoint exists but is unused by the frontend:**
- Symptoms: `/api/incidents/{id}/stream` (SSE) still implemented and returned as `streamUrl` in the SOS response, but the client only uses WebSocket (`frontend/lib/realtime.ts`)
- Trigger: Any SOS response advertises `streamUrl`; the endpoint stays alive serving nothing
- Workaround: None needed — WS is preferred
- Root cause: Deliberate backward-compat retention (`backend/app/routes/incidents.py` docstring: "kept for backward compat; WebSocket preferred")
- Fix: Remove the SSE route + `streamUrl` field, or keep and document as deprecated

## Security Considerations

**JWT stored in `localStorage`:**
- Risk: XSS can exfiltrate tokens (no httpOnly cookie protection)
- File: `frontend/hooks/use-auth.ts` (`nagraksha_token`, `nagraksha_role`)
- Current mitigation: Frontend bans `console`, CSP is not configured; demo scope only
- Recommendations: Move to httpOnly cookies for any production deployment; add CSP headers

**Twilio webhook signature validation is conditional:**
- Risk: If `TWILIO_ACCOUNT_SID` is set but `TWILIO_AUTH_TOKEN` is missing/empty, `POST /webhook/twilio` skips signature validation — a spoofed sender could accept/decline dispatches
- File: `backend/app/routes/twilio_webhook.py` (validation gated on `if token:`)
- Current mitigation: Both SID and token are normally set together from `.env`/compose
- Recommendations: Gate on SID **and** token; fail closed (reject) when credentials are incomplete

**Demo role secrets committed as defaults:**
- Risk: Default `victim-demo` / `hospital-demo` / `admin-demo` secrets ship in `.env.example`
- File: `.env.example`, `backend/app/auth.py` (`_DEMO_ROLE_SECRETS`)
- Current mitigation: `ENV=production` raises at import for demo values; token endpoint rate-limited (10/min)
- Recommendations: Fine for demo; ensure production deployment sets `ENV=production`

**SOS endpoint relies on default rate limit only:**
- Risk: `POST /api/sos` uses the global `200/minute` default; only the token endpoint has a tighter `10/minute` limit
- File: `backend/app/main.py`, `backend/app/routes/sos.py`
- Current mitigation: Global limiter active
- Recommendations: Add a per-IP limit to `/api/sos` (spam = SMS spend)

## Performance Bottlenecks

**ChromaDB cold start:**
- Problem: First RAG query initializes `DefaultEmbeddingFunction` (ONNX runtime, ~40MB) and loads the persistent collection
- File: `backend/app/rag.py` (`_get_collection`)
- Measurement: Lazy-loaded; adds seconds to the first query after restart (no per-request impact afterward)
- Cause: ONNX model load + collection open
- Improvement path: Pre-warm in the lifespan (alongside `ensure_kb_seeded()`)

**Compliance scoring job runs at startup + every 15 min:**
- Problem: `run_compliance_job()` executes immediately on startup and then on an interval; it queries per hospital (`MAX(verifiedAt)`, 30-day counts)
- File: `backend/app/scheduler.py`, `backend/app/compliance.py`
- Measurement: Bounded by hospital count; fine at current scale (single-digit hospitals), O(hospitals) queries each run
- Cause: Per-hospital queries with no bulk aggregation
- Improvement path: Single grouped query for all hospitals

**Outbox worker bounded at 4 threads:**
- Problem: `ThreadPoolExecutor(max_workers=4)`; a slow Twilio call or simulated accept delay occupies a worker
- File: `backend/app/eventbus.py`
- Measurement: Mitigated by design (comment: one slow incident no longer blocks the queue)
- Cause: Thread pool sizing
- Improvement path: Raise pool size or add per-lane timeouts on Twilio calls

## Fragile Areas

**WS payload → client mapping (`sos-store.ts`):**
- File: `frontend/store/sos-store.ts` (`updateFromWsEvent`)
- Why fragile: Manually maps backend WS fields (`attemptId`, `candidateName`, `candidateRole`, …) onto the client `DispatchAttempt` shape — a contract between `backend/app/routes/ws.py`/`dispatch.py` and the store. This exact contract mismatch caused the SOS bug fixed in commit `b3d5777`
- Common failures: Field renames on either side silently produce empty lanes or dropped updates
- Safe modification: Keep the mapping next to a test; add a frontend unit test for `updateFromWsEvent`
- Test coverage: None for `sos-store.ts` or `frontend/lib/realtime.ts`

**Backend test mocking of background workers:**
- File: `backend/tests/conftest.py`
- Why fragile: Patches `start_worker` and `ensure_kb_seeded` by dotted path across 4 modules; any new route calling `start_worker` directly (not via the patched modules) would start real worker threads in tests
- Common failures: Flaky/parallel tests if a module is missed
- Safe modification: Patch at the definition site (`app.eventbus.start_worker`) — already done for sos/incidents/main — and audit new route modules
- Test coverage: Existing 61 tests pass; new routes need the same treatment

**Twilio dispatch dual-mode:**
- File: `backend/app/dispatch.py`
- Why fragile: Same code path branches on credential presence (real SMS vs `simulate_dispatch()`); the SMS message templates and the simulation must stay in sync
- Common failures: Real SMS goes out in demo if credentials are set unexpectedly; template drift between modes
- Safe modification: Keep the branch at the top (lazy client), assert one mode in tests
- Test coverage: No direct tests for `dispatch.py` (exercise via `test_routes.py` SOS flow with mocks)

## Scaling Limits

**SQLite single-writer:**
- Current capacity: WAL mode allows concurrent readers + one writer; fine for demo/single-host
- Limit: Concurrent write contention under multi-incident burst
- Symptoms at limit: `database is locked` errors during heavy dispatch fan-out
- Scaling path: Move to Postgres; the schema is simple enough to migrate

**In-process WebSocket registry:**
- Current capacity: `_connections` dict in `backend/app/routes/ws.py` is process-local
- Limit: Multiple backend replicas won't share connections (WS events lost for clients on other replicas)
- Symptoms at limit: Missing live updates under multi-replica deploy
- Scaling path: External pub/sub (Redis) + sticky sessions, or a dedicated realtime service

## Dependencies at Risk

**@base-ui/react 1.x:**
- Risk: Relatively new Base UI (Radix successor); API churn between minors
- Impact: `frontend/components/ui/button.tsx` and any future primitives
- Migration plan: Pin exact version; upgrade deliberately with visual QA

**Next.js 16.3.0 / React 19 / Tailwind 4:**
- Risk: Very new major versions; ecosystem plugins may lag
- Impact: Build tooling, `tw-animate-css` integration
- Migration plan: Stay current via Renovate-style updates; CI build gate (`ignoreBuildErrors: false`) catches breakage

**llama-cpp-python (optional):**
- Risk: Compiles native code; not in `requirements.txt` by design
- Impact: Local GGUF mode silently unavailable (falls back to cloud or retrieval-only)
- Migration plan: Documented in `backend/requirements.txt`; fine as-is

## Missing Critical Features

**No E2E tests:**
- Problem: SOS → dispatch → ACCEPT flow is only tested via unit/integration layers
- Current workaround: Manual demo walkthrough
- Blocks: Confident regression testing of the realtime loop
- Implementation complexity: Medium (Playwright + MSW or live backend)

**No deployment pipeline:**
- Problem: CI stops at build; no deploy workflow in `.github/workflows/`
- Current workaround: Manual Docker Compose
- Blocks: Shipping to a real host
- Implementation complexity: Low-Medium (compose-based deploy or Vercel + fly.io)

## Test Coverage Gaps

**Frontend realtime + store:**
- What's not tested: `frontend/lib/realtime.ts` (WS client, reconnect, ping) and `frontend/store/sos-store.ts` (`updateFromWsEvent` mapping — the code that had the contract bug)
- Risk: WS regressions ship silently; contract drift recurs
- Priority: High
- Difficulty to test: Medium (mock `WebSocket` / use MSW `ws` handler)

**Backend webhook + auth:**
- What's not tested: `backend/app/routes/twilio_webhook.py` (signature validation, ACCEPT/DECLINE) and `backend/app/auth.py` (token issuance, production guard)
- Risk: SMS reply handling and auth guards break unnoticed
- Priority: Medium
- Difficulty to test: Medium (form posts via ASGITransport; `ENV=production` needs env patching)

**Frontend components:**
- What's not tested: All components (`frontend/components/`, `frontend/app/*/page.tsx`)
- Risk: UI regressions in role workspaces and incident tracking
- Priority: Medium
- Difficulty to test: Medium (React Testing Library not yet installed)

---

*Concerns audit: 2026-08-15*
*Update as issues are fixed or new ones discovered*
