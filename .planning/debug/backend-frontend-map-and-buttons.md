---
slug: backend-frontend-map-and-buttons
status: resolved
trigger: User request — "map the whole backend with the frontend and define those buttons properly"
created: 2026-08-16
---

## Current Focus

**Hypothesis:** Several role-workspace buttons render but have no `onClick`/API call (dead buttons), and there is no single document mapping backend endpoints to the frontend surfaces that call them.

**Next action:** Produce `docs/BACKEND_FRONTEND_MAP.md`; wire every dead button to its real endpoint with live data; add missing client functions; verify with typecheck + tests.

## Symptoms

1. Responder workspace "Accept" / "Decline" buttons (on demo card NR-1042) do nothing — no `onClick`.
2. Rescue workspace "Open navigation" button does nothing.
3. ASHA workspace "Review follow-up areas" button does nothing.
4. Stakeholder workspace "Add stakeholder" button does nothing; search input is non-functional; table is hardcoded.
5. Admin workspace shows hardcoded numbers ("128 records", "642 events", "14 rows") instead of `GET /api/audit` + `GET /api/stats` data.
6. Mobile header "Open workspace menu" button has no `onClick`.
7. No mapping document existed covering backend ↔ frontend consumption.

## Evidence

- timestamp: 2026-08-16 — Backend exposes 50 REST endpoints + 1 WebSocket across 17 route modules (`backend/app/routes/*.py`); full inventory captured.
- timestamp: 2026-08-16 — `frontend/lib/nagraksha.ts` is the single typed client; `apiFetch` in `frontend/lib/api.ts` is the transport with JWT injection.
- timestamp: 2026-08-16 — `components/dispatch-actions.tsx` already implements Accept/Decline against `/api/incidents/{id}/accept|decline` but is only rendered on `/incidents/[id]`, not the Responder workspace.
- timestamp: 2026-08-16 — `backend/app/routes/stakeholders.py` supports GET/POST `/api/stakeholders` (POST requires `system_admin`); no client functions existed.
- timestamp: 2026-08-16 — `backend/app/routes/audit.py` supports `/api/audit/districts`, `/api/audit/district/{d}`, `/api/audit/village`; no client functions existed.
- timestamp: 2026-08-16 — `backend/app/routes/ops.py` serves `GET /api/audit` (recent 24 events) used by nothing in the UI.

## RESOLVED

**Root cause:** Role workspaces were static demo surfaces — buttons rendered with no `onClick` and no client functions existed for the corresponding backend endpoints; no mapping document existed.

**Fix:**
1. `docs/BACKEND_FRONTEND_MAP.md` — full endpoint → consumer and button → endpoint mapping (51 endpoints, every frontend surface).
2. `frontend/lib/nagraksha.ts` — added `listStakeholders`, `addStakeholder`, `listAuditDistricts`, `getDistrictAudit`, `getVillageAudit`, `getOutbox`.
3. `hooks/use-latest-incident.ts` — shared hook for the latest incident.
4. Responder workspace — live incident card + `DispatchActions` (Accept/Decline) hitting `/api/incidents/{id}/accept|decline`.
5. Rescue workspace — "Open navigation" opens Google Maps directions to the live incident lat/lng.
6. `app/asha-audit/page.tsx` — new page listing districts/GPs from `/api/audit/districts` + `/api/audit/district/{d}`; ASHA "Review follow-up areas" links there.
7. Stakeholder workspace — live table from `/api/stakeholders`, working search filter, inline add form posting to `/api/stakeholders`.
8. Admin workspace — live counts + audit trail from `/api/stats`, `/api/audit`, `/api/outbox`.
9. Mobile header menu button — now opens a switch-workspace menu (accessible, `aria-expanded`, closes on select).

**Verification:**
- `tsc --noEmit` — 0 errors
- `eslint . --max-warnings 0` — 0 errors
- vitest — 32/32 pass (6 new workspace tests covering live stakeholder table, search filter, add form, admin live data, mobile menu)

## Resolution Plan

1. Create `docs/BACKEND_FRONTEND_MAP.md` (endpoint → consumer; button → endpoint).
2. Add `listStakeholders`, `addStakeholder`, `listAuditDistricts`, `getDistrictAudit`, `getVillageAudit` to `frontend/lib/nagraksha.ts`.
3. Responder workspace: fetch live incident, render `DispatchActions` for Accept/Decline.
4. Rescue workspace: fetch live incident, "Open navigation" opens maps directions to incident lat/lng.
5. ASHA workspace: "Review follow-up areas" → `/asha-audit` page backed by `/api/audit/districts` + `/api/audit/district/{d}`.
6. Stakeholder workspace: live table from `/api/stakeholders`, working search filter, inline add form posting to `/api/stakeholders`.
7. Admin workspace: live counts from `/api/stats` + `/api/audit`.
8. Mobile header menu button: toggles an accessible role menu overlay.
9. Add MSW handlers + component tests; run `tsc --noEmit` and vitest.
