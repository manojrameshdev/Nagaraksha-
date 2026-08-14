---
phase: 07-connect-all-the-features-of-the-frontend-with-the-backend
plan: 02
subsystem: ui
tags: [typescript, zustand, websocket, nextjs, react, realtime]

# Dependency graph
requires:
  - phase: 07 (research)
    provides: backend route inventory + env wiring (NEXT_PUBLIC_BACKEND_URL, /api/sos, /api/incidents/{id}, /ws/incidents/{id})
  - phase: 07-01 (API client & auth layer)
    provides: frontend/lib/api.ts apiFetch, frontend/lib/nagraksha.ts typed API functions + interfaces, frontend/lib/realtime.ts createIncidentSocket, frontend/hooks/use-geolocation.ts
provides:
  - frontend/store/sos-store.ts — Zustand store with triggerSos action, WS event merging, incident state
  - frontend/hooks/use-incident-socket.ts — WebSocket lifecycle hook with unmount cleanup
  - frontend/app/incidents/[id]/page.tsx — real-time incident tracking page (initial GET + WS + dispatch lanes)
affects: [07-03, 07-04]

actuals:
  tokens: 1758    # chars/4 over the 3 files actually changed
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: [zustand@^5.0.3]
  patterns:
    - "Zustand store calling API inside action (triggerSos POST /api/sos), storing returned incidentId + lanes in global state"
    - "WebSocket lifecycle hook: useEffect opens createIncidentSocket, cleanup closes socket + resets wsConnected"
    - "Individual zustand selectors per store field instead of multi-field object selectors (avoids useSyncExternalStore fresh-snapshot churn)"

key-files:
  created:
    - frontend/store/sos-store.ts
    - frontend/hooks/use-incident-socket.ts
    - frontend/app/incidents/[id]/page.tsx
  modified: []

key-decisions:
  - "Plan paths (frontend/src/store, frontend/src/hooks, frontend/src/app) adapted to the migrated root-level structure (frontend/store/, frontend/hooks/, frontend/app/) because the working tree had already deleted frontend/src/ (pre-existing uncommitted migration) — same adaptation Plan 07-01 documented"
  - "SosActions interface type-position params prefixed with _ (lat/lng/address/incident/e/connected) to satisfy the project's no-unused-vars argsIgnorePattern convention — matches 07-01's realtime.ts finding"
  - "Incident page uses individual per-field zustand selectors, not the plan's object-returning selector, to avoid fresh-object getSnapshot churn in useSyncExternalStore"
  - "Zustand installed into the working-tree (migration-slimmed) package.json — HEAD package.json already declared zustand@^5.0.3 but the migration dropped it; package.json change left uncommitted (plan files_modified excludes it)"

patterns-established:
  - "Zustand action calling typed API function (import { triggerSos as apiTriggerSos }) and updating state from the response"
  - "WS event → store update: updateFromWsEvent merges/upserts dispatch lanes and patches incident.state, then refreshes the full incident via getIncident for consistency"
  - "Client page pattern: useParams<{ id: string }> → useIncidentSocket(id) → getIncident on mount with loading/error states (no console, per no-console rule)"

requirements-completed: [FEAT-03, FEAT-04]

coverage:
  - id: D1
    description: "SOS Zustand store: triggerSos(lat, lng, address?) POSTs /api/sos and stores returned incidentId + lanes; updateFromWsEvent merges dispatch_attempted/dispatch_accepted lanes and incident_state updates; setIncident/setWsConnected/reset actions"
    requirement: FEAT-03
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "useIncidentSocket(incidentId) hook: opens createIncidentSocket on incidentId change, wires WS events into the Zustand store, closes socket and resets wsConnected on unmount"
    requirement: FEAT-03
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real-time incident page at /incidents/[id]: reads id from URL params, fetches initial incident via getIncident on mount, subscribes via useIncidentSocket, renders incident state badge + 3 dispatch lanes with PENDING/ACCEPTED/DECLINED badges + live/reconnecting indicator, handles loading/error/WS states"
    requirement: FEAT-04
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live WebSocket behavior end-to-end: DevTools shows ws://localhost:8000/ws/incidents/{id}; dispatch lane statuses update live without page refresh; incident_state HANDED_OFF updates the badge; closing/reopening the page reconnects"
    requirement: FEAT-04
    verification:
      - kind: manual_procedural
        ref: "Browser: trigger SOS → /incidents/{id} → DevTools WebSocket tab → observe live lane updates and reconnect"
        status: unknown
    human_judgment: true
    rationale: "Requires a running backend + browser with geolocation permission — cannot be automated in this environment"

