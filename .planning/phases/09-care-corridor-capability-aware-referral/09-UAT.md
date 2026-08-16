---
phase: 09-care-corridor-capability-aware-referral
status: in_progress
started_at: "2026-08-16T08:15:00.000Z"
total_tests: 4
passed_tests: 0
failed_tests: 0
---

# Phase 09: Care Corridor & Capability-Aware Referral Upgrade — User Acceptance Testing (UAT)

## Test 1: Capability Gap Detection & Recommendation Engine
- **Target**: `POST /api/incidents/{id}/evaluate-referral`
- **Action**: Test patient presenting at Malavalli PHC with progressive neurotoxic ptosis (50% aperture reduction).
- **Expected Outcome**: Capability gap engine detects lack of `VENTILATION` and `ICU` at PHC level, flags urgency as `CRITICAL_IMMEDIATE`, and ranks Mandya District Hospital (4 ventilators, 42 ASV vials) as the top recommended facility.
- **Status**: [PENDING]

## Test 2: Guarded Referral Lifecycle State Transitions
- **Target**: `POST /api/incidents/{id}/referrals` + `PATCH /api/referrals/{id}/accept|transport|arrive`
- **Action**: Create referral from Malavalli PHC to Mandya DH, verify state machine progresses linearly (`PENDING` $\rightarrow$ `ACCEPTED` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `ARRIVED`), and verify out-of-order transitions return HTTP 409 Conflict.
- **Expected Outcome**: Each transition updates atomic outbox table, emits WebSocket notification, and preserves guarded database state.
- **Status**: [PENDING]

## Test 3: Care Corridor 8-Stage Visual Progression Timeline
- **Target**: `frontend/components/care-corridor-timeline.tsx` mounted at `/incidents/[id]`
- **Action**: Render incident `NR-1042` with 8 stages on desktop and mobile viewports.
- **Expected Outcome**: All 8 stages render vertically with correct status badges (Completed, In Progress, Pending), telemetry details (ptosis % reduction, missing capabilities), and clear visual hierarchy.
- **Status**: [PENDING]

## Test 4: Receiving Hospital Console & One-Tap Acceptance
- **Target**: `/incidents/[id]?role=hospital`
- **Action**: View incoming referral as receiving hospital CMO (`role=hospital`), tap "✓ Accept & Reserve Ventilator / Bed".
- **Expected Outcome**: Button triggers `/api/referrals/{id}/accept`, reserves equipment, transitions status to `ACCEPTED`, and updates timeline stage 6 to completed.
- **Status**: [PENDING]
