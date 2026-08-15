---
phase: 08-venomscore-and-august-15-demo-execution
verified: 2026-08-16T02:30:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 1
behavior_unverified_items:
  - truth: "On-device MediaPipe Face Landmarker tracks normalized eyelid aperture with a personal baseline; hospital tab shows a live pre-arrival packet within 15s of a second reading"
    test: "Two browsers: tab A (victim) opens /incidents/{id}, Start VenomScore, waits for baseline, squints at 10s+; tab B (hospital) opens /incidents/{id}?role=hospital and watches the packet update. Run backend (uvicorn app.main:app) + frontend (next dev) with a working webcam."
    expected: "Calibrating… → tracking; closure % climbs and severity changes on squint; hospital packet appears within 15s with updated vials."
    why_human: "Requires two live browser sessions, camera permission, and a real webcam — cannot be automated in this environment. The machine-provable surface (backend loop, typed frontend path, MSW-mocked component tests) is fully automated."
---

# Phase 08: VenomScore & August 15 Demo Execution — Verification Report

**Phase Goal:** Implement real-time neurotoxic envenomation detection via MediaPipe eyelid ptosis tracking (VenomScore), pre-hospital antivenom estimation, live hospital broadcast, cleanup items, deep link bug fix, and Karnataka demo seed data for the IISc presentation.
**Verified:** 2026-08-16T02:30:00Z
**Status:** passed

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Repository cleanup: `nag-raksha.zip` removed, Prisma scripts pruned, `setup.py` uses `pnpm`, `.gitignore` fixed, package name `nagraksha-frontend`, `sos-store.ts` deep link bug fixed (`incidentId: incident.id`), SOS rate limiting active | ✓ VERIFIED | `nag-raksha.zip` absent; `frontend/package.json` name = `nagraksha-frontend`; `setup.py` references pnpm (8 hits); `sos-store.ts:64` sets `incidentId: incident.id` in `setIncident`; `backend/app/routes/sos.py:17` carries `@limiter.limit("10/minute")`; `TestRateLimit` (structural + behavioral 429) passes |
| 2 | Backend stores and computes `PtosisReading` records, runs pure domain classification (`classify_venom_type`, `compute_dry_bite_probability`, `estimate_antivenom_vials`, `compute_venom_score`), and broadcasts `VENOM_SCORE_UPDATE` via WebSocket | ✓ VERIFIED | `backend/app/database.py` `CREATE TABLE IF NOT EXISTS PtosisReading` (13 cols, FK CASCADE, idx); `backend/app/domain.py` 4 pure functions with uppercase 4-value vocabulary; `backend/app/routes/venom_score.py` POST/GET endpoints broadcast `await broadcast(incident_id, "VENOM_SCORE_UPDATE", {"venomScore": score})` — proven by AsyncMock route tests + `TestVenomScoreHospitalLoop` |
| 3 | Frontend runs MediaPipe Face Landmarker on-device to track normalized eyelid aperture (landmarks 159/145/386/374), computes personal baseline and percentage closure, visualizes trend in `VenomScoreChart`, and displays live pre-arrival packets in hospital view | ✓ VERIFIED | `frontend/components/venom-score.tsx` `const LM = { RU: 159, RL: 145, LU: 386, LL: 374 }`, baseline + `<0.01` blink guard, 10s interval, single-flight snake_case submits, status machine; `venom-score-chart.tsx` ReferenceLine y=40/y=70; `app/incidents/[id]/page.tsx` `next/dynamic` ssr:false mount + `role === 'hospital'` packet reading store `venomScore`; 4 MSW-mocked component tests pass |
| 4 | Demo seed dataset in `backend/seed_demo.py` populates real Karnataka hospitals, compliance scores, antivenom inventory, stakeholders (Gerry Martin, etc.), and ASHA village risk records | ✓ VERIFIED | `backend/seed_demo.py` exits 0, idempotent (identical counts on 2nd run); 5 hospitals (Mandya 91.5 / Tumkur 78.0 / Hassan 56.0 / K.R. Mysore 88.0 / Rajarajeshwari 45.0), stock CONFIRMED/LOW/OUT, 3 `pilot_permission` stakeholders, 3 VillageAudit rows (Malavalli 58.0 / Srirangapatna 72.0 / Tiptur 41.0); 6 temp-DB tests pass; live API inspection confirmed reachable via /api/hospitals, /api/stakeholders |
| 5 | All backend pytest suites pass, all frontend vitest tests pass, and `pnpm run build` / `pnpm run lint` pass with 0 errors | ✓ VERIFIED | `cd backend && python -m pytest tests/ -q` → **94 passed**; `cd frontend && npx vitest run` → **19 passed**; `npx eslint .` → 0 errors; `npx next build` → exit 0 (8 routes) |

