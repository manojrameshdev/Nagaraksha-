---
phase: 08-venomscore-and-august-15-demo-execution
plan: 02
type: execute
subsystem: backend
tags: [fastapi, sqlite, pydantic, websocket, venomscore, ptosis, antivenom]
requires:
  - 08-01-PLAN.md (shared slowapi limiter, demo-clean root, WS store fix)
provides:
  - PtosisReading table + idx_ptosis_incident in SCHEMA (CREATE TABLE IF NOT EXISTS, no migrate_db change)
  - PtosisReadingRequest Pydantic model (aperture bounds ge=0.0 le=1.0, severity pattern)
  - Four pure domain functions: classify_venom_type, compute_dry_bite_probability, estimate_antivenom_vials, compute_venom_score
  - venom_score.py router: POST reading / GET score / GET readings (auth-gated, 404-safe, broadcast VENOM_SCORE_UPDATE)
  - seeded_incident fixture; TestVenomScore (route + domain) suites
affects: [08-03 (TS types mirror flat VenomScoreResult), verify-work, demo]
actuals:
  tokens: 6647
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Dual-key tolerance: domain reads accept camelCase canonical with snake_case fallback (percentChange|percent_change, ptosisDetected|ptosis_detected), emit camelCase"
    - "snake_case wire body -> camelCase DB columns -> camelCase response/WS payload (one canonical contract pinned in PLAN.md)"
    - "AsyncMock broadcast proof: httpx ASGI cannot observe WS pushes, so the route test monkeypatches app.routes.venom_score.broadcast with an async fake recording (event, payload)"
key-files:
  created:
    - backend/app/routes/venom_score.py
  modified:
    - backend/app/database.py
    - backend/app/models.py
    - backend/app/domain.py
    - backend/app/main.py
    - backend/tests/conftest.py
    - backend/tests/test_routes.py
    - backend/tests/test_domain.py
key-decisions:
  - "PtosisReading created via CREATE TABLE IF NOT EXISTS inside SCHEMA (init_db executescript) — covers new and existing DBs; migrate_db untouched (ALTER-only helper, documented decision)"
  - "minutes_since_bite computed as round(db.days_since(biteTime) * 1440) — db.mins_since does not exist (verified HIGH review finding); never referenced anywhere in backend/app"
  - "Broadcast awaited inside the async route via ws.broadcast (broadcast_sync reserved for the worker thread)"
  - "GET endpoints were written in the Task 1 file creation (single new-file write); Task 2 commit carries the edge-case tests that prove them"
requirements-completed: [VENOMSCORE-BE-01, VENOMSCORE-BE-02, VENOMSCORE-BE-03]
coverage:
  - id: VS1
    description: "PtosisReading table with camelCase columns + FK CASCADE + index; no migrate_db change"
    requirement: VENOMSCORE-BE-01
    verification:
      - kind: other
        ref: "grep -c 'CREATE TABLE IF NOT EXISTS PtosisReading' backend/app/database.py == 1; block contains rightAperture, percentChange, ptosisDetected, ON DELETE CASCADE, idx_ptosis_incident"
        status: pass
      - kind: other
        ref: "cd backend && python -m pytest tests/ -q (87 passed)"
        status: pass
    human_judgment: false
  - id: VS2
    description: "POST /api/venom-score/{id}/reading persists snake_case->camelCase, computes score, awaits broadcast VENOM_SCORE_UPDATE (proven by AsyncMock route test)"
    requirement: VENOMSCORE-BE-02
    verification:
      - kind: unit
        ref: "backend/tests/test_routes.py#TestVenomScore::test_posting_reading_broadcasts"
        status: pass
      - kind: unit
        ref: "backend/tests/test_routes.py#TestVenomScore::test_submit_baseline_reading"
        status: pass
    human_judgment: false
  - id: VS3
    description: "Domain classification with 4-value uppercase vocab, dual-key reads, advisory disclaimer outputs; all branches unit-tested"
    requirement: VENOMSCORE-BE-03
    verification:
      - kind: unit
        ref: "backend/tests/test_domain.py#TestVenomScore (17 tests)"
        status: pass
      - kind: other
        ref: "grep gates: no mins_since in backend/app; uppercase vocab present in domain.py"
        status: pass
    human_judgment: false
duration: 28min
completed: 2026-08-15
status: complete
---

# Phase 08 Plan 02: VenomScore Backend Engine Summary

