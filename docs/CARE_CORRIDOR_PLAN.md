# NagRaksha — Care Corridor / Capability-Aware Referral Architecture & Execution Plan

**Document Version:** 1.0.0  
**Status:** Authoritative Design & Execution Plan  
**Target Milestone:** Phase 09 — Care Corridor & Capability-Aware Referral Upgrade  
**Clinical Standards Basis:** WHO Guidelines for the Management of Snakebites (2016) & India National Action Plan for Prevention and Control of Snakebite Envenoming (NAPSE) / NCDC Standard Treatment Guidelines.

---

## 1. Executive Architecture Assessment

NagRaksha is currently structured as a resilient, modular monolith:
- **Frontend:** Next.js 16 (App Router, React 19, Tailwind CSS 4, Zustand 5, Recharts, MediaPipe on-device vision, PWA service worker).
- **Backend:** Python 3.11 FastAPI, raw SQLite 3 (WAL mode, transactional context manager), Outbox Event Bus worker, SlowAPI rate limiting, Python-Jose JWT auth.
- **AI & Integrations:** On-device MediaPipe Face Landmarker (zero server compute), ChromaDB vector RAG for clinical/myth knowledge, Google Gemini multimodal vision for wound tracking, Twilio SMS webhooks with simulated fallback.

### Current Paradigm vs. Target Paradigm
- **Current Paradigm:** `SOS -> parallel dispatch -> hospital recommendation`
- **Target Care Corridor Paradigm:**
  ```
  SOS
   +--> Incident Created
   +--> Clinical Observation (VenomScore Ptosis + Wound Swelling + Symptoms)
   +--> Current-Facility Capability Check (PHC/CHC/SDH/DH)
   +--> Capability Gap Identified (e.g., Progressive Neurotoxic -> Mechanical Ventilation Missing)
   +--> Capable-Facility Referral Recommendation (Ranked by Distance + Stock + Compliance + Capability)
   +--> Receiving-Facility Acceptance (Hospital Coordinator One-Tap Accept/Decline)
   +--> Ambulance / Transport Handoff (108 ALS/BLS In-Transit)
   +--> Patient Arrival Confirmation
   +--> Closed-Loop Care Timeline (End-to-End Auditable Trail)
  ```

**Core Product Insight:**  
> *"Getting a snakebite patient to a hospital is not necessarily getting them to the right hospital."*  
In rural India (Karnataka, Maharashtra, etc.), patients often reach a Primary Health Centre (PHC) that possesses polyvalent ASV but lacks mechanical ventilation or pediatric ICU support. When neurotoxic paralysis (eyelid ptosis, respiratory depression) advances, uncoordinated secondary referral causes fatal asphyxiation during transit. The **Care Corridor** makes this referral chain active, coordinated, capability-aware, and closed-loop before the patient is loaded into an ambulance.

---

## 2. Current-vs-Target Architecture Diagram

```
CURRENT FLOW:
[Victim SOS] --> [FastAPI /api/sos] --> [Transactional Outbox]
                        ¦                       ¦
                        ?                       ?
            [Nearest Hospital List]   [3-Lane Dispatch Fanout]
            (Distance + Stock)        (Trained, Rescuer, Ambulance)

TARGET CARE CORRIDOR FLOW:
[Victim SOS] ---------------------------+
      ¦                                 ?
      ?                       [Initial Facility Arrival]
[3-Lane Dispatch Fanout]                ¦
                                        ?
                         [Clinical Observation Stream]
                         - VenomScore (Eyelid Ptosis)
                         - Wound Swelling (cm spread)
                         - 20WBCT / Systemic Symptoms
                                        ¦
                                        ?
                         [Facility Capability Engine]
                         - Current: PHC (ASV ?, Vent ?, ICU ?)
                         - Need: Mechanical Ventilation
                         - Gap: VENTILATOR_UNAVAILABLE
                                        ¦
                                        ?
                         [Capability-Aware Referral Engine]
                         - Filters for capable District Hospitals (DH/Tertiary)
                         - Evaluates: Capability + ASV Freshness + Road ETA + Compliance
                                        ¦
                                        ?
                         [Hospital Acceptance Gate]
                         - Destination DH Hospital receives Referral Packet
                         - Doctor one-tap: ACCEPT / RE-ROUTE
                                        ¦
                                        ?
                         [Transport Handoff & Tracking]
                         - 108 ALS Ambulance dispatched for inter-facility transit
                         - Real-time pre-arrival telemetry to DH ICU
                                        ¦
                                        ?
                         [Arrival & Closed-Loop Timeline]
                         - Verified handoff & antivenom administration
```

