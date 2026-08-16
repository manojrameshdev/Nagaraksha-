---
slug: responder-workspace-symptoms-undefined
status: resolved
trigger: Runtime TypeError — "can't access property length, incident.symptomObservations is undefined" at ResponderWorkspace (workspaces.tsx:256)
created: 2026-08-16
---

## Current Focus

**Hypothesis:** `useLatestIncident` stores the slim row returned by `GET /api/incidents` (which has no `symptomObservations`/`dispatchAttempts`), and `ResponderWorkspace` reads `incident.symptomObservations.length` on that row → `undefined.length` → crash.

**Next action:** Make `useLatestIncident` fetch the full incident via `getIncident(id)` after listing; align the MSW `/api/incidents` mock with the real slim list shape; add a regression test.

## Symptoms

1. Runtime TypeError on the emergency home page when the Responder role is selected and an incident exists:
   `can't access property "length", incident.symptomObservations is undefined` at `workspaces.tsx:256` (Symptoms row in ResponderWorkspace).
2. Stack: ResponderWorkspace → RoleWorkspace → Page (app/page.tsx:28).

## Evidence

- timestamp: 2026-08-16 — `backend/app/routes/incidents.py` `list_incidents` SELECTs only `id, state, lat, lng, address, createdAt, updatedAt` — no nested `symptomObservations`/`dispatchAttempts`/`snakeObservations`.
- timestamp: 2026-08-16 — `GET /api/incidents/{id}` (`get_incident`) returns the full shape via `_load_incident` including `symptomObservations`.
- timestamp: 2026-08-16 — `frontend/hooks/use-latest-incident.ts` stores `incidents[0]` (the slim row) directly into state.
- timestamp: 2026-08-16 — `frontend/components/nagraksha/workspaces.tsx` ResponderWorkspace reads `incident.symptomObservations.length` (line ~256) and RescueWorkspace relies on `incident.lat/lng` (present in slim row).
- timestamp: 2026-08-16 — MSW `frontend/test/handlers.ts` `/api/incidents` handler includes `symptomObservations: []` + `dispatchAttempts: []`, so tests did not reproduce the crash (mock is more generous than the real backend).

## RESOLVED

**Root cause:** `useLatestIncident` stored the slim row from `GET /api/incidents` (which only SELECTs `id, state, lat, lng, address, createdAt, updatedAt`), but `ResponderWorkspace` read `incident.symptomObservations.length` on that row. The MSW `/api/incidents` mock included the nested arrays, so tests passed while the real backend crashed.

**Fix:**
1. `frontend/hooks/use-latest-incident.ts` — after picking the latest id from the list, re-fetch the full incident via `getIncident(id)` (nested arrays present); fall back to the slim row only if the detail fetch fails.
2. `frontend/test/handlers.ts` — `/api/incidents` list handler now mirrors the real slim backend shape, so tests would catch this class of bug.
3. `frontend/components/__tests__/workspaces.test.tsx` — new regression test rendering `ResponderWorkspace` (exported) asserting the incident id renders and symptoms show "Pending log" without crashing.

**Verification:**
- `tsc --noEmit` — 0 errors
- `eslint . --max-warnings 0` — 0 errors
- vitest — 33/33 pass (6 in workspaces, incl. new regression test)

## Resolution Plan
