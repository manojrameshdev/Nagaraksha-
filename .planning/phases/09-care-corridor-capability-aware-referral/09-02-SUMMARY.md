# Phase 9: Plan 02 Summary — Pure Decision Engine & Ranking

## Implemented Work
1. **Pure Capability Gap Engine** (`backend/app/domain.py`):
   - Implemented `evaluate_capability_gap(...)` pure clinical function grounded directly in WHO Guidelines (2016) and NCDC NAPSE (2024).
   - Rules:
     - Neurotoxic envenomation with ptosis change $\ge 40\%$ or moderate/severe severity requires `VENTILATION` + `ICU` with `CRITICAL_IMMEDIATE` urgency.
     - Hemotoxic envenomation with spontaneous bleeding or rapid proximal swelling requires `BLOOD_BANK` + `ICU`.
     - Suspected acute kidney injury / oliguria requires `DIALYSIS` + `ICU`.
     - Routine presentation requires basic `ASV` + `EMERGENCY_CARE`.
2. **Hard-Capability Hospital Ranking** (`backend/app/domain.py`):
   - Implemented `rank_capable_hospitals(origin, hospitals, required_capabilities)`:
     - Enforces hard capability filtering: any hospital missing required capabilities or with `stock.status == "OUT"` is marked `eligible = False` and cannot be `recommended`.
     - Eligible facilities are ranked deterministically by travel ETA and compliance score.

## Verification
- Unit test suite `TestCapabilityGapEvaluation` and `TestCapableHospitalRanking` in `backend/tests/test_domain.py` covering all clinical branches passed.
