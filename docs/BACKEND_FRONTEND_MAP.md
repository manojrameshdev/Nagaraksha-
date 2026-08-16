# NagRaksha — Backend ↔ Frontend Mapping

**Status:** Live, verified against source (backend `app/routes/*.py`, frontend `app/**`, `components/**`, `lib/nagraksha.ts`, `store/sos-store.ts`).

This document maps every backend endpoint to the frontend surface that calls it, and every frontend button/action to the backend endpoint it hits. Use it to answer "what does this button do?" and "what would break if this endpoint changed?"

---

## 1. Transport & Data Flow

- **REST base:** `BACKEND_URL` = `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:8000`). All calls go through `frontend/lib/api.ts` (`apiFetch`), which injects `Content-Type: application/json` and an optional `Authorization: Bearer <token>` from `localStorage.nagraksha_token`.
- **Typed client:** `frontend/lib/nagraksha.ts` — one exported function per endpoint. The UI should never call `apiFetch` directly; everything flows through this module.
- **Realtime:** WebSocket at `ws://…/ws/incidents/{incidentId}` (`frontend/lib/realtime.ts` → `hooks/use-incident-socket.ts` → `store/sos-store.ts`). SSE (`/api/incidents/{id}/stream`) still exists backend-side for backward compat but the frontend no longer uses it.
- **Auth:** roles `victim`, `hospital_admin`, `system_admin` (JWT via `POST /api/auth/token`). Mutating routes only enforce when `AUTH_ENFORCED=true`/`ENV=production` (see `backend/app/auth.py`). Frontend `hooks/use-auth.ts` stores token + role in localStorage; `StockUpdate` gates on `hospital_admin`/`system_admin`.

---

## 2. Backend Endpoint → Frontend Consumer

