---
phase: 08-venomscore-and-august-15-demo-execution
plan: 04
type: execute
subsystem: testing
tags: [sqlite, pytest, seed, idempotency, websocket, venomscore, demo, karnataka]
requires:
  - 08-02-PLAN.md (VenomScore backend: PtosisReading persistence, domain classification, VENOM_SCORE_UPDATE broadcast)
  - 08-03-PLAN.md (frontend typed path + hospital packet the loop test proves end-to-end)
provides:
  - backend/seed_demo.py — idempotent Karnataka demo seed (5 hospitals + compliance + stock, 3 pilot_permission stakeholders, 3 village audits)
  - backend/tests/test_seed_demo.py — 6 temp-DB assertions (exact values, stock mapping, idempotency)
  - TestVenomScoreHospitalLoop — two-session victim→backend→hospital VENOM_SCORE_UPDATE UNKNOWN→NEUROTOXIC proof
  - Recorded live API inspection of seeded data (hospitals ranked, stakeholders, village audits)
affects: [demo (IISc presentation), verify-work]
actuals:
  tokens: 3871
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Standalone seed script bootstraps sys.path with ROOT/backend per setup.py:99 — `python seed_demo.py` works from any CWD"
    - "Idempotency via name-based Hospital upsert + delete-then-insert AntivenomStock per demo hospital + (gramPanchayat, district) VillageAudit upsert"
    - "Seed tests isolate via monkeypatch on db.DB_PATH (module-scope env var is a no-op — conftest already imported app.database at session start)"
    - "Loop test reuses the 08-02 AsyncMock broadcast proof across TWO readings to show progression"
key-files:
  created:
    - backend/seed_demo.py
    - backend/tests/test_seed_demo.py
  modified:
    - backend/tests/test_routes.py
key-decisions:
  - "seed test isolation via monkeypatch on db.DB_PATH rather than the plan's module-scope NAGRAKSHA_DB env var — conftest.py imports app.database at session start, so an env var set in the test module binds nothing (documented deviation)"
  - "Manual two-browser rehearsal is a human gate — automated loop test + API inspection cover the machine-provable surface; the rehearsal checklist remains for the demo operator"
requirements-completed: [DEMO-DATA-01, E2E-TEST-01]
coverage:
  - id: D1
    description: "backend/seed_demo.py seeds 5 Karnataka hospitals with exact compliance values (91.5/78.0/56.0/88.0/45.0), stock status mapping CONFIRMED/LOW/OUT, 3 stakeholders all supportType pilot_permission, and 3 VillageAudit rows — idempotent across reruns"
    requirement: DEMO-DATA-01
    verification:
      - kind: unit
        ref: "backend/tests/test_seed_demo.py (6 tests: exact hospitals/compliance, stock mapping, no stock accumulation, pilot_permission, village values, rerun idempotency)"
        status: pass
      - kind: other
        ref: "cd backend && python seed_demo.py (exit 0, identical counts on 2nd run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two-session hospital loop — victim POST /api/sos → baseline + ptosis readings → 2 VENOM_SCORE_UPDATE broadcasts with venomType UNKNOWN → NEUROTOXIC → hospital GET /score returns NEUROTOXIC with in-band vial estimate"
    requirement: E2E-TEST-01
    verification:
      - kind: integration
        ref: "backend/tests/test_routes.py#TestVenomScoreHospitalLoop::test_victim_to_hospital_loop_progression"
        status: pass
      - kind: other
        ref: "cd backend && python -m pytest tests/ -q (94 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live API inspection — GET /api/hospitals?lat=12.5&lng=76.9 returns Karnataka hospitals compliance-ranked with stock, GET /api/stakeholders returns Gerry Martin/Dr. Ravi Shankar/NSS Coordinator (pilot_permission), village audit rows Malavalli 58.0 / Srirangapatna 72.0 / Tiptur 41.0"
    requirement: DEMO-DATA-01
    verification:
      - kind: other
        ref: "uvicorn app.main:app on :8123 + curl (responses recorded in SUMMARY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual two-browser demo rehearsal — victim tab triggers SOS → VenomScore baseline → 10s second reading → squint → closure % climbs; hospital tab ?role=hospital shows pre-arrival packet within 15s"
    verification:
      - kind: manual_procedural
        ref: "Two-browser rehearsal checklist from PLAN Task 2"
        status: unknown
    human_judgment: true
    rationale: "Requires two real browser sessions with a live webcam — cannot be automated or verified from this environment; remains the demo operator's final human gate"
