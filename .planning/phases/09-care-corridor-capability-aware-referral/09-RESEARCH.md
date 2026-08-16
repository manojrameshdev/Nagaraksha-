# Phase 09: Care Corridor & Capability-Aware Referral Upgrade — Research Report

**Phase:** 09-care-corridor-capability-aware-referral  
**Date:** 2026-08-16  
**Status:** Complete  
**Reference Design:** [docs/CARE_CORRIDOR_PLAN.md](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/CARE_CORRIDOR_PLAN.md)  
**Authoritative Clinical Sources:** WHO Guidelines for the Management of Snakebites (2016), India National Action Plan for Prevention and Control of Snakebite Envenoming (NAPSE, 2024), NCDC Standard Treatment Guidelines for Management of Snake Bite (MoHFW).

---

## 1. Executive Summary

Phase 09 pivots NagRaksha’s product center of gravity from a single-hop dispatch system into a **closed-loop clinical Care Corridor**. In rural India, snakebite mortalities are overwhelmingly caused by **uncoordinated secondary referrals**: victims reach a Primary Health Centre (PHC) that has ASV vials but zero mechanical ventilation; when neurotoxic paralysis sets in, hasty transport without receiving-facility readiness results in asphyxiation in transit.

The Care Corridor coordinates the complete chain:
$$\text{Incident} \longrightarrow \text{Observation} \longrightarrow \text{Capability Gap} \longrightarrow \text{Capable Facility Referral} \longrightarrow \text{Receiving Acceptance} \longrightarrow \text{Ambulance Transit} \longrightarrow \text{Arrival}$$

This research report details the technical architecture, clinical decision rules, data models, state transitions, API boundaries, and frontend patterns needed to execute this upgrade quickly and safely without breaking existing features.

---

## 2. Standard Stack

| Layer | Technology | Role in Phase 9 |
|---|---|---|
| **Database** | SQLite 3 (WAL mode) | Pure SQL migrations for `Hospital` capability columns and new `Referral` table. No ORM overhead. |
| **Backend Framework** | FastAPI 0.115+ (Python 3.11) | REST endpoints for referral evaluation, creation, acceptance, and corridor timeline. |
| **Validation** | Pydantic v2 | Strict request/response schemas for capability queries, referral payloads, and corridor events. |
| **Asynchronous Events** | Transactional Outbox + Background Worker | Guaranteed event persistence in `OutboxEvent` and `AuditEvent` tables before WebSocket emission. |
| **Realtime** | Starlette WebSocket + SSE Fallback | Real-time event broadcasting (`REFERRAL_CREATED`, `REFERRAL_ACCEPTED`, `TRANSPORT_STARTED`, `PATIENT_ARRIVED`). |
| **Frontend Framework** | Next.js 16 (React 19, TypeScript 5.7) | App Router page `/incidents/[id]` and hospital console `/incidents/[id]?role=hospital`. |
| **State Management** | Zustand 5.0 | Reactive incident state holding `activeReferral`, `corridorTimeline`, and WS event handlers. |
| **UI Components** | Tailwind CSS v4 + Lucide Icons + shadcn/ui | Clean, accessible, responsive `CareCorridorTimeline` vertical status progression component. |
| **Testing** | Pytest (Backend) + Vitest / MSW (Frontend) | Pure domain tests, route integration tests, and frontend mock service worker tests. |

---

## 3. Architecture Patterns

### Pattern 1: Pure Domain Clinical Decision Engine (`backend/app/domain.py`)
All clinical capability-gap evaluations are structured as **pure, deterministic functions** with zero database I/O, network calls, or LLM randomness:
```
(current_facility_capabilities, clinical_observations) -> CapabilityGapResult
```
This isolates clinical safety logic, enabling fast unit testing and eliminating hallucination risks.

### Pattern 2: Capability-Filtered Multi-Factor Ranking
Extends the existing 40/30/30 hospital ranking (Distance / Freshness / Compliance) with a strict boolean capability filter:
$$\text{Candidate Hospitals} \xrightarrow{\text{Filter: Has All Missing Capabilities}} \text{Eligible Hospitals} \xrightarrow{\text{Rank by Composite Score}} \text{Recommended Destination}$$

### Pattern 3: Transactional Outbox Event Dispatch (`backend/app/eventbus.py`)
State transitions (e.g. `ACCEPT_REFERRAL`) write both the `Referral` update and an `OutboxEvent` inside the same database transaction. The background worker processes outbox events and broadcasts them over the active WebSocket connections.