# Metrics
duration: 12min
completed: 2026-08-15
status: complete
---

# Phase 07 Plan 02: SOS Flow & Real-Time WebSocket Summary

**SOS trigger flow with a Zustand store (triggerSos → incidentId → navigate), a WebSocket lifecycle hook with unmount cleanup, and a real-time incident tracking page with dispatch lanes — all TypeScript-compiled and lint-clean**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-15T02:00:00Z
- **Completed:** 2026-08-15T02:12:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `frontend/store/sos-store.ts` — Zustand store with `incidentId`, `incident`, `dispatchLanes`, `wsConnected`, `sosLoading`, `sosError`. `triggerSos(lat, lng, address?)` POSTs `/api/sos` via the typed `nagraksha.ts` client and stores the returned `incidentId` + lanes; `updateFromWsEvent` upserts dispatch attempts and patches `incident.state` on `incident_state`, then refreshes the full incident for consistency.
- `frontend/hooks/use-incident-socket.ts` — `useIncidentSocket(incidentId)` opens `createIncidentSocket` on incidentId change, forwards WS events to the store, and closes the socket + resets `wsConnected` on unmount.
- `frontend/app/incidents/[id]/page.tsx` — client page reading `id` from URL params, fetching the initial incident on mount, subscribing to live updates, and rendering incident state + 3 dispatch lanes with `PENDING`/`ACCEPTED`/`DECLINED` badges and a `● Live`/`◌ Reconnecting...` indicator. Handles loading, error, and WS connection states gracefully.
- Zustand `^5.0.3` installed into the frontend manifest (pnpm) so the store's `import { create } from 'zustand'` resolves.

## Task Commits

Each task was committed atomically:

1. **Task 1: SOS Zustand store** - `23ac745` (feat)
2. **Task 2: useIncidentSocket hook** - `f0a1401` (feat)
3. **Task 3: incident tracking page** - `f211332` (feat)

**Plan metadata:** `e07438e` (docs: complete plan), `09e64df` (docs: state + roadmap)

## Files Created/Modified

- `frontend/store/sos-store.ts` - Global SOS/incident Zustand store: triggerSos action (POST /api/sos), WS event merging, incident state
- `frontend/hooks/use-incident-socket.ts` - WebSocket lifecycle hook: opens createIncidentSocket, closes on unmount, syncs wsConnected
- `frontend/app/incidents/[id]/page.tsx` - Real-time incident page: initial GET, WS subscription, dispatch lanes, loading/error/WS states

## Decisions Made