---

## 3. Existing Functionality Reuse Map

NagRaksha already has robust foundational services. Every new Care Corridor component maps directly to existing modules:

| Care Corridor Requirement | Existing Reusable Module | Extension Strategy |
|---|---|---|
| Facility Capability Registry | `backend/app/database.py` (`Hospital` table) | Add `capabilities` JSON/TEXT column (`ASV,VENTILATION,ICU,...`) and facility level (`PHC,CHC,DH,TERTIARY`). |
| Capability-Gap Detection | `backend/app/domain.py` | Add pure deterministic function `evaluate_capability_gap(current_facility, clinical_state)`. |
| Referral Recommendation | `backend/app/domain.py` (`rank_hospitals`) | Add capability filter parameter to `rank_hospitals(origin, hospitals, required_capabilities)`. |
| Receiving Hospital Acceptance | `backend/app/routes/incidents.py` (`accept_dispatch`) & `routes/hospitals.py` | Add `POST /api/incidents/{id}/referral/accept` & `decline`. |
| Outbox & Real-Time Sync | `backend/app/eventbus.py` & `routes/ws.py` | Emit `REFERRAL_CREATED`, `REFERRAL_ACCEPTED`, `TRANSPORT_STARTED`, `PATIENT_ARRIVED` via outbox & WebSocket. |
| Pre-Arrival Hospital Packet | `backend/app/routes/wound.py` (`/packet`) & `app/incidents/[id]/page.tsx` | Extend packet with referral urgency, capability gap reason, and receiving hospital preparation checklist. |
| Audit Trail & Provenance | `backend/app/database.py` (`AuditEvent`) | Record all referral transitions with actor (`referring_clinician`, `receiving_hospital`, `ambulance`). |
| Clinical Guideline RAG | `backend/app/rag.py` & `knowledge_base_data.py` | Add NCDC/NAPSE referral criteria chunks to vector knowledge base for guideline explanation. |
| Frontend Store & Real-Time | `frontend/store/sos-store.ts` & `lib/realtime.ts` | Extend Zustand store with `referralState`, `activeCorridor`, and WS event handlers. |

---

## 4. Source & Reference Registry

### A. Authoritative Clinical Sources (Tier 1)
1. **WHO Guidelines for the Management of Snakebites (2nd Edition, 2016)**
   - *Use:* Referral criteria for neurotoxic envenomation, early antivenom indications, assisted ventilation protocols.
   - *Status:* **PRIMARY**.
2. **NCDC National Action Plan for Prevention and Control of Snakebite Envenoming (NAPSE, 2024)**
   - *Use:* Standard facility capability tiers in India (Sub-Centre, PHC, CHC, SDH, DH, Medical College).
   - *Status:* **PRIMARY**.
3. **NCDC Standard Treatment Guidelines: Management of Snake Bite (Ministry of Health & Family Welfare)**
   - *Use:* 20-minute Whole Blood Clotting Test (20WBCT), initial ASV dosing (10 vials), criteria for inter-facility referral.
   - *Status:* **PRIMARY**.

### B. Open Datasets & Government Health Infrastructure
1. **National Health Mission / HMIS (data.gov.in & MoHFW)**
   - *Use:* Realistic Karnataka district hospital and CHC mapping (Mandya, Tumkur, Hassan, Mysore).
   - *Status:* **PRIMARY (Demo Seed Data)**.
2. **Indian National Snakebite Protocol / NAPSE Facility Matrix**
   - *Use:* Standard capability codes and referral pathways.
   - *Status:* **PRIMARY**.

