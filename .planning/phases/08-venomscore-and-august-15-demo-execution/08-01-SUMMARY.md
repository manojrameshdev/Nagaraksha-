---
phase: 08-venomscore-and-august-15-demo-execution
plan: 01
subsystem: api
tags: [fastapi, slowapi, rate-limit, zustand, websocket, pnpm, prisma, setup.py]
requires: []
provides:
  - Shared slowapi Limiter in backend/app/limiter.py (circular-import fix enabling per-route rate limits)
  - Rate-limited POST /api/sos (10/minute per-IP via get_remote_address)
  - WebSocket deep-link refresh fix in frontend zustand store
  - Demo-ready repo root: no zip, no Prisma db scripts, pnpm-only setup, /test gitignore, proper package name
affects: [08-venomscore-and-august-15-demo-execution, 08-03, verify-work, demo]
actuals:
  tokens: 2165
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Shared limiter module pattern: limiter instance lives in its own module (app/limiter.py) so app entry and route modules both import it without circular imports"
    - "slowapi 0.1.9 limit registration: decorators register on limiter._route_limits keyed by module-qualified function name (not the pre-0.1.9 _rate_limits function attribute)"
key-files:
  created:
    - backend/app/limiter.py
  modified:
    - backend/app/main.py
    - backend/app/routes/sos.py
    - backend/tests/test_routes.py
    - frontend/store/sos-store.ts
    - package.json
    - setup.py
    - .gitignore
    - frontend/package.json
key-decisions:
  - "Followed revised plan: extract shared limiter to backend/app/limiter.py instead of importing from main.py (original approach provably broken by circular import)"
  - "Keep trigger_sos a sync def with request: Request first param (slowapi requirement) — body is pure sync DB calls"
  - "Structural rate-limit test adapted to installed slowapi 0.1.9 API (limiter._route_limits registry) with legacy _rate_limits fallback"
requirements-completed: [CLEANUP-01, BUGFIX-01, RATELIMIT-01]
coverage:
  - id: D1
    description: "SOS endpoint rate-limited at 10/minute per-IP with shared limiter extracted to backend/app/limiter.py (no circular import)"
    requirement: RATELIMIT-01
    verification:
      - kind: unit
        ref: "backend/tests/test_routes.py#TestRateLimit::test_trigger_sos_carries_rate_limit"
        status: pass
      - kind: unit
        ref: "backend/tests/test_routes.py#TestRateLimit::test_rate_limit_returns_429_after_threshold"
        status: pass
      - kind: other
        ref: "cd backend && python -m pytest tests/ -q (63 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deep-linked incident pages get WebSocket refresh — setIncident sets incidentId: incident.id"
    requirement: BUGFIX-01
    verification:
      - kind: other
        ref: "grep 'incidentId: incident.id' frontend/store/sos-store.ts"
        status: pass
      - kind: other
        ref: "cd frontend && npx vitest run (10 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Demo-clean repo root: no nag-raksha.zip, no db:push/db:generate scripts, pnpm-only setup.py, /test gitignore, frontend named nagraksha-frontend"
    requirement: CLEANUP-01
    verification:
      - kind: other
        ref: "grep gates (0 db scripts, pnpm only, /test, name) + py_compile + pytest 63 passed"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-08-15
status: complete
---

# Phase 08 Plan 01: Hour 0 Cleanup, Deep Link Fix & SOS Rate Limiting Summary

**SOS endpoint now provably rate-limited at 10/minute via a shared limiter module (circular-import fix), WebSocket deep-link refresh fixed, and demo-clean repo root with pnpm-only setup**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-15T16:20:00Z
- **Completed:** 2026-08-15T16:28:41Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Extracted the shared slowapi `Limiter` into `backend/app/limiter.py` and rewired `main.py` to import it — eliminating the provable circular import (main imports routes before any limiter existed) that made `@limiter.limit()` on routes impossible as written in the reference doc.
- `POST /api/sos` now carries `@limiter.limit("10/minute")` with `request: Request` in `trigger_sos` (slowapi requirement); behavioral test proves 200×3 → 429 on an isolated app without polluting shared limiter state.
- Fixed the WebSocket deep-link bug: `setIncident` now sets `incidentId: incident.id`, so `updateFromWsEvent`'s refetch fires on direct-URL incident page loads.
- Demo-ready repo root: no `nag-raksha.zip`, Prisma `db:push`/`db:generate` scripts removed from root package.json, setup.py checks pnpm and installs with pnpm, `.gitignore` testing entry scoped to `/test`, frontend named `nagraksha-frontend`.
- All suites green: backend 63 passed (61 existing + 2 new), frontend vitest 10 passed, frontend lint 0 errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared rate limiter & harden SOS endpoint (tracer)** - `98127db` (feat)
2. **Task 2: Fix WebSocket deep-link bug in sos-store** - `1acc657` (fix)
3. **Task 3: Root & frontend config cleanup** - `a69e249` (chore)

**Plan metadata:** base `a0904b8` (docs: create phase plan)

