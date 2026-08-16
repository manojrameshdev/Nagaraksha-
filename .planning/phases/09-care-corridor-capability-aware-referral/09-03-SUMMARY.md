# Phase 9: Plan 03 Summary — Backend Referral APIs & Event Outbox

## Implemented Work
1. **Atomic Transactional Outbox Pattern** (`backend/app/eventbus.py`):
   - Added `append_outbox_tx(conn, event_type, aggregate_id, payload)` for single-transaction atomic persistence alongside state table writes.
   - Updated `_worker_tick()` to broadcast referral lifecycle events (`REFERRAL_CREATED`, `REFERRAL_ACCEPTED`, `REFERRAL_DECLINED`, `TRANSPORT_STARTED`, `PATIENT_ARRIVED`) via WebSocket and in-memory event bus.
   - Enhanced `get_ranked_hospitals` to load and parse `facilityLevel`, `capabilities`, `ventilatorCount`, `icuBedsAvailable`.
2. **Referral Endpoints** (`backend/app/routes/referrals.py`):
   - `POST /api/incidents/{inc_id}/evaluate-referral`: Returns capability gap + ranked eligible destinations.
   - `POST /api/incidents/{inc_id}/referrals`: Creates referral with transactional outbox event.
   - `GET /api/incidents/{inc_id}/referrals`: Lists referrals for incident.
   - `PATCH /api/referrals/{ref_id}/accept`: Guarded transition from `PENDING` -> `ACCEPTED` (409 on conflict).
   - `PATCH /api/referrals/{ref_id}/decline`: Guarded transition from `PENDING` -> `DECLINED`.
   - `PATCH /api/referrals/{ref_id}/transport`: Guarded transition from `ACCEPTED` -> `IN_TRANSIT`.
   - `PATCH /api/referrals/{ref_id}/arrive`: Guarded transition from `IN_TRANSIT` -> `ARRIVED`.
   - `GET /api/incidents/{inc_id}/corridor`: Returns unified 8-stage closed-loop Care Corridor timeline.
3. **Capability Endpoints** (`backend/app/routes/hospitals.py`):
   - `GET /api/hospitals/{hid}/capabilities`
   - `PATCH /api/hospitals/{hid}/capabilities`

## Verification
- Route integration tests in `backend/tests/test_routes.py` covering full referral state lifecycle passed.