**Ptosis readings now persist → score → broadcast end-to-end (VENOM_SCORE_UPDATE proven by AsyncMock test), with pure domain classification across the full NEUROTOXIC/HEMOTOXIC/DRY_BITE/UNKNOWN vocabulary, auth-gated GET surfaces, and 87 green backend tests**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-15T23:22:27Z
- **Completed:** 2026-08-15T23:50:00Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- **PtosisReading storage** — 13-column camelCase table (`rightAperture`, `percentChange`, `ptosisDetected`, `minutesSinceBite`, `createdAt`…) with `FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE` and `idx_ptosis_incident`, appended to `SCHEMA`. `CREATE TABLE IF NOT EXISTS` inside `init_db`'s executescript covers fresh and existing DBs — `migrate_db` intentionally untouched (documented review-MEDIUM disposition).
- **Request contract** — `PtosisReadingRequest` validates all three apertures with `Field(..., ge=0.0, le=1.0)` (free 422s before any DB write — T-08-02-04 DoS mitigation) and `severity` against `^(none|mild|moderate|severe)$`.
- **Pure clinical domain** (`domain.py`, no DB/I/O) — `classify_venom_type` returns the full uppercase 4-value union with `DRY_BITE` reachable (no signs, ≥ 45 min); `compute_dry_bite_probability` (wound-growth rate logic + time curve capped 0.95); `estimate_antivenom_vials` branches on all four values (DRY_BITE → 0 vials high confidence; UNKNOWN → conservative 10 low) and every result carries the `"Confirm with 20-minute whole blood clotting test before finalizing dose"` disclaimer; `compute_venom_score` emits the flat pinned `VenomScoreResult` shape with weighted severity, `criticalAlert`/`ventilatorRequired`, counts, and dual-key ptosis reads.
- **Routes** — `venom_score.py` mirrors wound.py: `require_role_if_enforced("victim","hospital_admin","system_admin")` declared on all three endpoints (T-08-02-01), 404 on unknown incidents, `await broadcast(incident_id, "VENOM_SCORE_UPDATE", {"venomScore": score})` after persist (T-08-02-02), `minutes_since_bite = round(db.days_since(biteTime) * 1440)` (never the nonexistent helper). Registered in main.py's "New in v2" block with no prefix.
- **Tests** — `seeded_incident` fixture (direct DB insert, no `asyncio.get_event_loop`); `TestVenomScore` routes (2 task-1 + 6 edge: 404×3, 422, NEUROTOXIC progression, ordering) and 17 domain tests. Full suite: **87 passed** (63 pre-existing + 24 new).

## Task Commits

Each task was committed atomically:

1. **Task 1: Ptosis reading POST path end-to-end (tracer)** - `9e7c60a` (feat)
2. **Task 2: GET endpoints with auth + 404 + edge-case route tests** - `bbe5f30` (feat)
3. **Task 3: TestVenomScore domain unit tests** - `c235772` (test)

**Plan metadata:** base `292591f` (post 08-01 docs commit)

## Files Created/Modified
- `backend/app/routes/venom_score.py` - NEW — `router`, `submit_ptosis_reading`, `get_venom_score`, `get_ptosis_readings`, `_score_rows`, `_minutes_since_bite` helper
- `backend/app/database.py` - `CREATE TABLE IF NOT EXISTS PtosisReading` (13 cols) + `idx_ptosis_incident` after the WoundReading block
- `backend/app/models.py` - `PtosisReadingRequest` (aperture bounds, severity pattern, optional percent_change / minutes_since_bite ≥ 0)
- `backend/app/domain.py` - four pure functions + `_DISCLAIMER` + `_du` dual-key helper
- `backend/app/main.py` - `venom_score` import in `.routes` block; `app.include_router(venom_score.router)` in "New in v2" (no prefix)
- `backend/tests/conftest.py` - `seeded_incident` fixture (INSERT Incident → yield → DELETE)
- `backend/tests/test_routes.py` - `_BASELINE_BODY` + `TestVenomScore` (8 tests)
- `backend/tests/test_domain.py` - 4 function imports + `TestVenomScore` (17 tests)

