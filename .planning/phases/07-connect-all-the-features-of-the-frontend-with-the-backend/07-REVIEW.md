---
phase: 07-connect-all-the-features-of-the-frontend-with-the-backend
reviewed: 2026-08-15T04:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - backend/app/auth.py
  - backend/app/database.py
  - backend/app/dispatch.py
  - backend/app/eventbus.py
  - backend/app/main.py
  - backend/app/routes/hospitals.py
  - backend/app/routes/incidents.py
  - backend/app/routes/ops.py
  - backend/app/routes/risk.py
  - backend/app/routes/sos.py
  - backend/app/routes/stats.py
  - backend/app/routes/twilio_webhook.py
  - backend/app/routes/ws.py
  - backend/app/seed.py
  - docker-compose.yml
  - frontend/app/dashboard/page.tsx
  - frontend/app/hospitals/page.tsx
  - frontend/app/incidents/[id]/page.tsx
  - frontend/app/layout.tsx
  - frontend/app/manifest.ts
  - frontend/app/myth-buster/page.tsx
  - frontend/app/page.tsx
  - frontend/app/risk/page.tsx
  - frontend/components/dispatch-actions.tsx
  - frontend/components/health-indicator.tsx
  - frontend/components/nagraksha/shared.tsx
  - frontend/components/nagraksha/shell.tsx
  - frontend/components/nagraksha/workspaces.tsx
  - frontend/components/stock-update.tsx
  - frontend/components/symptom-logger.tsx
  - frontend/eslint.config.mjs
  - frontend/hooks/use-auth.ts
  - frontend/hooks/use-geolocation.ts
  - frontend/hooks/use-incident-socket.ts
  - frontend/lib/api.ts
  - frontend/lib/nagraksha.ts
  - frontend/lib/realtime.ts
  - frontend/lib/utils.ts
  - frontend/next.config.mjs
  - frontend/store/sos-store.ts
  - frontend/test/handlers.ts
  - frontend/test/setup.ts
  - frontend/vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 07: Connect all the features of the frontend with the backend — Code Review Report

**Reviewed:** 2026-08-15T04:00:00Z
**Depth:** standard
**Files Reviewed:** 38 source/config files (72-file diff scope filtered to source)
**Status:** issues_found

## Summary

Phase 07 delivers a complete API client layer, SOS real-time flow, four data-fetching pages, four backend-wired components, MSW integration tests, and a CI pipeline aligned with the migrated pnpm frontend. Artifacts exist, wire together, and pass `vitest` (10/10), `tsc --noEmit`, `eslint .` (exit 0), and `next build`.

However, adversarial review found **one critical runtime contract mismatch** that the MSW test suite actively masks, plus five warnings (three of which are wiring/consistency gaps between the frontend contract and the real backend). The critical finding means the SOS flow — the phase's headline success criterion — does **not** work against the real backend, even though the wiring is present and tests are green.

## Critical Issues

### CR-01: SOS response contract mismatch — frontend reads keys the backend never returns

**File:** `frontend/lib/nagraksha.ts:54-58`, `frontend/store/sos-store.ts:38-40`, `frontend/app/page.tsx:20-22`
**Issue:** `SosResponse` declares `{ incidentId, lanes, hospitals }` and the store reads `res.incidentId` / `res.lanes`. But the real backend `POST /api/sos` (`backend/app/routes/sos.py:29-36`) returns `{ incident, ref, rankedHospitals, dispatchedAt, streamUrl, wsUrl, auditUrl }` — there is no top-level `incidentId`, `lanes`, or `hospitals` key. Against the real backend, `res.incidentId` is `undefined`, so the store sets `incidentId: undefined` and `router.push('/incidents/undefined')` (page.tsx:22). The MSW handler (`frontend/test/handlers.ts`) returns the *frontend's* invented shape (`incidentId`, `lanes`, `hospitals`), so all 10 tests pass while the real flow is broken end-to-end.
**Fix:** Align one side to the other. Recommended (backend is authoritative): change `SosResponse` to `{ incident: Incident; rankedHospitals: Hospital[]; ref: string; wsUrl: string }` and the store to `const id = res.incident.id; set({ incidentId: id, dispatchLanes: res.incident.dispatchAttempts, sosLoading: false }); return id;`. Then update the MSW `/api/sos` handler to return the real backend shape so the tests stop masking the bug.

## Warnings

### WR-01: `DispatchAttempt.target` is undefined against the real backend

**File:** `frontend/lib/nagraksha.ts:22-29`, `frontend/app/incidents/[id]/page.tsx:90`
**Issue:** The `DispatchAttempt` interface declares `target: string`, and the incident page renders `{lane.target}`. The backend `DispatchAttempt` table has `candidateName` / `candidateRole` columns, no `target`. The MSW mock returns `target`, so tests pass; at runtime `lane.target` renders blank.
**Fix:** Replace `target: string` in the interface with `candidateName` / `candidateRole`, update the incident page to render `lane.candidateName` (or whichever field is displayed), and fix the MSW mock to match the backend row shape.