## Files Created/Modified
- `backend/app/limiter.py` - NEW — shared slowapi `Limiter(key_func=get_remote_address, default_limits=["200/minute"])`
- `backend/app/main.py` - `from .limiter import limiter`; removed inline `limiter = Limiter(...)` and unused slowapi imports; `app.state.limiter` + exception handler untouched
- `backend/app/routes/sos.py` - `@limiter.limit("10/minute")` above `@router.post("/api/sos")`; `trigger_sos(request: Request, req: SosRequest)` sync def; imports limiter from `..limiter`
- `backend/tests/test_routes.py` - added `TestRateLimit` (structural decorator proof + isolated-app 429 behavioral test)
- `frontend/store/sos-store.ts` - `setIncident` sets `incidentId: incident.id`
- `package.json` - removed `db:push` / `db:generate` scripts
- `setup.py` - pnpm prerequisite check, `["pnpm", "install"]`, pnpm wording in prints
- `.gitignore` - testing entry `test` → `/test`
- `frontend/package.json` - `name` → `nagraksha-frontend`

## Decisions Made
- **Followed the revised plan's limiter extraction** (user constraint): shared limiter lives in `backend/app/limiter.py`, NOT imported from `main.py` — the original approach is provably broken by circular import (main.py:30-34 imports sos before any limiter existed).
- **Sync def preserved**: `trigger_sos` stays sync with `request: Request` first param per slowapi requirement; body is pure sync DB calls.
- **Isolated-app behavioral test**: the 429 test builds a throwaway `FastAPI()` app with a fresh Limiter so the shared test-session limiter storage is never polluted (review suggestion incorporated).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Structural rate-limit test adapted to installed slowapi 0.1.9 API**
- **Found during:** Task 1 (TestRateLimit implementation)
- **Issue:** Plan asserted `getattr(sos.trigger_sos, "_rate_limits", [])` is non-empty — that attribute was stamped by slowapi < 0.1.9. Installed slowapi 0.1.9 registers limits on `limiter._route_limits` keyed by `"app.routes.sos.trigger_sos"` and exposes the amount via `Limit.limit.amount`. As written, the test would always pass an empty list and fail.
- **Fix:** Structural test now checks `limiter._route_limits["app.routes.sos.trigger_sos"]` first, falls back to legacy `_rate_limits`, and reads the amount from either `first.amount` or `first.limit.amount` — same intent (prove trigger_sos carries a 10/minute limit), version-tolerant.
- **Files modified:** backend/tests/test_routes.py
- **Verification:** Full backend suite passes (63), TestRateLimit shows 2 passed
- **Committed in:** `98127db` (part of Task 1 commit)

**2. [Rule 3 - Blocking] pnpm not resolvable for `pnpm run lint`**
- **Found during:** Task 2 verification
- **Issue:** `pnpm` is not on PATH locally; `corepack pnpm run lint` (pnpm 11.21) attempts an auto `pnpm install` first and fails because `pnpm` itself isn't a resolvable command in this environment. CI uses `corepack enable` which installs pnpm properly in GitHub Actions.
- **Fix:** Ran the exact script contents directly — `npx eslint .` (the `lint` script body), which exits 0 with 0 errors. Vitest run exactly as planned via `npx vitest run`.
- **Files modified:** none (environment adaptation only)
- **Verification:** `npx eslint .` exits 0; `npx vitest run` 10 passed
- **Committed in:** n/a (verification-only)

---

**Total deviations:** 2 auto-fixed (1 bug-API-drift, 1 blocking-environment)
**Impact on plan:** Both are verification/assertion adaptations; no scope creep, no functional behavior changed. All plan must_haves truths satisfied.

## Issues Encountered
- **Commit message quoting on Windows PowerShell:** the first `git commit -m` with embedded quotes/parens failed (`fatal: Invalid path '/api'`) — switched to `git commit -F <message-file>` for all task commits. Tooling issue, no code impact.
- **slowapi 0.1.9 API drift** (covered under deviations): the installed slowapi's decorator no longer stamps `_rate_limits` on functions; limits live in `limiter._route_limits`. The extracted module pattern in the plan is fully compatible — only the structural assertion needed updating.
- **Pre-existing uncommitted state:** `.planning/STATE.md` was already modified and `.gsd/` untracked before this plan ran; left untouched (not part of plan scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SOS rate limiting proven end-to-end (429 after threshold, structural decorator proof) — the demo-facing spam vector is closed.
- Deep-linked incident pages will now live-refresh over WebSocket.
- Repo root is demo-clean; setup.py installs the frontend with pnpm (matching the migrated frontend's pnpm-lock).
- Deferred: none. All suites green (backend 63, frontend vitest 10, lint 0).

---
*Phase: 08-venomscore-and-august-15-demo-execution*
*Completed: 2026-08-15*

## Self-Check: PASSED
- Created files verified: `backend/app/limiter.py`, `08-01-SUMMARY.md`
- Commits verified: `98127db`, `1acc657`, `a69e249`

## Requirement ID Note
The plan's `requirements` frontmatter lists `CLEANUP-01`, `BUGFIX-01`, `RATELIMIT-01`, but REQUIREMENTS.md's register only contains v1 milestone IDs (FORMAT/LINT/TYPES/TEST/STATIC/CI/DX). `requirements mark-complete` returned `not_found` for all three — there is no checkbox or traceability row to update. The phase's actual requirements were tracked in the roadmap (08-01–08-04 plans) instead. If Phase 8 requirements should be promoted into the register, add them to REQUIREMENTS.md in a later plan.