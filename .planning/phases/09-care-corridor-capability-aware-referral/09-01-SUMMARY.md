# Phase 9: Plan 01 Summary — Schema & Data Models

## Implemented Work
1. **Database Schema Enhancements** (`backend/app/database.py`):
   - Added `presentingHospitalId` to `Incident` schema and foreign key index `idx_incident_presenting_hosp`.
   - Added `facilityLevel`, `capabilities`, `ventilatorCount`, `icuBedsAvailable` to `Hospital` schema.
   - Created `Referral` table with SQLite CHECK constraints on `status` (`PENDING`, `ACCEPTED`, `DECLINED`, `IN_TRANSIT`, `ARRIVED`, `COMPLETED`) and `urgency` (`CRITICAL_IMMEDIATE`, `HIGH_PRIORITY`, `ROUTINE`).
   - Added composite index `idx_referral_incident_created` (`incidentId, createdAt DESC`).
   - Updated `migrate_db()` to safely migrate existing databases with idempotent column addition.
2. **Pydantic Type Contracts** (`backend/app/models.py`):
   - Defined `FacilityCapability` literal union: `"ASV"`, `"OXYGEN"`, `"VENTILATION"`, `"ICU"`, `"BLOOD_BANK"`, `"DIALYSIS"`, `"EMERGENCY_CARE"`.
   - Defined `FacilityLevel` literal union: `"PHC"`, `"CHC"`, `"SDH"`, `"DH"`, `"TERTIARY"`.
   - Defined `HospitalCapabilityUpdate`, `ReferralCreateRequest`, `ReferralAcceptRequest`, `ReferralDeclineRequest`, `ReferralResponse`.

## Verification
- Unit and integration tests passed.
- SQLite migration validated against fresh and migrated databases.