### WR-02: CI build skips TypeScript type errors (`ignoreBuildErrors: true`)

**File:** `frontend/next.config.mjs:4`, `.github/workflows/ci.yml` (frontend-build)
**Issue:** The migrated `next.config.mjs` re-enables `ignoreBuildErrors: true`, so `next build` silently ignores type errors. The CI `frontend-build` job runs `npx vitest run`, `pnpm run lint`, and `pnpm run build` — it never runs `tsc --noEmit` and the build step won't fail on type errors. This regresses Phase 2's requirement TYPES-02 ("ignoreBuildErrors removed — build fails on type errors") and the ROADMAP success criterion "all API calls fully TypeScript-typed" is no longer enforced by CI.
**Fix:** Set `ignoreBuildErrors: false` (the codebase currently passes `tsc --noEmit` clean, so it is safe) and optionally add `npx tsc --noEmit` as an explicit CI step for defense in depth.

### WR-03: Twilio webhook accepts the first PENDING attempt, not the responding responder's own attempt

**File:** `backend/app/routes/twilio_webhook.py:52-60`
**Issue:** On `ACCEPT`, the handler finds the responder by phone but then updates the *first* `PENDING` attempt for the incident (`WHERE incidentId=? AND outcome='PENDING' ORDER BY sequence ASC LIMIT 1`) without matching `responderId`. All three lanes start `PENDING` at the same time, so a first-aider replying ACCEPT can flip the ambulance-coordinator lane's attempt instead of their own. Same pattern in `backend/app/routes/incidents.py:104-125` (accept/decline PATCH).
**Fix:** Filter by the responder's own attempt: `AND responderId=?` (and for the UI PATCH, require the caller's responder identity or accept the current behavior as demo-scope and document it). At minimum, order by the responder's lane category.

### WR-04: Four built components are never used by any page

**File:** `frontend/components/symptom-logger.tsx`, `frontend/components/dispatch-actions.tsx`, `frontend/components/stock-update.tsx`, `frontend/components/health-indicator.tsx`
**Issue:** `SymptomLogger`, `DispatchActions`, `StockUpdate`, and `HealthIndicator` are exported and individually wired to their API functions, but **zero** pages import them (grep across `app/` returns 0 usages). The 07-03 summary explicitly deferred page wiring ("outside this plan's files_modified scope"), and 07-04 (CI/tests) never picked it up. FEAT-06/FEAT-07 components exist but are unreachable from the UI.
**Fix:** Wire the four components into their natural pages: `SymptomLogger` + `DispatchActions` on `app/incidents/[id]/page.tsx`, `StockUpdate` on `app/hospitals/page.tsx` (behind the existing role gate), and `HealthIndicator` in the app shell header.

### WR-05: `docker-compose.yml` references a deleted `frontend/Dockerfile`

**File:** `docker-compose.yml:24-28`
**Issue:** The `frontend` service builds `context: ./frontend`, `dockerfile: Dockerfile`, but `frontend/Dockerfile` was deleted by the migration (git status shows `D frontend/Dockerfile`). `docker compose up` for the frontend service fails to find the build file.
**Fix:** Restore `frontend/Dockerfile` for the migrated Next.js app (or remove the frontend service if compose is not the intended deploy path).

## Info

### IN-01: Duplicated `_load_incident` helper

**File:** `backend/app/routes/sos.py:50`, `backend/app/routes/incidents.py:17`
**Issue:** The same incident loader (incident + attempts + symptom/snake observations) is copy-pasted in two route modules. Drift risk if the incident shape changes.
**Fix:** Move to a shared helper (e.g., `backend/app/incident_loader.py` or a method on the db module) and import from both routes.

### IN-02: Seed stock status values don't match the frontend union type

**File:** `backend/app/seed.py` (statuses `"CONFIRMED"`, `"OUT"`), `frontend/lib/nagraksha.ts:12` (`'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW' | 'UNKNOWN'`)
**Issue:** Seeded hospitals use `CONFIRMED` / `OUT`, which don't match the frontend `Hospital.stock.status` union or `STOCK_COLORS` keys, so those badges fall back to gray `UNKNOWN` styling.
**Fix:** Normalize seed statuses to `IN_STOCK` / `OUT_OF_STOCK`, or extend the union + color map to accept the seeded values.

### IN-03: Geolocation permission prompt fires on page load, not on SOS tap

**File:** `frontend/app/page.tsx:13`, `frontend/hooks/use-geolocation.ts`
**Issue:** `useGeolocation()` calls `navigator.geolocation.getCurrentPosition` on mount, so the browser prompts for location as soon as the home page loads — before the user taps SOS. The same pattern exists on hospitals/risk pages, so it's consistent, but for an emergency action the permission request should ideally be deferred to the button tap.
**Fix:** (Optional) Acceptable for demo; if tightening, gate the geolocation request behind the SOS tap.

---

_Reviewed: 2026-08-15T04:00:00Z_
_Reviewer: Buffy (inline, gsd-code-reviewer contract — no subagent API on this runtime)_
_Depth: standard_