- **Structure adaptation (Rule 3):** plan paths `frontend/src/store/sos-store.ts`, `frontend/src/hooks/use-incident-socket.ts`, `frontend/src/app/incidents/[id]/page.tsx` adapted to the migrated root-level structure (`frontend/store/`, `frontend/hooks/`, `frontend/app/`) — the pre-existing migration deleted the entire `frontend/src/` tree. Same adaptation 07-01 documented; all `must_haves` artifacts satisfied at the new paths.
- **Zustand manifest handling:** the HEAD `package.json` already declared `zustand@^5.0.3`, but the migration-slimmed working-tree manifest dropped it. Added `"zustand": "^5.0.3"` to the working-tree `package.json` and installed via `corepack pnpm add` (project is pnpm-based post-migration; pnpm 11 auto-created a `pnpm-workspace.yaml` which was removed after install). The `package.json` change stays **uncommitted** — it is not in the plan's `files_modified`, and the file carries the user's unrelated migration WIP.
- **Individual zustand selectors:** the page selects each store field with its own `useSosStore((s) => s.x)` call instead of the plan's single object-returning selector, avoiding fresh-snapshot churn in `useSyncExternalStore` (would need `useShallow` otherwise).
- **Error state instead of console.error:** the plan's `.catch(console.error)` violates the project's `no-console: error`; the page now holds an `error` state and renders a graceful failure UI (also satisfies the must-have "handles error states gracefully").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan paths referenced deleted legacy `frontend/src/` structure**
- **Found during:** All tasks (file creation)
- **Issue:** Plan's `files_modified` lists `frontend/src/store/...`, `frontend/src/hooks/...`, `frontend/src/app/...`, but the working tree migrated to root-level `frontend/store/`, `frontend/hooks/`, `frontend/app/` and deleted `frontend/src/` (pre-existing uncommitted migration)
- **Fix:** Created all three files under the migrated root-level paths; `@/` alias resolves `@/store/sos-store`, `@/hooks/use-incident-socket`, `@/lib/*` under the new layout
- **Files modified:** all three files (paths only)
- **Verification:** tsc --noEmit exit 0; eslint exit 0
- **Committed in:** 23ac745, f0a1401, f211332

**2. [Rule 1 - Bug] `data as DispatchAttempt` fails TypeScript**
- **Found during:** Task 1 (tsc)
- **Issue:** `Record<string, unknown>` → `DispatchAttempt` cast produced TS2352 ("neither type sufficiently overlaps") because DispatchAttempt has specific required properties an index-signature type lacks
- **Fix:** Double cast `data as unknown as DispatchAttempt` — semantically identical, satisfies the compiler
- **Files modified:** frontend/store/sos-store.ts
- **Verification:** tsc --noEmit exit 0
- **Committed in:** 23ac745 (Task 1)

**3. [Rule 2 - Missing Critical] SosActions interface type params flagged by no-unused-vars**
- **Found during:** Task 1 (lint)
- **Issue:** `triggerSos: (lat, lng, address) => ...`, `setIncident: (incident) => ...`, `updateFromWsEvent: (e) => ...`, `setWsConnected: (connected) => ...` in the interface were all reported "defined but never used" — the project's core no-unused-vars (argsIgnorePattern `^_`) treats function-type annotation params as args (identical to 07-01's realtime.ts finding)
- **Fix:** `_`-prefixed type-position params (`_lat`, `_lng`, `_address`, `_incident`, `_e`, `_connected`) in the interface only; the implementations keep real destructured names
- **Files modified:** frontend/store/sos-store.ts
- **Verification:** eslint --max-warnings 0 exit 0
- **Committed in:** 23ac745 (Task 1)

**4. [Rule 2 - Missing Critical] Plan's `.catch(console.error)` violates no-console**
- **Found during:** Task 3 (authoring)
- **Issue:** The plan's page fetches with `.catch(console.error)` — `no-console: error` in the committed eslint config would fail the hook
- **Fix:** Added an `error` state rendered as a graceful failure UI; the catch sets `error` (with a cancelled-flag guard against post-unmount setState). Also honors the must-have "incident page handles loading, error, and WebSocket connection states gracefully"
- **Files modified:** frontend/app/incidents/[id]/page.tsx
- **Verification:** eslint exit 0; tsc exit 0
- **Committed in:** f211332 (Task 3)

