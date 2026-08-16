# Technical Concerns & Risk Register

**Analysis Date:** 2026-08-16

## 1. High Priority Considerations

### A. Live Physical Webcam & Browser Permission in Live Demo
- **Context:** The VenomScore eyelid ptosis tracker requires active camera permission and physical squinting to demonstrate neurotoxic symptom progression during live presentations.
- **Mitigation:**
  - Automated integration tests (`TestVenomScoreHospitalLoop`, `venom-score.test.tsx`) completely verify the API, WebSocket pipeline, and component state machine.
  - The UI gracefully surfaces camera error banners if camera permission is denied, allowing manual simulated reading entry if needed.

### B. SQLite Concurrency Under High Load
- **Context:** While SQLite in WAL mode handles concurrent readers seamlessly, write operations lock the database briefly. Under high-frequency telemetry (e.g. dozens of simultaneous victims submitting 10s ptosis readings) plus referral state transitions, database write contention could emerge.
- **Mitigation:**
  - `PRAGMA busy_timeout` and WAL mode mitigate transient locks.
  - Ptosis readings are sampled at a controlled 10-second single-flight cadence per client; referral transitions are single, guarded `UPDATE … WHERE status=` statements — keeping write pressure negligible for hackathon and pilot scale.

### C. Corridor Timeline Only Projects the Latest Referral
- **Context:** `GET /api/incidents/{id}/corridor` derives stages 4–8 from the single most recent referral (`ORDER BY createdAt DESC LIMIT 1`). If an incident generates multiple referrals (e.g. first target declines, second accepts), the timeline collapses to the latest one and prior attempt history is not shown.
- **Mitigation:**
  - Decline reason and status of the latest referral are surfaced (`DECLINED` stage status + `declinedReason`); the audit trail (`AuditEvent`) retains the full history for forensics. A multi-referral timeline projection is a candidate future enhancement.

## 2. Medium Priority / Operational Items

### A. MediaPipe Model Loading on Low-Bandwidth Connections
- **Context:** The `@mediapipe/tasks-vision` Face Landmarker model asset (~5 MB) is loaded from CDN on the first run of the VenomScore tracker.
- **Mitigation:**
  - The component displays a clear "Calibrating..." and loading indicator while the model downloads and initializes.
  - The model is cached in browser IndexedDB/cache storage for subsequent sessions.

### B. Twilio Inbound SMS Webhook Accessibility
- **Context:** In local testing or internal demo environments, Twilio cannot reach `localhost:8000` without an active reverse tunnel (e.g., ngrok).
- **Mitigation:**
  - The incident view provides integrated "Accept / Decline" simulation buttons (`frontend/components/dispatch-actions.tsx`) enabling full dispatch workflow demonstration without relying on external SMS webhooks.

### C. `POST /api/incidents/{id}/evaluate-referral` Is Unauthenticated
- **Context:** The capability-gap evaluation endpoint has no `role` dependency, exposing incident telemetry (ptosis/wound/symptoms) to any caller. This is consistent with the demo posture (most GET endpoints are open), but it is a write-method endpoint that discloses clinical data.
- **Mitigation:**
  - Auth is enforced globally when `AUTH_ENFORCED=true` or `ENV=production` (fail-fast on demo secrets), and the endpoint is a read-only evaluation (no state mutation). Add a `require_role_if_enforced(...)` dependency if this becomes a concern.

### D. Auth Enforcement Is Optional in Demo Mode
- **Context:** All role guards use `require_role_if_enforced`, which is a no-op unless `AUTH_ENFORCED=true` or `ENV=production`. In demo deployments the referral accept/decline endpoints are effectively open.
- **Mitigation:**
  - This is intentional for frictionless demos; production is fail-fast on demo secrets. Document the posture for any real deployment.

## 3. Tech Debt & Code Hygiene

- **Seed Data Disclaimers:** All demonstration stakeholders (such as Gerry Martin / The Liana Trust) carry explicit `supportType: "pilot_permission"` markers to distinguish prototype records from production registrations.
- **Console Encoding:** All backend print statements in seed and utility scripts use ASCII-compatible output to prevent character encoding issues across Windows consoles (`cp1252`).
- **Hospital Packet Staleness (review-HIGH, Phase 08):** `HospitalWorkspace` in `frontend/components/nagraksha/workspaces.tsx` renders a static hospital packet while the live corridor runs from store state — accepted disposition for the demo, flagged for unification.
- **Untracked `nag-raksha.zip`:** Stale snapshot bundle at repo root; consider deleting or gitignoring.