| # | Method | Endpoint | Backend file | Frontend consumer (file → function) |
|---|--------|----------|--------------|--------------------------------------|
| 1 | GET | `/api/health` | main.py | `lib/nagraksha.ts → getHealth` → `components/health-indicator.tsx` (header badge) |
| 2 | POST | `/api/auth/token` | main.py | `lib/nagraksha.ts → getAuthToken` → `hooks/use-auth.ts → login` |
| 3 | POST | `/api/sos` | routes/sos.py | `lib/nagraksha.ts → triggerSos` → `store/sos-store.ts → triggerSos` → `app/page.tsx handleSos` (SOS button) |
| 4 | GET | `/api/incidents` | routes/incidents.py | `lib/nagraksha.ts → listIncidents` → `app/dashboard/page.tsx`, `components/nagraksha/chat.tsx` (latest incident id) |
| 5 | GET | `/api/incidents/{id}` | routes/incidents.py | `lib/nagraksha.ts → getIncident` → `store/sos-store.ts`, `app/incidents/[id]/page.tsx` |
| 6 | GET | `/api/incidents/{id}/audit` | routes/incidents.py | `lib/nagraksha.ts → getIncidentAudit` (defined; not currently rendered) |
| 7 | GET | `/api/incidents/{id}/stream` (SSE) | routes/incidents.py | **Legacy — not used by frontend** (WebSocket preferred) |
| 8 | PATCH | `/api/incidents/{id}/accept` | routes/incidents.py | `lib/nagraksha.ts → acceptDispatch` → `components/dispatch-actions.tsx` (Accept) |
| 9 | PATCH | `/api/incidents/{id}/decline` | routes/incidents.py | `lib/nagraksha.ts → declineDispatch` → `components/dispatch-actions.tsx` (Decline) |
| 10 | POST | `/api/incidents/{id}/symptoms` | routes/incidents.py | `lib/nagraksha.ts → logSymptom` → `components/symptom-logger.tsx` (Log Symptom) |
| 11 | GET | `/api/incidents/{id}/corridor` | routes/referrals.py | `lib/nagraksha.ts → getCorridorTimeline` → `store/sos-store.ts → fetchCorridorTimeline` → `components/care-corridor-timeline.tsx` |
| 12 | GET | `/api/incidents/{id}/referrals` | routes/referrals.py | `lib/nagraksha.ts → listIncidentReferrals` (defined; not currently rendered) |
| 13 | POST | `/api/incidents/{id}/evaluate-referral` | routes/referrals.py | `lib/nagraksha.ts → evaluateReferral` (defined; not currently rendered) |
| 14 | POST | `/api/incidents/{id}/referrals` | routes/referrals.py | `lib/nagraksha.ts → createReferral` (defined; not currently rendered) |
| 15 | GET | `/api/hospitals` | routes/hospitals.py | `lib/nagraksha.ts → getHospitals` → `app/hospitals/page.tsx` |
| 16 | PATCH | `/api/hospitals/{hid}/stock` | routes/hospitals.py | `lib/nagraksha.ts → updateStock` → `components/stock-update.tsx` (Update Stock) |
| 17 | GET | `/api/hospitals/{hid}/capabilities` | routes/hospitals.py | — (no frontend consumer yet) |
| 18 | PATCH | `/api/hospitals/{hid}/capabilities` | routes/hospitals.py | — (no frontend consumer yet) |
| 19 | GET | `/api/risk` | routes/risk.py | `lib/nagraksha.ts → getRisk` → `app/risk/page.tsx` |
| 20 | GET | `/api/stats` | routes/stats.py | `lib/nagraksha.ts → getStats` → `app/dashboard/page.tsx` |
| 21 | GET | `/api/audit` | routes/ops.py | `lib/nagraksha.ts → getSystemAudit` → `components/nagraksha/workspaces.tsx` (AdminWorkspace) |
| 22 | GET | `/api/outbox` | routes/ops.py | `lib/nagraksha.ts → getOutbox` → `components/nagraksha/workspaces.tsx` (AdminWorkspace) |
| 23 | GET | `/api/knowledge-base` | routes/ops.py | `lib/nagraksha.ts → getKnowledgeBase` → `app/myth-buster/page.tsx` |
| 24 | POST | `/api/chat` | routes/chat.py | `lib/nagraksha.ts → sendChat` → `components/nagraksha/chat.tsx` (GrokChat Send) |
| 25 | POST | `/api/transcribe` | routes/transcribe.py | — (multipart variant; frontend uses `-b64`) |
| 26 | POST | `/api/transcribe-b64` | routes/transcribe.py | `lib/nagraksha.ts → transcribeAudio` → `components/nagraksha/chat.tsx` (Speak → Whisper) |
| 27 | POST | `/api/snake-id` | routes/snake_id.py | `lib/nagraksha.ts → identifySnake` → `app/snake-id/page.tsx` (Identify snake) |
| 28 | POST | `/api/myth-buster` | routes/myth_buster.py | — (no frontend consumer yet; Myth Buster page uses `/api/knowledge-base`) |
| 29 | GET | `/api/architecture` | routes/architecture.py | — (no frontend consumer yet) |
| 30 | POST | `/api/audit/village` | routes/audit.py | — (no frontend consumer yet) |
| 31 | POST | `/api/audit/village/{id}/household` | routes/audit.py | — (no frontend consumer yet) |
| 32 | GET | `/api/audit/village/{id}` | routes/audit.py | `lib/nagraksha.ts → getVillageAudit` (defined; not currently rendered) |
| 33 | GET | `/api/audit/district/{district}` | routes/audit.py | `lib/nagraksha.ts → getDistrictAudit` → `app/asha-audit/page.tsx` |
| 34 | GET | `/api/audit/districts` | routes/audit.py | `lib/nagraksha.ts → listAuditDistricts` → `app/asha-audit/page.tsx` |
| 35 | GET | `/api/stakeholders` | routes/stakeholders.py | `lib/nagraksha.ts → listStakeholders` → `components/nagraksha/workspaces.tsx` (StakeholderWorkspace) |
| 36 | POST | `/api/stakeholders` | routes/stakeholders.py | `lib/nagraksha.ts → addStakeholder` → `components/nagraksha/workspaces.tsx` (Add stakeholder) |
| 37 | DELETE | `/api/stakeholders/{id}` | routes/stakeholders.py | — (no frontend consumer yet) |
| 38 | GET | `/api/responders` | routes/twilio_webhook.py | — (no frontend consumer yet) |
| 39 | POST | `/api/responders` | routes/twilio_webhook.py | — (no frontend consumer yet) |
| 40 | POST | `/webhook/twilio` | routes/twilio_webhook.py | — (Twilio SMS inbound; not called by UI) |
| 41 | POST | `/api/venom-score/{id}/reading` | routes/venom_score.py | `lib/nagraksha.ts → submitPtosisReading` → `components/venom-score.tsx` |
| 42 | GET | `/api/venom-score/{id}/score` | routes/venom_score.py | `lib/nagraksha.ts → getVenomScore` → `components/venom-score.tsx` / incident page |
| 43 | GET | `/api/venom-score/{id}/readings` | routes/venom_score.py | — (no frontend consumer yet) |
| 44 | POST | `/api/wound/{id}/reading` | routes/wound.py | — (no frontend consumer yet) |
| 45 | GET | `/api/wound/{id}/trend` | routes/wound.py | — (no frontend consumer yet) |
| 46 | GET | `/api/wound/{id}/packet` | routes/wound.py | — (no frontend consumer yet) |
| 47 | PATCH | `/api/referrals/{id}/accept` | routes/referrals.py | `lib/nagraksha.ts → acceptReferral` → `components/care-corridor-timeline.tsx` (Accept & Reserve) |
| 48 | PATCH | `/api/referrals/{id}/decline` | routes/referrals.py | `lib/nagraksha.ts → declineReferral` → `components/care-corridor-timeline.tsx` (Re-Route/Decline) |
| 49 | PATCH | `/api/referrals/{id}/transport` | routes/referrals.py | `lib/nagraksha.ts → startTransport` (defined; not currently rendered) |
| 50 | PATCH | `/api/referrals/{id}/arrive` | routes/referrals.py | `lib/nagraksha.ts → confirmArrival` (defined; not currently rendered) |
| 51 | WS | `/ws/incidents/{incidentId}` | routes/ws.py | `lib/realtime.ts → createIncidentSocket` → `hooks/use-incident-socket.ts` → `store/sos-store.ts updateFromWsEvent` |