### Pattern 4: Dual-Role View (`frontend/app/incidents/[id]/page.tsx`)
The incident view inspects the `?role=hospital` query parameter:
- **Victim / Responder View (`role=victim`):** Displays SOS status, dispatch lanes, live VenomScore trend, and the Care Corridor referral status.
- **Receiving Hospital View (`role=hospital`):** Displays incoming Care Corridor referral alerts, patient telemetry packet, and one-tap **ACCEPT & RESERVE VENTILATOR** / **RE-ROUTE** buttons.

---

## 4. Don't Hand-Roll

| Problem | Established Solution | Why NOT to Hand-Roll |
|---|---|---|
| **Facility Routing** | Straight-line + Road factor (`road_km` / `haversine_km`) | No need to build or host a custom OSRM routing server for the hackathon demo. Pre-existing road ETA math is fast and reliable. |
| **Referral Decisions** | Deterministic Python rule engine | Never delegate referral safety decisions to an LLM prompt. LLM output is non-deterministic and unverifiable. |
| **Realtime Sync** | Existing WebSocket manager (`routes/ws.py`) | Reuse the established WebSocket connection. Do not add Socket.io or third-party cloud brokers. |
| **State Storage** | Existing SQLite WAL connection manager | Do not migrate to PostgreSQL or MongoDB. Raw SQLite handles single-node transactions cleanly and fast. |
| **UI Components** | Tailwind CSS + Lucide + shadcn | Do not introduce a second UI framework (Material UI, AntD, etc.). |

---

## 5. Common Pitfalls & Prevention Strategies

### 1. Concurrent Referral Acceptance / Race Conditions
*Risk:* Two doctors or responders accepting or declining the same referral simultaneously.  
*Mitigation:* Use atomic SQL updates: `UPDATE Referral SET status='ACCEPTED', acceptedAt=? WHERE id=? AND status='PENDING'`. Check `cursor.rowcount == 1`.

### 2. WebSocket Reconnect Loops
*Risk:* Client drops connection and rapidly reconnects, spamming the server and resetting store state.  
*Mitigation:* `useIncidentSocket` hook contains exponential backoff reconnect logic and dedupes messages using `incidentId`.

### 3. Stale Antivenom & Capability Records
*Risk:* Routing a critical patient to a hospital whose ventilator was decommissioned or whose ASV expired.  
*Mitigation:* The ranking algorithm penalizes hospitals whose stock or capability verification timestamp is $>2$ hours old via `stock_freshness()`.