**Score:** 5/5 success criteria verified (1 behavior-unverified item remains — live two-browser webcam loop; see Human Verification)

### Required Artifacts (PLAN must_haves + key_links)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/routes/venom_score.py` | POST reading / GET score / GET readings, auth-gated, 404-safe, broadcast | ✓ EXISTS + SUBSTANTIVE | `_ROLE_DEP`, 404 checks, `await broadcast` after persist |
| `backend/app/database.py` | PtosisReading table, no migrate_db change | ✓ EXISTS + SUBSTANTIVE | `CREATE TABLE IF NOT EXISTS` in SCHEMA (08-02 decision) |
| `backend/app/domain.py` | 4 pure functions, uppercase vocab | ✓ EXISTS + SUBSTANTIVE | `NEUROTOXIC\|HEMOTOXIC\|DRY_BITE\|UNKNOWN`, disclaimer constant |
| `frontend/components/venom-score.tsx` | MediaPipe tracker | ✓ EXISTS + SUBSTANTIVE | LM 159/145/386/374, baselineRef, capture, cleanup |
| `frontend/components/venom-score-chart.tsx` | Recharts trend chart | ✓ EXISTS + SUBSTANTIVE | ReferenceLine y={40} + y={70}, null < 2 points |
| `frontend/lib/realtime.ts` | Open union + `'VENOM_SCORE_UPDATE'` | ✓ EXISTS + SUBSTANTIVE | union + store branch agree (grep: 1 each) |
| `frontend/lib/nagraksha.ts` | PtosisReading/VenomScoreResult/SubmitPtosisResponse + helpers | ✓ EXISTS + SUBSTANTIVE | snake_case body mapping, flat contract |
| `frontend/store/sos-store.ts` | ptosisReadings/venomScore + actions + WS branch | ✓ EXISTS + SUBSTANTIVE | `else if (event === 'VENOM_SCORE_UPDATE')` sets venomScore |
| `frontend/app/incidents/[id]/page.tsx` | role state + victim mount + hospital packet | ✓ EXISTS + SUBSTANTIVE | `next/dynamic` ssr:false, `role === 'hospital'` packet |
| `frontend/test/handlers.ts` | 2 venom MSW handlers | ✓ EXISTS + SUBSTANTIVE | POST reading + GET score |
| `frontend/components/__tests__/venom-score.test.tsx` | ≥3 mocked component tests | ✓ EXISTS + PASSING | 4 tests: baseline, 10s second, cleanup, camera-denied |
| `backend/seed_demo.py` | Idempotent Karnataka seed | ✓ EXISTS + SUBSTANTIVE | run() idempotent; summary print |
| `backend/tests/test_seed_demo.py` | Post-seed correctness + idempotency | ✓ EXISTS + PASSING | 6 tests |
| `backend/tests/test_routes.py` | TestVenomScoreHospitalLoop | ✓ EXISTS + PASSING | 2 VENOM_SCORE_UPDATE, UNKNOWN→NEUROTOXIC |

**Artifacts:** 14/14 verified

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `realtime.ts` union | `sos-store.ts` WS branch | both contain `'VENOM_SCORE_UPDATE'` | ✓ AGREED |
| `submitPtosisReading` snake_case body | `PtosisReadingRequest` Pydantic (right_aperture, left_aperture, avg_aperture, baseline_aperture, percent_change, ptosis_detected, severity, asymmetric, minutes_since_bite) | 08-02 route tests + 08-03 helper | ✓ AGREED |
| `VenomScoreChart` ReferenceLines | domain severity thresholds (40% ptosis / 70% severe) | chart y=40/y=70; domain ptosisDetected>40, severe>70 | ✓ AGREED |
| backend broadcast `VENOM_SCORE_UPDATE` | store venomScore → hospital packet | loop test + store test | ✓ AGREED |
| `seed_demo.py` upserts | `seed.py` name-based upsert pattern + migrate_db compliance ALTERs | init_db() first, name/key upserts | ✓ AGREED |