---

## 3. Frontend Button / Action → Backend Endpoint

### 3.1 Emergency home (`app/page.tsx` + `components/nagraksha/workspaces.tsx` — Victim)

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| **SOS — SNAKEBITE** | `handleSos` → store `triggerSos(lat, lng)` → router push `/incidents/{id}` | `POST /api/sos` |
| Snake ID / Myth Buster / Guide cards | `<Link>` navigation | — (pages, not API) |
| Quick navigation links | `<Link>` to `/dashboard`, `/hospitals`, `/risk`, `/myth-buster`, `/snake-id`, `/guide` | — |
| Chat **Send** / suggestions | `sendChat` with latest incident id | `POST /api/chat` |
| Chat **Speak / Stop** | MediaRecorder → `transcribeAudio(b64)` → fills input | `POST /api/transcribe-b64` |
| Chat **Listen** (per reply) | `speechSynthesis` (browser, no API) | — |
| Chat **Voice on/off** | toggles TTS playback | — |
| Role sidebar / mobile nav | local state `role` switch | — |

### 3.2 Responder workspace (`workspaces.tsx` — Responder)

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| **Accept** / **Decline** (dispatch) | `acceptDispatch` / `declineDispatch` on the live incident | `PATCH /api/incidents/{id}/accept` / `.../decline` |

### 3.3 Rescue workspace

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| **Open navigation** | opens maps directions to the live incident location | — (external maps link built from incident lat/lng) |

### 3.4 Ambulance workspace — read-only cards (no buttons).

### 3.5 Hospital workspace — read-only cards; live pre-arrival packet lives on `/incidents/[id]?role=hospital`.

### 3.6 ASHA workspace

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| **Review follow-up areas** | navigates to the village-audit page listing districts/GPs | `GET /api/audit/districts`, `GET /api/audit/district/{d}` |

### 3.7 Stakeholder workspace

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| Search box | filters the live stakeholder table client-side | `GET /api/stakeholders` |
| **Add stakeholder** | opens inline form → `addStakeholder` (requires `system_admin` when auth enforced) | `POST /api/stakeholders` |

### 3.8 Admin workspace

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| Incident activity / audit trail / event outbox numbers | live counts | `GET /api/stats`, `GET /api/audit` |
| Audit trail table | live recent events | `GET /api/audit` |

### 3.9 Incident page (`app/incidents/[id]/page.tsx` + components)

| Button | Behaviour | Endpoint |
|--------|-----------|----------|
| **Accept** / **Decline** (DispatchActions) | accept/decline a dispatch lane | `PATCH /api/incidents/{id}/accept\|decline` |
| **Log Symptom** | `logSymptom` | `POST /api/incidents/{id}/symptoms` |
| **Accept & Reserve Ventilator / Bed** (Care Corridor, `?role=hospital`) | `acceptReferral` then refresh corridor | `PATCH /api/referrals/{id}/accept` |
| **Re-Route / Decline** (Care Corridor) | `declineReferral` then refresh corridor | `PATCH /api/referrals/{id}/decline` |
| **Start VenomScore** / **Stop Tracking** | camera + MediaPipe → `submitPtosisReading` | `POST /api/venom-score/{id}/reading` |

### 3.10 Static pages

| Page | Button | Endpoint |
|------|--------|----------|
| `/dashboard` | incident links; stat cards loaded on mount | `GET /api/stats`, `GET /api/incidents` |
| `/hospitals` | **Update Stock** (role-gated) | `PATCH /api/hospitals/{id}/stock` |
| `/risk` | none (auto-loads) | `GET /api/risk` |
| `/snake-id` | **Identify snake** | `POST /api/snake-id` |
| `/myth-buster` | search-as-you-type | `GET /api/knowledge-base` |
| `/guide` | static links | — |

---

## 4. Endpoints Defined in the Client but Not Yet Rendered

These functions exist in `lib/nagraksha.ts` (and the backend supports them) but no UI calls them yet:

- `getIncidentAudit` (#6)
- `listIncidentReferrals` (#12), `evaluateReferral` (#13), `createReferral` (#14)
- `startTransport` (#49), `confirmArrival` (#50)
- `getVillageAudit` (#32)
- `getVenomScore` (#42) — used indirectly via store `VENOM_SCORE_UPDATE`

---

## 5. Deliberate Demo-Only Surfaces

Per the comment in `app/incidents/[id]/page.tsx`, the static role workspaces (Responder/Rescue/Ambulance/Hospital cards, e.g. `NR-1042`, ETA chips, "128 records") are **compliance/demo surfaces** and were intentionally not wired to live data. The `?role=hospital` incident page is the live hospital surface. This mapping documents which of those were subsequently wired (Responder Accept/Decline, Rescue navigation, ASHA audit, Stakeholder registry, Admin stats/audit).