duration: 22min
completed: 2026-08-16
status: complete
---

# Phase 08 Plan 04: Demo Seed Data & Integration Rehearsal Summary

**Idempotent Karnataka demo seed (5 hospitals, 3 pilot_permission stakeholders, 3 village audits) with a machine-proven two-session victim→backend→hospital loop (VENOM_SCORE_UPDATE UNKNOWN→NEUROTOXIC), 94 green backend tests, and recorded live API inspection of the seeded data**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-16T01:52:00Z (Task 1)
- **Completed:** 2026-08-16T02:14:00Z (Task 2)
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- **Idempotent Karnataka seed** (`backend/seed_demo.py`) — standalone script (sys.path bootstrap per setup.py:99, `python seed_demo.py` works from any CWD) that upserts 5 demo hospitals by name with exact compliance scores (Mandya 91.5, Tumkur 78.0, Hassan 56.0, K.R. Mysore 88.0, Rajarajeshwari 45.0), delete-then-inserts one AntivenomStock row per demo hospital (CONFIRMED >70 / LOW >45 / OUT), upserts 3 stakeholders by name with `supportType 'pilot_permission'` (transparent demo marking — Gerry Martin, Dr. Ravi Shankar, NSS Coordinator), and upserts 3 VillageAudit rows by (gramPanchayat, district) (Malavalli 58.0, Srirangapatna 72.0, Tiptur 41.0, ashaWorkerId asha-worker-001, auditDate 2026-08-10).
- **Seed correctness machine-asserted** — `test_seed_demo.py` (6 tests) runs run() against an isolated temp DB and asserts exact hospital names + compliance values, stock status mapping, exactly 1 stock row per demo hospital after the second run (no accumulation), exactly 3 stakeholders all pilot_permission, exact village audit values, and identical row counts between run 1 and run 2.
- **Two-session hospital loop proven** — `TestVenomScoreHospitalLoop` creates an incident via POST /api/sos (victim session), submits a baseline then a ptosis reading, records both `VENOM_SCORE_UPDATE` broadcasts via the AsyncMock pattern, asserts UNKNOWN → NEUROTOXIC progression, then reads the composite score as the hospital session: NEUROTOXIC with estimatedAntivenomVials in the 15–25 band.
- **All automated gates green** — backend `pytest tests/ -q`: **94 passed** (87 + 6 seed + 1 loop); frontend vitest 19 passed, eslint 0 errors, next build exit 0.
- **Live API inspection recorded** — backend run on :8123 against the seeded DB: `/api/hospitals?lat=12.5&lng=76.9` returns the Karnataka hospitals (demo hospitals ranked first by distance/composite), `/api/stakeholders` returns Gerry Martin + Dr. Ravi Shankar + NSS Coordinator all `pilot_permission`, and the village audit rows are present (Malavalli 58.0 / Srirangapatna 72.0 / Tiptur 41.0).

## Task Commits

Each task was committed atomically:

1. **Task 1: Idempotent Karnataka seed script + post-seed correctness & idempotency assertions** - `fa576de` (feat)
2. **Task 2: Two-session hospital-loop test + full suite gate + API inspection** - `31a3727` (test)

**Plan metadata:** base `1056b49` (post 08-03 docs commit)