### 4. Client-Side Timezone Mismatches
*Risk:* Inconsistent timestamps when rendering referral elapsed times.  
*Mitigation:* All backend timestamps are strictly ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SS.fffZ`) via `db.now_iso()`.

---

## 6. Clinical Decision Rules & Guideline Traceability

Every rule in the capability evaluator traces directly to published Indian and global guidelines:

| Clinical Condition | Guideline Citation | Trigger Criteria | Required Capabilities |
|---|---|---|---|
| **Impending Respiratory Paralysis** | NAPSE STG Sec 4.2 / WHO Sec 7.2 | VenomScore eyelid ptosis $>40\%$ or severe bulbar palsy | `VENTILATION`, `ICU`, `ASV`, `EMERGENCY_CARE` |
| **Severe Hemotoxic Coagulopathy** | WHO Snakebite Guidelines Sec 7.4 | Persistent uncoagulable blood (20WBCT unclotted) or spontaneous systemic bleeding | `BLOOD_BANK`, `ICU`, `ASV`, `EMERGENCY_CARE` |
| **Acute Kidney Injury (AKI)** | NAPSE STG Sec 5.1 | Oliguria / anuria post Russell's Viper bite | `DIALYSIS`, `ICU`, `ASV`, `EMERGENCY_CARE` |
| **Routine / Local Envenomation** | NCDC Guidelines Sec 3.1 | Mild swelling, normal coagulation, no ptosis | `ASV`, `EMERGENCY_CARE` |

---

## 7. Concrete Code Examples

### A. Database Schema Migration (`backend/app/database.py`)
```sql
-- Safe SQLite migration helper
ALTER TABLE Hospital ADD COLUMN facilityLevel TEXT DEFAULT 'PHC';
ALTER TABLE Hospital ADD COLUMN capabilities TEXT DEFAULT 'ASV,EMERGENCY_CARE';
ALTER TABLE Hospital ADD COLUMN ventilatorCount INTEGER DEFAULT 0;
ALTER TABLE Hospital ADD COLUMN icuBedsAvailable INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS Referral (
    id TEXT PRIMARY KEY,
    incidentId TEXT NOT NULL,
    fromHospitalId TEXT NOT NULL,
    toHospitalId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    urgency TEXT NOT NULL DEFAULT 'HIGH',
    missingCapabilities TEXT NOT NULL,
    clinicalReason TEXT NOT NULL,
    acceptedAt TEXT,
    acceptedBy TEXT,
    declinedAt TEXT,
    declinedReason TEXT,
    transportStartedAt TEXT,
    arrivedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE,
    FOREIGN KEY (fromHospitalId) REFERENCES Hospital(id),
    FOREIGN KEY (toHospitalId) REFERENCES Hospital(id)
);
CREATE INDEX IF NOT EXISTS idx_referral_incident ON Referral(incidentId);
CREATE INDEX IF NOT EXISTS idx_referral_to_hosp ON Referral(toHospitalId, status);
```

### B. Pure Clinical Capability-Gap Evaluator (`backend/app/domain.py`)
```python
def evaluate_capability_gap(
    current_facility_level: str,
    current_capabilities: list[str],
    venom_type: str,
    ptosis_severity: str,
    swelling_progression: str,
    systemic_signs: list[str] | None = None,
) -> dict:
    systemic_signs = systemic_signs or []
    required = ["EMERGENCY_CARE", "ASV"]
    reasons = []

    if venom_type == "NEUROTOXIC" and ptosis_severity in ["MODERATE", "SEVERE"]:
        required.extend(["VENTILATION", "ICU"])
        reasons.append("Progressive neurotoxic envenomation (eyelid ptosis >40%) threatens respiratory arrest; invasive mechanical ventilation is required (NAPSE STG Sec 4.2).")

    if "BLEEDING" in systemic_signs or swelling_progression == "RAPID_PROXIMAL":
        required.extend(["BLOOD_BANK", "ICU"])
        reasons.append("Rapidly progressing hemotoxic swelling / spontaneous systemic bleeding requires blood product standby (WHO Guidelines Sec 7.4).")

    if "OLIGURIA" in systemic_signs:
        required.extend(["DIALYSIS", "ICU"])
        reasons.append("Suspected Acute Kidney Injury (AKI) requires hemodialysis capability.")

    req_set = list(set(required))
    missing = [c for c in req_set if c not in current_capabilities]
    referral_required = len(missing) > 0

    return {
        "referral_required": referral_required,
        "required_capabilities": req_set,
        "missing_capabilities": missing,
        "clinical_reasons": reasons,
        "urgency": "CRITICAL_IMMEDIATE" if "VENTILATION" in missing else "HIGH_PRIORITY" if referral_required else "ROUTINE",
        "guideline_ref": "WHO Snakebite Guidelines (2016) / NCDC NAPSE (2024)",
    }
```

### C. Referral Endpoints (`backend/app/routes/referrals.py`)
```python
@router.post("/api/incidents/{inc_id}/referrals")
def create_referral(inc_id: str, body: ReferralCreateRequest):
    with db.get_conn() as conn:
        ref_id = db.new_id()
        now = db.now_iso()
        conn.execute(
            "INSERT INTO Referral (id, incidentId, fromHospitalId, toHospitalId, status, urgency, missingCapabilities, clinicalReason, createdAt, updatedAt) "
            "VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)",
            (ref_id, inc_id, body.fromHospitalId, body.toHospitalId, body.urgency, json.dumps(body.missingCapabilities), body.clinicalReason, now, now)
        )
    broadcast_sync(inc_id, "REFERRAL_CREATED", {"referralId": ref_id, "toHospitalId": body.toHospitalId, "urgency": body.urgency})
    return {"referralId": ref_id, "status": "PENDING"}
```

---

## 8. Verification Strategy

1. **Backend Pytest Test Suite (`tests/test_domain.py`, `tests/test_routes.py`, `tests/test_seed_demo.py`):**
   - Capability-gap pure domain unit tests covering all 4 clinical condition permutations.
   - Route lifecycle tests verifying `create -> accept -> transport -> arrive` status progression.
   - Seed validation tests asserting Karnataka PHC, CHC, and DH capabilities.
2. **Frontend Vitest Test Suite (`components/__tests__/care-corridor-timeline.test.tsx`):**
   - MSW API mock tests verifying stage progression on the incident page.
   - Hospital role console action verification (`acceptReferral` mutation).
3. **Continuous Execution Verification:**
   - `python -m pytest tests/ -q` (all green, 110+ tests)
   - `npx vitest run` (all green, 20+ tests)
   - `pnpm run lint` & `pnpm run build` (zero errors/warnings)

---

## 9. Conclusion & Execution Readiness

This research confirms the feasibility and safety of the Phase 9 Care Corridor upgrade. The domain rules are grounded in authoritative guidelines, database schema extensions are backwards-compatible with raw SQLite, and the frontend components integrate smoothly with Next.js 16 App Router and Zustand.

The phase is fully planned and ready for **continuous single-pass execution**.
