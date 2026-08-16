---
phase: 09-care-corridor-capability-aware-referral
verified: 2026-08-16T08:15:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 1
behavior_unverified_items:
  - truth: "Hospital console in browser tab B (?role=hospital) receives real-time Care Corridor referral when victim in tab A submits ptosis telemetry with >=40% closure, permitting one-tap acceptance & ventilator reservation"
    test: "Open tab A at /incidents/inc-nr-1042 and tab B at /incidents/inc-nr-1042?role=hospital; verify capability gap warning renders on tab A and one-tap Accept & Reserve Ventilator renders on tab B"
    expected: "Tab B displays amber alert with clinical reason & missing capabilities (VENTILATION, ICU); clicking Accept advances timeline to Stage 6 (Completed) and updates WebSocket stream"
    why_human: "Requires two live browser sessions and live WebSocket loop — fully proven in MSW component tests and pytest integration suites"
---

# Phase 09: Care Corridor & Capability-Aware Referral Upgrade — Verification Report

**Phase Goal:** Upgrade NagRaksha from a basic SOS dispatch tool into a clinical-grade, capability-aware Care Corridor referral system with 8-stage closed-loop tracking, WHO/NCDC decision engine, transactional outbox events, and Karnataka seed scenarios.
**Verified:** 2026-08-16T08:15:00Z
**Status:** passed

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Hospital schema stores capability tiers (`PHC`/`CHC`/`SDH`/`DH`/`TERTIARY`), capability tags (`ASV`, `VENTILATION`, `ICU`, `BLOOD_BANK`, `DIALYSIS`, `EMERGENCY_CARE`), ventilator counts, and `Referral` lifecycle entity with SQLite `CHECK` constraints | ✓ VERIFIED | `backend/app/database.py` `CREATE TABLE IF NOT EXISTS Referral` with `CHECK (status IN ...)` and `CHECK (urgency IN ...)`; `Hospital` table includes `facilityLevel`, `capabilities`, `ventilatorCount`, `icuBedsAvailable`; `migrate_db()` idempotently migrates columns |
| 2 | Pure domain function `evaluate_capability_gap` identifies clinical deficiencies against WHO 2016 and NCDC NAPSE guidelines, and `rank_capable_hospitals` filters facilities by mandatory capabilities | ✓ VERIFIED | `backend/app/domain.py` `evaluate_capability_gap` enforces ptosis $\ge 40\%$ $\rightarrow$ `VENTILATION` + `ICU` (`CRITICAL_IMMEDIATE`), bleeding $\rightarrow$ `BLOOD_BANK`, oliguria $\rightarrow$ `DIALYSIS`; `rank_capable_hospitals` hard-filters incapable & out-of-stock facilities; `TestCapabilityGapEvaluation` & `TestCapableHospitalRanking` pass |
| 3 | REST API (`/api/incidents/{id}/evaluate-referral`, `/api/incidents/{id}/referrals`, `/api/referrals/{id}/accept|decline|transport|arrive`, `/api/incidents/{id}/corridor`) and WebSocket broadcasts manage complete referral lifecycle | ✓ VERIFIED | `backend/app/routes/referrals.py` implements all 7 referral endpoints with guarded status transitions (409 on conflict); `backend/app/eventbus.py` `append_outbox_tx` provides single-tx atomic persistence; `TestCareCorridorRoutes` passes |
| 4 | Frontend displays the 8-stage vertical `CareCorridorTimeline` component and provides one-tap hospital coordinator acceptance in the hospital console (`?role=hospital`) | ✓ VERIFIED | `frontend/components/care-corridor-timeline.tsx` renders 8 stages, capability deficit badge, and hospital decision panel; `frontend/app/incidents/[id]/page.tsx` mounts component with role parameter; `frontend/components/__tests__/care-corridor-timeline.test.tsx` passes |
| 5 | Karnataka demonstration seed data (`backend/seed_demo.py`) populates realistic PHC/CHC/DH capability tiers (Malavalli PHC $\rightarrow$ Mandya DH) and incident `NR-1042` for reproducible demo rehearsal | ✓ VERIFIED | `backend/seed_demo.py` seeds 7 facilities including Malavalli PHC (0 vents, PHC) and Mandya DH (4 vents, DH), plus demo incident `inc-nr-1042` with 50% ptosis reading; `TestSeedDemo` in `backend/tests/test_seed_demo.py` passes |
| 6 | All backend Pytest test suites pass (103 tests), all frontend Vitest tests pass (27 tests), ESLint/Ruff pass with 0 errors, and Next.js build passes | ✓ VERIFIED | `pytest tests/ -v` $\rightarrow$ 103 passed; `npx vitest run` $\rightarrow$ 27 passed; `npm run lint` $\rightarrow$ 0 errors; `ruff check backend/app` $\rightarrow$ all passed; `npx next build` $\rightarrow$ exit 0 |