**5. [Rule 3 - Blocking] Zustand not present in the live (migration) package.json**
- **Found during:** Setup (before Task 1)
- **Issue:** HEAD `package.json` declares `zustand@^5.0.3` but the migration-slimmed working-tree manifest dropped it; the store's `import { create } from 'zustand'` would not resolve
- **Fix:** Added `"zustand": "^5.0.3"` to the working-tree `package.json` and ran `corepack pnpm add zustand --no-frozen-lockfile` (installs all frontend deps + zustand; `frontend/node_modules` removed after verification). Change left uncommitted per scope rule; pnpm-lock.yaml (untracked) updated consistently
- **Files modified:** frontend/package.json (uncommitted), frontend/pnpm-lock.yaml (untracked)
- **Verification:** tsc --noEmit exit 0; eslint exit 0; store resolves zustand
- **Committed in:** n/a (manifest change intentionally not committed)

---

**Total deviations:** 5 auto-fixed (3 blocking, 2 missing-critical)
**Impact on plan:** All auto-fixes were required to land TypeScript-compiled, lint-clean code in the project's current (mid-migration) structure. No scope creep; all `must_haves` artifacts satisfied.

## Issues Encountered

- **pnpm 11 auto-creates `pnpm-workspace.yaml`** during install (no workspace file existed before; same behavior 07-01 observed). Removed after install — pre-existing untracked state preserved.
- **`eslint-config-next` prints "Pages directory cannot be found"** to stderr on every eslint run — informational only (exit code 0); the `no-html-link-for-pages` rule is inert under the migrated App Router layout.
- **Pre-commit hook lint-staged dependency:** the hook runs `eslint --config frontend/eslint.config.mjs`, which the migration deleted from the working tree. As in 07-01, the config was temporarily restored from HEAD for the three commits and re-deleted afterward, restoring the exact pre-existing ` D` state. `frontend/tsconfig.tsbuildinfo` (created by tsc runs) removed after verification.

## User Setup Required

None - no external service configuration required. For runtime verification of the browser-based checks (D4), the backend must be running at `http://localhost:8000` (see root `.env.example` / `frontend/.env.example`).

## Verification Results

1. ✅ **TypeScript compiles with zero errors:** `tsc --noEmit` from `frontend/` (after pnpm install) — exit 0
2. ✅ **ESLint clean on all three files:** `eslint --max-warnings 0 --config frontend/eslint.config.mjs` — exit 0
3. ⏳ **SOS flow (manual):** tap SOS → geolocation prompt → grant → loading state → navigate to `/incidents/{id}` — requires running app + backend
4. ⏳ **WebSocket connection (manual):** DevTools WebSocket tab shows `ws://localhost:8000/ws/incidents/{id}`; lane statuses update live; `incident_state` HANDED_OFF updates the badge; closing/reopening the page reconnects — requires running app + backend

Items 3-4 are inherently browser-based and could not be automated in this environment; tracked for the verifier (D4 in coverage routes to human judgment).

## Next Phase Readiness

- Plans 07-03 (feature pages) and 07-04 (CI sync) can consume `useSosStore` (triggerSos, setIncident, dispatchLanes, wsConnected) and `useIncidentSocket` directly.
- **Heads-up for 07-03:** the SOS trigger button still needs wiring to `useGeolocation()` (07-01) + `useSosStore.triggerSos()` + router push to `/incidents/{id}`; the incident page exists but no in-app entry point links to it yet.
- **Heads-up for 07-04 / CI:** `frontend/eslint.config.mjs` is still deleted in the working tree and `frontend/package.json` (migration version) lacks eslint devDependencies — CI lint configuration must account for the migration state. The pnpm-lock.yaml is untracked and `frontend/node_modules` was removed after verification.

---

*Phase: 07-connect-all-the-features-of-the-frontend-with-the-backend*
*Completed: 2026-08-15*

## Self-Check: PASSED

- Files verified present: frontend/store/sos-store.ts, frontend/hooks/use-incident-socket.ts, frontend/app/incidents/[id]/page.tsx, 07-02-SUMMARY.md
- Commits verified in git log: 23ac745, f0a1401, f211332