### C. Competitor / Reference Projects (Interoperability & Differentiation)
1. **SARPA (Kerala Forest Department)**: Focuses on snake rescue dispatch and public snake sighting alerts. NagRaksha differentiates by handling post-bite clinical triage, facility capability routing, and closed-loop hospital referral.
2. **Snakepedia / IndianSnakes**: Excellent species educational reference. NagRaksha reuses herpetological taxonomy without allowing species identification to delay emergency clinical care.
3. **Snakebite Assistant (SHE-INDIA)**: Clinical decision aid for doctors. NagRaksha coordinates inter-facility logistics, real-time hospital inventory, and ambulance handoffs.

---

## 5. Capability Model & Clinical Decision Rules

### A. Standard Facility Level Tiers
- `PHC` (Primary Health Centre): First aid, ASV stocking, 20WBCT, basic resuscitation, oxygen. No mechanical ventilators or ICU.
- `CHC` (Community Health Centre): ASV, oxygen, observation beds, basic airway management (bag-valve mask). Occasional transport ventilator.
- `SDH` (Sub-Divisional Hospital): ASV, blood storage, basic ICU, emergency surgical debridement.
- `DH` (District Hospital): ASV, comprehensive mechanical ventilation, multi-bed ICU, blood bank, dialysis, pediatric intensive care.
- `TERTIARY` (Medical College / Apex Hospital): Advanced toxicological critical care, plasmapheresis, specialized surgical reconstruction.