**Wiring:** 5/5 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| VENOMSCORE-BE-01 (PtosisReading storage) | ✓ SATISFIED | Table + FK + index; test-asserted |
| VENOMSCORE-BE-02 (POST/GET endpoints + broadcast) | ✓ SATISFIED | AsyncMock broadcast proof + edge tests |
| VENOMSCORE-BE-03 (domain classification) | ✓ SATISFIED | 17 domain tests, 4-value vocab |
| VENOMSCORE-FE-01 (typed data path) | ✓ SATISFIED | Union, store, helpers, MSW, unit tests |
| VENOMSCORE-FE-02 (tracker + chart) | ✓ SATISFIED | Component + 4 mocked tests |
| VENOMSCORE-FE-03 (hospital packet) | ✓ SATISFIED | Role-gated packet + dynamic mount |
| DEMO-DATA-01 (Karnataka seed) | ✓ SATISFIED | 6 seed tests + live API inspection |
| E2E-TEST-01 (loop + suites) | ✓ SATISFIED | Loop test + 94 backend / 19 frontend green |

**Coverage:** 8/8 requirements satisfied, 0 blocked, 0 behavior-unverified (the one behavior-unverified item is the demo rehearsal, not a requirement)
**Note:** VENOMSCORE-BE/FE/DEMO-DATA/E2E-TEST IDs are phase-local (no matching section exists in `REQUIREMENTS.md` — same situation as Phase 7 FEAT ids). Traceability is carried in SUMMARY `requirements-completed` frontmatter; tooling cannot register them until a section exists. Non-blocking.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/seed_demo.py | — | Real person names in seed data | ℹ️ Info | Mitigated by mandatory `supportType 'pilot_permission'` on every stakeholder (T-08-04-01); documented plan decision |

**Anti-patterns:** 1 found (0 blockers, 1 info — mitigated)

## Human Verification Required

### 1. Two-browser VenomScore demo rehearsal (browser + webcam)
**Test:** Backend running + `next dev`. Tab A (victim): trigger SOS → /incidents/{id} → Start VenomScore → wait for baseline → wait 10s for second reading → squint. Tab B (hospital): /incidents/{id}?role=hospital.
**Expected:** Calibrating… → tracking; closure % climbs and severity changes; hospital pre-arrival packet appears within 15s with updated vials.
**Why human:** Requires two live sessions, camera permission, and a real webcam — cannot be automated here. All machine-provable layers (backend loop test, typed frontend path, mocked component tests, API inspection) pass.

## Gaps Summary

**No critical gaps remain.**

### Closed Gaps

1. **G1 — 08-03 committed without SUMMARY.md (safe_resume_gate)** ✅ CLOSED
   - Situation: Plan 08-03's 3 commits existed (typed data path, MediaPipe component, incident integration) but no SUMMARY.md — an illegal partial-plan state per the atomic close-out invariant.
   - Action: Verified every acceptance gate on disk (19 vitest, eslint 0, next build 0, all grep gates), wrote 08-03-SUMMARY.md, updated STATE/ROADMAP. No re-dispatch — the committed work was complete.
2. **G2 — Module-scope env var cannot isolate seed tests** ✅ CLOSED
   - Situation: Plan 08-04 said set NAGRAKSHA_DB before importing app.database; conftest imports it at session start, so a test-module env var binds nothing.
   - Action: `isolated_seed_db` fixture monkeypatches `db.DB_PATH` to a tempfile. All 6 seed tests pass; full suite 94 green.
3. **G3 — Unicode arrow crashed seed script on cp1252 console** ✅ CLOSED
   - Situation: `→` in a print raised UnicodeEncodeError on Windows.
   - Action: Replaced with ASCII `->`. Script exits 0 on repeated runs.

### Non-Critical Gaps (Can Defer)

1. **Phase-local requirement IDs not registered in REQUIREMENTS.md**
   - Issue: VENOMSCORE-BE/FE/DEMO-DATA/E2E-TEST ids appear only in plan frontmatter; `requirements.mark-complete` returns not_found.
   - Impact: Tooling cannot update the traceability table (same as Phase 7 FEAT ids).
   - Recommendation: Register a Phase 8 requirement section in REQUIREMENTS.md if desired; non-blocking for the demo.

## Verification Metadata

**Verification approach:** Goal-backward (derived from ROADMAP success criteria)
**Must-haves source:** ROADMAP.md Phase 8 Success Criteria + PLAN.md frontmatter must_haves/key_links
**Automated checks:** backend pytest 94/94 ✓, frontend vitest 19/19 ✓, `npx eslint .` exit 0 ✓, `npx next build` exit 0 ✓, seed idempotency ✓, loop test ✓, artifact existence 14/14 ✓, wiring 5/5 ✓, live API inspection ✓ (uvicorn :8123)
**Human checks required:** 1 (two-browser webcam rehearsal; code paths wired + machine-proven)
**Total verification time:** ~20 min

---
*Verified: 2026-08-16T02:30:00Z*
*Verifier: Buffy (inline, no subagent API available on this runtime)*