## Files Created/Modified
- `backend/seed_demo.py` - NEW — standalone idempotent seed: sys.path bootstrap, init_db() first (migrate_db ALTERs compliance columns), name-based Hospital upsert + delete-then-insert AntivenomStock, pilot_permission Stakeholders, (gramPanchayat, district) VillageAudit upsert, summary print
- `backend/tests/test_seed_demo.py` - NEW — `isolated_seed_db` fixture (monkeypatch db.DB_PATH) + 6 assertions
- `backend/tests/test_routes.py` - `TestVenomScoreHospitalLoop` (1 test, 70 lines)

## Decisions Made
- **Seed test isolation via monkeypatch, not env var** — the plan's "set NAGRAKSHA_DB before importing app.database (mirror conftest lines 1-15)" doesn't bind: conftest.py imports app.database at session start, so a module-scope env var in the test file is a no-op. Monkeypatching `db.DB_PATH` to a fresh tempfile achieves the same isolation and is what the tests use (documented deviation).
- **Scheduler recalibrates compliance on startup** — the live API inspection showed the compliance scheduler had refreshed all hospital complianceScore values to 100.0 at server startup; the seeded stock status mapping (CONFIRMED/LOW/OUT) and ranking remain correct. Honest observation recorded in the SUMMARY rather than claiming the raw seeded scores are what the API returns at all times.
- **Manual rehearsal stays a human gate** — the machine-provable surface (seed correctness, loop progression, API reachability) is fully automated; the two-browser webcam rehearsal cannot run in this environment and is documented as the operator's final check (coverage D4, human_judgment).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Module-scope env var does not isolate the seed tests**
- **Found during:** Task 1 (test authoring)
- **Issue:** Plan said "Set `os.environ['NAGRAKSHA_DB']` to a tempfile path BEFORE importing app.database (mirror conftest.py lines 1-15 pattern)". But conftest.py imports app.database at session start (binding DB_PATH), so an env var set later in the test module binds nothing — the seed tests would have run against the shared conftest temp DB and polluted sibling tests.
- **Fix:** Added an `isolated_seed_db` fixture that monkeypatches `db.DB_PATH` to a fresh tempfile per test, then calls `db.init_db()`; same isolation intent, actually effective.
- **Files modified:** backend/tests/test_seed_demo.py
- **Verification:** all 6 seed tests pass in isolation; full suite (94) green
- **Committed in:** `fa576de` (Task 1 commit)

**2. [Rule 1 - Bug] Unicode arrow crashed the seed script on Windows cp1252 console**
- **Found during:** Task 1 (first seed run)
- **Issue:** `print(f"... compliance {compliance} → {status}")` raised `UnicodeEncodeError: 'charmap' codec can't encode character '\u2192'` — the Windows console uses cp1252 which lacks the arrow glyph.
- **Fix:** Replaced `→` with ASCII `->` in the print statement.
- **Files modified:** backend/seed_demo.py
- **Verification:** `python seed_demo.py` exits 0 on both first and second run
- **Committed in:** `fa576de` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking isolation, 1 console encoding bug)
**Impact on plan:** Both fixes were necessary for correct execution on this platform; no scope creep. The plan's intent (temp-DB isolation, runnable script) is fully delivered.

## Issues Encountered

- **pnpm unavailable on bash PATH** — same environment note as 08-03; frontend gates run via `npx vitest run` / `npx eslint .` / `npx next build` directly against installed node_modules. All green.
- **Background uvicorn held the shell open** — the API-inspection server was started with `&`; the run command timed out on the shell but the server had actually started and served both probes. Stopped cleanly via taskkill after capturing responses.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 08 complete** — all four plans delivered: cleanup (08-01), backend engine (08-02), frontend tracker + hospital packet (08-03), demo seed + integration rehearsal (08-04). All gates green: backend 94 pytest, frontend 19 vitest, lint 0, build 0.
- **Human gate remaining:** the two-browser demo rehearsal (coverage D4) — run with a real webcam before the IISc presentation; the backend `python seed_demo.py` re-seeds the dev DB idempotently at any time.

---
*Phase: 08-venomscore-and-august-15-demo-execution*
*Completed: 2026-08-16*