### B. Standard Capability Vocabulary
- `ASV`: Polyvalent Anti-Snake Venom stocked and cold-chain verified.
- `OXYGEN`: Continuous high-flow oxygen delivery.
- `VENTILATION`: Invasive mechanical ventilation (ICU ventilator with trained anesthetist/intensivist).
- `ICU`: Monitored Intensive Care Unit beds with continuous vital monitoring.
- `BLOOD_BANK`: Whole blood and fresh frozen plasma availability (for hemotoxic coagulopathy).
- `DIALYSIS`: Hemodialysis unit (for acute kidney injury secondary to Russell\'s viper / hump-nosed pit viper).
- `EMERGENCY_CARE`: 24/7 casualty medical officer and emergency resuscitation.

### C. Pure Domain Decision Matrix (`evaluate_capability_gap`)
```python
def evaluate_capability_gap(
    current_facility_level: str,
    current_capabilities: list[str],
    venom_type: str,           # NEUROTOXIC | HEMOTOXIC | DRY_BITE | UNKNOWN
    ptosis_severity: str,       # NONE | MILD | MODERATE | SEVERE
    swelling_progression: str,  # NONE | LOCAL | RAPID_PROXIMAL
    systemic_signs: list[str],  # e.g., ["BLEEDING", "OLIGURIA", "RESPIRATORY_DISTRESS"]
) -> dict:
    required_capabilities = ["EMERGENCY_CARE", "ASV"]
    reasons = []

    # Rule 1: Neurotoxic progression requires mechanical ventilation
    if venom_type == "NEUROTOXIC" and ptosis_severity in ["MODERATE", "SEVERE"]:
        required_capabilities.extend(["VENTILATION", "ICU"])
        reasons.append("Progressive neurotoxic envenomation (eyelid ptosis >40%) threatens respiratory arrest; invasive mechanical ventilation is required (NAPSE STG Sec 4.2).")

    # Rule 2: Severe hemotoxic coagulopathy / bleeding requires Blood Bank
    if "BLEEDING" in systemic_signs or swelling_progression == "RAPID_PROXIMAL":
        required_capabilities.extend(["BLOOD_BANK", "ICU"])
        reasons.append("Rapidly progressing hemotoxic swelling / spontaneous systemic bleeding requires blood product standby (WHO Guidelines Sec 7.4).")

    # Rule 3: Oliguria / Anuria requires Dialysis support
    if "OLIGURIA" in systemic_signs:
        required_capabilities.extend(["DIALYSIS", "ICU"])
        reasons.append("Suspected Acute Kidney Injury (AKI) requires hemodialysis capability.")

    # Check for missing capabilities at current facility
    missing = [c for c in required_capabilities if c not in current_capabilities]
    referral_required = len(missing) > 0

    return {
        "referral_required": referral_required,
        "required_capabilities": list(set(required_capabilities)),
        "missing_capabilities": missing,
        "clinical_reasons": reasons,
        "urgency": "CRITICAL_IMMEDIATE" if "VENTILATION" in missing else "HIGH_PRIORITY" if referral_required else "ROUTINE",
        "guideline_ref": "WHO Snakebite Guidelines (2016) / NCDC NAPSE (2024)"
    }
```

---

## 6. Care Corridor Referral State Machine

The referral lifecycle is deterministic and auditable at every step:

```
[NOT_REQUIRED]
       ¦ (Clinical observation triggers capability gap)
       ?
[REFERRAL_RECOMMENDED] --> (Clinician confirms referral destination)
       ¦
       ?
[REFERRAL_CREATED]
       ¦ (Broadcasted to Receiving Hospital via WS/Outbox)
       ?
[AWAITING_ACCEPTANCE]
       +--> [DECLINED] --> (Auto re-routes to next ranked capable facility)
       ¦
       ? (Receiving hospital coordinator taps ACCEPT)
[ACCEPTED]
       ¦ (Ambulance 108 assigned and starts wheels)
       ?
[IN_TRANSIT]
       ¦ (Pre-arrival telemetry streams to receiving ICU)
       ?
[ARRIVED]
       ¦ (Handoff verified, doctor acknowledges case)
       ?
[CLOSED_LOOP_COMPLETED]
```

### Transition & Audit Events
1. `REFERRAL_RECOMMENDED`: Emitted when `evaluate_capability_gap` detects a deficiency at the current facility.
2. `REFERRAL_INITIATED`: Clinician selects recommended target facility; creates `Referral` record.
3. `REFERRAL_ACCEPTED`: Receiving hospital confirms readiness, bed, ventilator, and ASV reservation.
4. `REFERRAL_DECLINED`: Receiving hospital declines (e.g. beds full); system immediately promotes next best candidate.
5. `TRANSPORT_STARTED`: 108 ambulance departs referring facility with patient.
6. `PATIENT_ARRIVED`: Receiving hospital scans patient/incident barcode or taps arrival confirmation.

---

## 7. Database Schema Extensions (`backend/app/database.py`)

Keep the schema minimal and backwards-compatible with raw SQLite SQL:

```sql
-- 1. Extend Hospital table with capabilities and facility level
ALTER TABLE Hospital ADD COLUMN facilityLevel TEXT DEFAULT 'PHC'; -- PHC | CHC | SDH | DH | TERTIARY
ALTER TABLE Hospital ADD COLUMN capabilities TEXT DEFAULT 'ASV,EMERGENCY_CARE'; -- Comma-separated or JSON
ALTER TABLE Hospital ADD COLUMN ventilatorCount INTEGER DEFAULT 0;
ALTER TABLE Hospital ADD COLUMN icuBedsAvailable INTEGER DEFAULT 0;

-- 2. New Referral table for tracking Care Corridor transitions
CREATE TABLE IF NOT EXISTS Referral (
    id TEXT PRIMARY KEY,
    incidentId TEXT NOT NULL,
    fromHospitalId TEXT NOT NULL,
    toHospitalId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | DECLINED | IN_TRANSIT | ARRIVED | COMPLETED
    urgency TEXT NOT NULL DEFAULT 'HIGH',   -- CRITICAL_IMMEDIATE | HIGH_PRIORITY | ROUTINE
    missingCapabilities TEXT NOT NULL,      -- JSON list: ["VENTILATION", "ICU"]
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

---

## 8. API & Real-Time Specifications

### REST Endpoints
1. `GET /api/hospitals/{hid}/capabilities`
   - Returns facility level, capability list, ventilator count, and ICU bed availability.
2. `POST /api/incidents/{id}/evaluate-referral`
   - Evaluates current facility capabilities against clinical observations and returns capability gap analysis + ranked capable receiving facilities.
3. `POST /api/incidents/{id}/referrals`
   - Body: `{ fromHospitalId, toHospitalId, missingCapabilities, clinicalReason, urgency }`.
   - Creates referral record, enqueues outbox event, and broadcasts `REFERRAL_CREATED`.
4. `PATCH /api/referrals/{referral_id}/accept`
   - Body: `{ acceptedBy, notes }`.
   - Sets referral status to `ACCEPTED`, enqueues outbox event, and broadcasts `REFERRAL_ACCEPTED`.
5. `PATCH /api/referrals/{referral_id}/decline`
   - Body: `{ declinedBy, reason }`.
   - Sets status to `DECLINED`, triggers automatic re-evaluation, and broadcasts `REFERRAL_DECLINED`.
6. `PATCH /api/referrals/{referral_id}/transport`
   - Sets status to `IN_TRANSIT` with ambulance ETA and timestamp.
7. `PATCH /api/referrals/{referral_id}/arrive`
   - Sets status to `ARRIVED` and closes the loop.
8. `GET /api/incidents/{id}/corridor`
   - Fetches full unified Care Corridor timeline, combining SOS dispatch, clinical observations, capability gap, and referral state.

### Real-Time WebSocket Events (`/ws/incidents/{id}`)
- `REFERRAL_CREATED`: `{ referralId, fromHospital, toHospital, missingCapabilities, urgency }`
- `REFERRAL_ACCEPTED`: `{ referralId, toHospital, acceptedAt, acceptedBy }`
- `REFERRAL_DECLINED`: `{ referralId, declinedReason, nextRecommendedHospital }`
- `TRANSPORT_STARTED`: `{ referralId, ambulanceId, etaMinutes }`
- `PATIENT_ARRIVED`: `{ referralId, arrivedAt, receivingDoctor }`

---

## 9. Care Corridor UI Design (`frontend/`)

### Unified Care Corridor Timeline Component (`frontend/components/care-corridor-timeline.tsx`)
A vertical step progress card rendering the end-to-end lifecycle:
1. **Incident Triggered** (Time, GPS, Dispatch status)
2. **Primary Facility Arrival** (e.g. *Malavalli Taluk PHC*)
3. **Clinical Observation** (VenomScore: 54% ptosis, Severity: MODERATE, 20WBCT: Unclotted)
4. **Capability Gap Detected** (?? *Mechanical Ventilation Unavailable at Malavalli PHC*)
5. **Care Corridor Activated** (Destination: *Mandya District Hospital*, 91.5% Compliance, 18 ASV Vials, 4 Ventilators Available)
6. **Receiving Facility Acceptance** (? *Accepted by Dr. Ramesh, CMO Mandya DH — ICU Bed & Vent Reserved*)
7. **Inter-Facility Transport** (?? *108 ALS Ambulance in transit — ETA 18 mins*)
8. **Patient Arrived & Handoff** (?? *Arrived at Mandya DH — Initial 10 Vials ASV Administered*)

### Receiving Hospital Console (`?role=hospital`)
- Shows incoming Care Corridor referrals with audio/visual notification.
- One-tap **ACCEPT & RESERVE VENTILATOR** or **RE-ROUTE** button.
- Instant pre-arrival checklist (ASV vials thawed, ventilator circuit primed, blood bank on standby).

---

## 10. Karnataka Deterministic Demo Corridor Scenario (`NR-1042`)

A reproducible, high-impact clinical presentation flow:
1. **10:00 AM — Bite & SOS**: Field worker in Malavalli, Mandya district bitten by Common Krait. One-tap SOS triggers parallel dispatch.
2. **10:12 AM — First Responder Arrival**: ASHA worker logs initial symptoms and coordinates transport to nearest facility: **Malavalli Taluk PHC**.
3. **10:25 AM — Malavalli PHC Triage**:
   - PHC has ASV (12 vials) but **ZERO ventilators** and **NO ICU**.
   - VenomScore tracker runs on tablet: Eyelid ptosis drops from 12mm to 6mm (50% closure) in 15 minutes.
   - Clinical status: `NEUROTOXIC` envenomation with impending respiratory paralysis.
4. **10:27 AM — Capability Gap & Referral Recommendation**:
   - NagRaksha flags: `MISSING: MECHANICAL_VENTILATION`.
   - Recommends: **Mandya District Hospital** (22 km, 28 min, 91.5% Compliance, 4 Ventilators, 42 ASV vials).
5. **10:28 AM — Receiving Acceptance**:
   - Hospital console at Mandya DH pings.
   - Doctor reviews live VenomScore ptosis trend and taps **ACCEPT REFERRAL**.
6. **10:30 AM — Transport & Arrival**:
   - 108 ALS Ambulance initiates transport (`IN_TRANSIT`).
   - Live pre-arrival packet streams to Mandya DH ICU.
   - Arrival confirmed at Mandya DH (`ARRIVED`). Closed-loop care completed.

---

## 11. Threat Modeling & Safety Controls

| Threat | Mitigation Strategy | Test Verification |
|---|---|---|
| **T1: Clinical Misinformation** | All capability-gap triggers derived strictly from WHO/NAPSE guidelines with cited rule tags. No LLM hallucinations in referral logic. | Unit tests verify deterministic rule engine output against known clinical test fixtures. |
| **T2: Routing to Incompetent Facility** | Capability filter strictly requires all `missing_capabilities` to be present in target facility before ranking. | Test asserting PHC without ventilation is NEVER recommended for severe neurotoxic bite. |
| **T3: Stale Hospital Capability Data** | Compliance scoring penalizes hospitals with unverified inventory or capability records older than 24h. | Ranking test verifying stale facility loses rank to fresh verified facility. |
| **T4: False Acceptance Semantics** | State transitions require valid authenticated user action or role token. | Integration test verifying unauthorized state transitions return 401/403. |
| **T5: Real-Time Disconnect** | Reconnecting WebSocket hook with polling fallback on `GET /api/incidents/{id}/corridor`. | Component test simulating WebSocket drop and recovery. |
| **T6: Offline PWA Clarity** | Offline service worker displays clear cached emergency first aid and emphasizes that live referral requires connectivity. | PWA offline test verifying no false "Referral Transmitted" banner when offline. |

---

## 12. GSD Phase 9 Wave & Execution Plan Breakdown

Phase 9 is decomposed into 5 executable plans configured for continuous single-pass execution (all plans unblocked in Wave 1):

```
Wave 1 (Foundation & Schema):
  +-- 09-01-PLAN.md: Facility Capability Model & SQLite Schema Migration

Wave 2 (Clinical Domain & Referral Engine):
  +-- 09-02-PLAN.md: Clinical Capability-Gap Evaluator & Recommendation Filter

Wave 3 (Referral Lifecycle & Real-Time Sync):
  +-- 09-03-PLAN.md: Referral REST API, Outbox Events & WebSocket Broadcasts

Wave 4 (Frontend UI & Closed-Loop Timeline):
  +-- 09-04-PLAN.md: Care Corridor Timeline Component & Hospital Console Integration

Wave 5 (Karnataka Seed, Knowledge Grounding & E2E Validation):
  +-- 09-05-PLAN.md: Realistic Demo Corridor Seed, NAPSE RAG Chunks & E2E Pytest/Vitest Suite
```

---

## 13. Things Explicitly NOT to Build (Speed-First Guardrails)

To maintain maximum velocity and judging impact:
1. ? Do NOT build a full Electronic Health Record (EHR) / Hospital Information Management System (HIMS).
2. ? Do NOT replace SQLite with PostgreSQL/PostGIS.
3. ? Do NOT build a custom turn-by-turn navigation map SDK.
4. ? Do NOT use LLM prompts for deterministic referral decisions (RAG is strictly for guideline retrieval and explanation).
5. ? Do NOT build patient billing, insurance claims, or non-snakebite hospital workflows.
6. ? Do NOT rebuild the existing SOS, wound tracking, or VenomScore vision pipelines.

---

## 14. Exact Recommended Execution Order

1. **Step 1:** Add Phase 9 to `.planning/ROADMAP.md` and `.planning/STATE.md`.
2. **Step 2:** Generate all 5 PLAN markdown files in `.planning/phases/09-care-corridor-capability-aware-referral/`.
3. **Step 3:** Commit planning artifacts.
4. **Step 4:** Execute code changes across all plans sequentially without premature stops.
5. **Step 5:** Run full backend Pytest suite (expecting ~110+ passing tests) and frontend Vitest suite.
6. **Step 6:** Perform end-to-end integration and demo corridor rehearsal.