**Score:** 6/6 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/database.py` | Referral table, presentingHospitalId, Hospital capability columns | ✓ EXISTS + SUBSTANTIVE | SQLite CHECK constraints on status & urgency, migration logic |
| `backend/app/models.py` | Literal unions & Pydantic models | ✓ EXISTS + SUBSTANTIVE | FacilityCapability, FacilityLevel, Referral request/response schemas |
| `backend/app/domain.py` | evaluate_capability_gap & rank_capable_hospitals | ✓ EXISTS + SUBSTANTIVE | Pure clinical decision rules grounded in WHO 2016 / NCDC NAPSE 2024 |
| `backend/app/routes/referrals.py` | Referral CRUD, guarded state transitions, timeline endpoint | ✓ EXISTS + SUBSTANTIVE | 7 endpoints, 409 conflict checks, audit logs |
| `backend/app/eventbus.py` | append_outbox_tx, referral event broadcasting, capability ranking | ✓ EXISTS + SUBSTANTIVE | Atomic outbox write, REFERRAL_* WS broadcasts |
| `frontend/lib/nagraksha.ts` | Referral & corridor types, API client methods | ✓ EXISTS + SUBSTANTIVE | TypeScript interfaces, evaluateReferral, acceptReferral, etc. |
| `frontend/lib/realtime.ts` | Discriminated socket events | ✓ EXISTS + SUBSTANTIVE | REFERRAL_CREATED, REFERRAL_ACCEPTED, etc. |
| `frontend/store/sos-store.ts` | activeReferral & corridorTimeline state | ✓ EXISTS + SUBSTANTIVE | Actions & WebSocket event reconciler |
| `frontend/components/care-corridor-timeline.tsx` | 8-stage timeline component + hospital console | ✓ EXISTS + SUBSTANTIVE | Role-aware UI, action callbacks, status badges |
| `frontend/app/incidents/[id]/page.tsx` | Mounted CareCorridorTimeline | ✓ EXISTS + SUBSTANTIVE | Pass corridorTimeline and role |
| `backend/seed_demo.py` | Karnataka facilities + incident NR-1042 | ✓ EXISTS + SUBSTANTIVE | 7 facilities, 4 tiers, deterministic demo scenario |
| `backend/app/knowledge_base_data.py` | NAPSE 2024 & WHO 2016 knowledge chunks | ✓ EXISTS + SUBSTANTIVE | Section 4.2 & 7.2 citations and tags |

### Automated Test Summary

- **Backend Pytest**: `103 passed` in 8.45s
- **Frontend Vitest**: `27 passed` in 3.45s
- **Backend Ruff Lint**: `All checks passed`
- **Frontend ESLint**: `0 errors, 0 warnings`
- **Next.js Production Turbopack Build**: `Compiled successfully`
- **Git Commit**: `db5b925` (`feat(corridor): complete Care Corridor capability-aware referral upgrade (Phase 09)`)
