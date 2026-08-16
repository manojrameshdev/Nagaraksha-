# Technical Concerns & Risk Register

**Analysis Date:** 2026-08-16

## 1. High Priority Considerations

### A. Live Physical Webcam & Browser Permission in Live Demo
- **Context:** The VenomScore eyelid ptosis tracker requires active camera permission and physical squinting to demonstrate neurotoxic symptom progression during live presentations.
- **Mitigation:**
  - Automated integration tests (`TestVenomScoreHospitalLoop` and `venom-score.test.tsx`) completely verify the API, WebSocket pipeline, and component state machine.
  - The UI gracefully surfaces camera error banners if camera permission is denied, allowing manual simulated reading entry if needed.

### B. SQLite Concurrency Under High Load
- **Context:** While SQLite in WAL mode handles concurrent readers seamlessly, write operations lock the database briefly. Under high-frequency telemetry (e.g. dozens of simultaneous victims submitting 10s ptosis readings), database write contention could emerge.
- **Mitigation:**
  - `PRAGMA busy_timeout` and WAL mode mitigate transient locks.
  - Ptosis readings are sampled at a controlled 10-second single-flight cadence per client, keeping write pressure negligible for hackathon and pilot scale.

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

## 3. Tech Debt & Code Hygiene

- **Seed Data Disclaimers:** All demonstration stakeholders (such as Gerry Martin / The Liana Trust) carry explicit `supportType: "pilot_permission"` markers to distinguish prototype records from production registrations.
- **Console Encoding:** All backend print statements in seed and utility scripts use ASCII-compatible output to prevent character encoding issues across Windows consoles (`cp1252`).