## Decisions Made
- **No migrate_db change** — `CREATE TABLE IF NOT EXISTS` inside `init_db`'s executescript covers new and existing DBs; `migrate_db` only handles ALTER columns (review MEDIUM disposition honored).
- **GET endpoints shipped in the Task 1 file write** — the new router file was authored complete (POST + both GETs) in Task 1; Task 2's atomic commit carries the six edge-case tests that prove the GETs. No behavior was changed between commits; only test coverage accrued.
- **Broadcast awaited inline** — `await broadcast(...)` inside the async route (wound.py analog); `broadcast_sync` remains reserved for the outbox worker thread.
- **`_minutes_since_bite` helper** — `round(db.days_since(inc["biteTime"]) * 1440)` with 0 fallback when `biteTime` absent; the docstring deliberately avoids the string `mins_since` so the plan's `grep -rn "mins_since" backend/app/` gate stays clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docstring tripped the plan's `mins_since` grep gate**
- **Found during:** Task 1 verification
- **Issue:** My first `_minutes_since_bite` docstring read "db.mins_since does not exist" — the plan's Verification gate `grep -rn "mins_since" backend/app/` must return *nothing*, and the literal docstring would have failed it.
- **Fix:** Reworded the docstring to "no db helper exists — days_since * 1440" (same intent, gate-clean).
- **Files modified:** backend/app/routes/venom_score.py
- **Verification:** grep gate clean; full suite green
- **Committed in:** `9e7c60a` (Task 1 commit)

**2. [Rule 3 - Blocking] C: drive at 0 bytes free — pytest temp DB creation fails**
- **Found during:** pre-task baseline run
- **Issue:** `Get-PSDrive C` reports 0 free bytes (392 GB used); `tempfile.mkstemp` + SQLite WAL on the system temp dir fail with `sqlite3.OperationalError: database or disk is full`, and a 10 MB probe write to the repo failed with "There is not enough space on the disk". Small (< ~10 KB) writes still succeed, so all plan edits committed fine.
- **Fix:** Redirected `TEMP`/`TMP` to `D:\opencode-tmp` (28.7 GB free) for every pytest invocation; all suite runs use the venv interpreter at `backend/.venv\Scripts\python.exe`.
- **Files modified:** none (environment adaptation only)
- **Verification:** full suite 87 passed under redirected TEMP
- **Committed in:** n/a (verification-only)

**3. [Rule 3 - Blocking] PowerShell `git commit -F - -m` flag conflict**
- **Found during:** Task 1 commit
- **Issue:** First attempt used `git commit -F - -m msg` which git rejects (`options '-m' and '-F' cannot be used together`); PowerShell's `-m` with embedded newlines also mangles parentheses/paths.
- **Fix:** Wrote each commit message to a temp file with `[System.IO.File]::WriteAllText` (no BOM) and committed with `git commit -F <file>` — same pattern 08-01 adopted.
- **Files modified:** none (tooling)
- **Committed in:** n/a (commit mechanism only)

---

**Total deviations:** 3 auto-fixed (1 grep-gate bug, 1 environment disk-full, 1 commit tooling)
**Impact on plan:** All are verification/tooling adaptations; no scope creep, no functional behavior changed. All must_haves truths satisfied.

## Issues Encountered
- **C: disk full** (environment, see deviation 2) — pre-existing condition discovered at baseline; the phase repo, .venv, node_modules all live on C:. Worth freeing space before the Aug 15 demo (chroma_db, pnpm/pip caches, and 2.8 GB of temp files are candidates; nothing deleted by this plan).
- **lint-staged no-op on Python commits** — pre-commit hook (`npx lint-staged`) reports "could not find any staged files matching configured tasks" for Python-only commits; hook passes and commits land normally (it only matches TS/JSON/MD globs).

## User Setup Required

None - all endpoints are auth-gated but off-by-default (AUTH_ENFORCED), so the token-less demo flow keeps working.

## Next Phase Readiness
- Success criterion #2 of the phase is met: backend stores/computes `PtosisReading`, runs pure domain classification, and broadcasts `VENOM_SCORE_UPDATE` — machine-proven.
- 08-03 can mirror the flat `VenomScoreResult` shape in TypeScript with confidence (contract pinned in PLAN.md supersedes any PATTERNS/RESEARCH divergence).
- 87 backend tests green; no deferred items. `.gsd/` remains untracked (pre-existing, out of scope).

---
*Phase: 08-venomscore-and-august-15-demo-execution*
*Completed: 2026-08-15*

## Self-Check: PASSED
- Created files verified: `backend/app/routes/venom_score.py`, `08-02-SUMMARY.md`
- Commits verified: `9e7c60a`, `bbe5f30`, `c235772`
- Full suite: `cd backend && python -m pytest tests/ -q` → 87 passed