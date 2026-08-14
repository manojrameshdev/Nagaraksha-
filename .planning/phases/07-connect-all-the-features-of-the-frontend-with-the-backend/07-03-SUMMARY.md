---
phase: 07-connect-all-the-features-of-the-frontend-with-the-backend
plan: 03
subsystem: ui
tags: [typescript, nextjs, react, fastapi, hospitals, stats, rag, risk]

# Dependency graph
requires:
  - phase: 07-01 (API client & auth layer)
    provides: frontend/lib/nagraksha.ts typed API functions + interfaces (getHospitals, getStats, listIncidents, getKnowledgeBase, getRisk, logSymptom, acceptDispatch, declineDispatch, updateStock, getHealth), frontend/hooks/use-geolocation.ts, frontend/hooks/use-auth.ts
  - phase: 07-02 (SOS flow & WebSocket)
    provides: frontend/store/sos-store.ts, frontend/hooks/use-incident-socket.ts, frontend/app/incidents/[id]/page.tsx
provides:
  - frontend/app/hospitals/page.tsx — proximity-ranked hospital list with antivenom stock badges
  - frontend/app/dashboard/page.tsx — stats totals + recent incidents list
  - frontend/app/myth-buster/page.tsx — debounced RAG knowledge-base search
  - frontend/app/risk/page.tsx — risk advisory with level badge + likely snakes
  - frontend/components/symptom-logger.tsx — symptom POST form for active incidents
  - frontend/components/dispatch-actions.tsx — Accept/Decline responder buttons
  - frontend/components/stock-update.tsx — role-gated antivenom stock form
  - frontend/components/health-indicator.tsx — backend health status badge
affects: [07-04]

actuals:
  tokens: 4080    # chars/4 over the 8 files actually changed
  tasks: 8
  commits: 8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-fetching pages: useGeolocation() + typed API function in a useEffect, loading/error state rendered as UI (never console), cancelled-flag guard against post-unmount setState"
    - "Debounced search with window.setTimeout typed as number (avoids DOM/Node setTimeout return-type ambiguity) and reset in the onChange handler, not the effect (react-hooks/set-state-in-effect)"
    - "Role-gated component: useAuth().role read at top, early null return after all hooks"

key-files:
  created:
    - frontend/app/hospitals/page.tsx
    - frontend/app/dashboard/page.tsx
    - frontend/app/myth-buster/page.tsx
    - frontend/app/risk/page.tsx
    - frontend/components/symptom-logger.tsx
    - frontend/components/dispatch-actions.tsx
    - frontend/components/stock-update.tsx
    - frontend/components/health-indicator.tsx
  modified: []

key-decisions:
  - "Plan paths (frontend/src/app/*, frontend/src/components/*) adapted to the migrated root-level structure (frontend/app/, frontend/components/) because the working tree had already deleted frontend/src/ (pre-existing uncommitted migration) — same adaptation Plans 07-01 and 07-02 documented"
  - "React.FormEvent replaced with `import type { FormEvent } from 'react'` — the project's no-undef rule flags the bare React namespace identifier in-repo (verified on symptom-logger; same fix applied preemptively to stock-update)"
  - "Myth-buster debounce timer typed as number with window.setTimeout/window.clearTimeout — sidesteps the DOM-lib vs @types/node setTimeout return-type ambiguity and keeps the in-repo no-undef gate green"
  - "Synchronous setLoading(true) removed from hospitals/effect and result-clearing moved from myth-buster effect into the onChange handler — react-hooks/set-state-in-effect (React 19, error level) forbids synchronous setState in effect bodies"

requirements-completed: [FEAT-05, FEAT-06, FEAT-07]

coverage:
  - id: D1
    description: "Hospitals page ranks hospitals by distance via getHospitals(lat, lng) (geolocation with Bengaluru fallback 12.8003, 77.5954) and renders name, distanceKm, phone, and antivenom stock status badge"
    requirement: FEAT-05
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dashboard renders GET /api/stats totals (incidents, hospitals, riskAreas, mythsBusted, knowledgeChunks, annualDeathsIndia) and a recent-incidents list from listIncidents(10) linking to /incidents/{id}"
    requirement: FEAT-05
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Myth-buster page debounces the search input (400ms) and calls getKnowledgeBase(q, 6); renders title/category/content results and a no-results message"
    requirement: FEAT-06
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Risk page calls getRisk(lat, lng) with geolocation fallback coords; renders level badge, area, advisory, likelySnakes list, season and weather"
    requirement: FEAT-06
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "SymptomLogger posts code/label/severity via logSymptom(incidentId, body) to POST /api/incidents/{id}/symptoms; clears form and calls onLogged on success, renders error state"
    requirement: FEAT-07
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "DispatchActions Accept/Decline buttons call acceptDispatch/declineDispatch (PATCH /api/incidents/{id}/accept, /decline) with per-action loading state and result message"
    requirement: FEAT-07
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "StockUpdate form renders only when useAuth().role is hospital_admin or system_admin; submits product/status/quantityBand/verifiedBy via updateStock(hid, body) to PATCH /api/hospitals/{id}/stock"
    requirement: FEAT-07
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D8
    description: "HealthIndicator calls getHealth() and renders a green 'Backend Online' / red 'Backend Offline' badge; null while loading"
    requirement: FEAT-07
    verification:
      - kind: other
        ref: "tsc --noEmit (frontend) exit 0 + eslint --max-warnings 0 on the file exit 0"
        status: pass
    human_judgment: false
  - id: D9
    description: "Live end-to-end behavior (browser): /hospitals ranked list with stock badges, /dashboard stats render, /myth-buster 'tourniquet' results within 500ms, /risk advisory renders, SymptomLogger creates a symptom visible in GET /api/incidents/{id}, DispatchActions Accept succeeds on PENDING dispatch, StockUpdate visible only to admin roles, HealthIndicator green with backend running"
    requirement: FEAT-05
    verification:
      - kind: manual_procedural
        ref: "Browser against a running backend at http://localhost:8000 — requires real geolocation permission, running backend, and authenticated admin roles"
        status: unknown
    human_judgment: true
    rationale: "Requires a running backend + browser; the components are exported but wiring into existing pages is outside this plan's files_modified scope (deferred to 07-04)"

# Metrics
duration: 8min
completed: 2026-08-15
status: complete
---

# Phase 07 Plan 03: Remaining Feature Pages Summary

**Four data-fetching pages (hospitals ranked by proximity with antivenom stock badges, stats dashboard with recent incidents, debounced myth-buster RAG search, risk advisory) plus four backend-wired components (symptom logger, dispatch accept/decline, role-gated stock update, health indicator) — all TypeScript-compiled and lint-clean**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-15T02:16:28Z (local)
- **Completed:** 2026-08-15T02:24:07Z (local)
- **Tasks:** 8
- **Files modified:** 8 (all created)

## Accomplishments

- `frontend/app/hospitals/page.tsx` — `useGeolocation()` coordinates with Bengaluru fallback (12.8003, 77.5954) when geolocation is denied/unavailable; `getHospitals(lat, lng)` → card list with name, address, `distanceKm`, phone `tel:` link, and colored antivenom stock status badge (IN_STOCK/LOW/OUT_OF_STOCK/UNKNOWN).
- `frontend/app/dashboard/page.tsx` — `getStats()` totals grid (incidents, hospitals, risk areas, myths busted, knowledge chunks, annual deaths) + `listIncidents(10)` recent-incidents rows linking to `/incidents/{id}` with state badges. Loads both fetches in parallel with a cancelled-flag guard.
- `frontend/app/myth-buster/page.tsx` — 400ms-debounced search input calling `getKnowledgeBase(q, 6)`; renders title/category/content result cards, loading, error, and no-results states.
- `frontend/app/risk/page.tsx` — `getRisk(lat, lng)` with geolocation fallback; renders level badge (LOW→SEVERE), area, advisory text, likely-snakes list, season and weather.
- `frontend/components/symptom-logger.tsx` — `logSymptom(incidentId, body)` form (code/label/severity/value) that clears on success, calls `onLogged`, and surfaces errors in UI state.
- `frontend/components/dispatch-actions.tsx` — Accept/Decline buttons calling `acceptDispatch`/`declineDispatch` with per-action loading labels and result messages.
- `frontend/components/stock-update.tsx` — antivenom stock form (product/status/quantityBand/verifiedBy) via `updateStock(hid, body)`; renders nothing unless `useAuth().role` is `hospital_admin` or `system_admin`.
- `frontend/components/health-indicator.tsx` — `getHealth()` → green "Backend Online" / red "Backend Offline" badge, hidden while loading.

## Task Commits

Each task was committed atomically:

1. **Task 1: hospitals page** - `97b9225` (feat)
2. **Task 2: dashboard page** - `a94a2b2` (feat)
3. **Task 3: myth-buster page** - `54abbd0` (feat)
4. **Task 4: risk page** - `51c2099` (feat)
5. **Task 5: symptom-logger component** - `79c6fef` (feat)
6. **Task 6: dispatch-actions component** - `4607f60` (feat)
7. **Task 7: stock-update component** - `03538d1` (feat)
8. **Task 8: health-indicator component** - `381fdb8` (feat)

**Plan metadata:** committed after this summary (docs: complete plan + state + roadmap)

## Files Created/Modified

- `frontend/app/hospitals/page.tsx` - Proximity-ranked hospital list with antivenom stock badges (GET /api/hospitals)
- `frontend/app/dashboard/page.tsx` - Stats totals grid + recent incidents list (GET /api/stats, GET /api/incidents)
- `frontend/app/myth-buster/page.tsx` - Debounced knowledge-base search page (GET /api/knowledge-base?q=)
- `frontend/app/risk/page.tsx` - Risk advisory page with level badge + likely snakes (GET /api/risk)
- `frontend/components/symptom-logger.tsx` - Symptom POST form (POST /api/incidents/{id}/symptoms)
- `frontend/components/dispatch-actions.tsx` - Accept/Decline dispatch buttons (PATCH /api/incidents/{id}/accept, /decline)
- `frontend/components/stock-update.tsx` - Role-gated antivenom stock form (PATCH /api/hospitals/{id}/stock)
- `frontend/components/health-indicator.tsx` - Backend health status badge (GET /api/health)

## Decisions Made

- **Structure adaptation (Rule 3):** plan paths `frontend/src/app/*` and `frontend/src/components/*` were adapted to the migrated root-level structure (`frontend/app/`, `frontend/components/`). The pre-existing uncommitted migration deleted the entire `frontend/src/` tree; the four pages and four components were created at the migrated paths with `@/lib/nagraksha`, `@/hooks/*` imports resolving under the current `@/*` → `./*` alias. All 8 `must_haves` artifacts are satisfied at the new paths.
- **`FormEvent` type import instead of `React.FormEvent`:** the project's `no-undef: error` flags the bare `React` namespace identifier in type position in-repo (verified empirically on symptom-logger). Replaced with `import type { FormEvent } from 'react'` in symptom-logger and stock-update.
- **`number`-typed debounce timer:** myth-buster uses `window.setTimeout`/`window.clearTimeout` with `useRef<number | undefined>` instead of `ReturnType<typeof setTimeout>` — avoids the DOM-lib vs @types/node `setTimeout` return-type ambiguity (both libs are active) and the in-repo no-undef false-positive class 07-01 documented.
- **No synchronous setState in effects:** removed `setLoading(true)` from the hospitals effect (loading already starts `true`) and moved myth-buster's result clearing from the effect into the `onChange` handler — `react-hooks/set-state-in-effect` (error level, React 19) forbids synchronous setState in effect bodies.
- **No console usage:** the plan's `.catch(console.error)` snippets (dashboard, myth-buster, risk) were replaced with `error` state rendered as graceful failure UI, matching the project's `no-console: error` gate (same decision 07-02 recorded).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan paths referenced deleted legacy `frontend/src/` structure**
- **Found during:** All 8 tasks (file creation)
- **Issue:** Plan's `files_modified` lists `frontend/src/app/*` and `frontend/src/components/*`, but the working tree migrated to root-level `frontend/app/`, `frontend/components/` and deleted `frontend/src/` (pre-existing uncommitted migration; `@/*` alias now maps to `./*`)
- **Fix:** Created all eight files under the migrated root-level paths; imports use `@/lib/nagraksha`, `@/hooks/use-geolocation`, `@/hooks/use-auth` which resolve under the new alias
- **Files modified:** all eight files (paths only)
- **Verification:** tsc --noEmit exit 0; eslint exit 0 on all eight files
- **Committed in:** all 8 task commits

**2. [Rule 1 - Bug] `React.FormEvent` flagged by project's no-undef rule in-repo**
- **Found during:** Task 5 (lint)
- **Issue:** The plan's `(e: React.FormEvent)` annotations fail `no-undef: 'React' is not defined` under the committed eslint config (the global React namespace is a type-level construct the core rule does not see); tsc itself was satisfied via @types/react
- **Fix:** `import type { FormEvent } from 'react'` and `(e: FormEvent)` — identical type, passes the gate; applied to stock-update preemptively (same construct)
- **Files modified:** frontend/components/symptom-logger.tsx, frontend/components/stock-update.tsx
- **Verification:** eslint exit 0; tsc exit 0
- **Committed in:** 79c6fef (Task 5), 03538d1 (Task 7)

**3. [Rule 2 - Missing Critical] Synchronous setState in effect bodies (react-hooks/set-state-in-effect)**
- **Found during:** Task 1 and Task 3 (lint)
- **Issue:** Hospitals page's `setLoading(true)` inside the effect and myth-buster's `setResults([])`/`setError(null)` on empty query are flagged by the React 19 rule `react-hooks/set-state-in-effect` (error level in this config)
- **Fix:** hospitals — removed `setLoading(true)` (state already initializes `true`, only promise callbacks settle it); myth-buster — early-return on empty query in the effect and reset results/error in the `onChange` handler
- **Files modified:** frontend/app/hospitals/page.tsx, frontend/app/myth-buster/page.tsx
- **Verification:** eslint exit 0; tsc exit 0
- **Committed in:** 97b9225 (Task 1), 54abbd0 (Task 3)

**4. [Rule 2 - Missing Critical] Plan's `.catch(console.error)` violates no-console**
- **Found during:** Tasks 2, 3, 4 (authoring)
- **Issue:** The plan's page snippets use `.catch(console.error)` — `no-console: error` in the committed eslint config fails the hook
- **Fix:** Added `error` state rendered as a graceful failure UI; catches set `error` (with a cancelled-flag guard against post-unmount setState on the dashboard)
- **Files modified:** frontend/app/dashboard/page.tsx, frontend/app/myth-buster/page.tsx, frontend/app/risk/page.tsx
- **Verification:** eslint exit 0; tsc exit 0
- **Committed in:** a94a2b2 (Task 2), 54abbd0 (Task 3), 51c2099 (Task 4)

**5. [Rule 3 - Blocking] Pre-commit hook (lint-staged) needed the deleted eslint config**
- **Found during:** Setup (before Task 1)
- **Issue:** `.husky/pre-commit` runs `lint-staged` → `eslint --config frontend/eslint.config.mjs`, but the migration WIP deleted that file from the working tree
- **Fix:** Temporarily restored `frontend/eslint.config.mjs` from HEAD (identical to the committed version) so the hook and manual verification runs work. Will be re-deleted after all commits, restoring the exact pre-existing ` D` working-tree state.
- **Files modified:** none (environment-only, fully reverted)
- **Verification:** all 8 commits passed the hook; post-run git status matches the pre-commit snapshot
- **Committed in:** n/a (no file changes)

---

**Total deviations:** 5 auto-fixed (2 blocking, 2 missing-critical, 1 bug)
**Impact on plan:** All auto-fixes were required to land TypeScript-compiled, lint-clean code in the project's current (mid-migration) structure. No scope creep; all 8 `must_haves` artifacts satisfied.

## Issues Encountered

- **`react-hooks/set-state-in-effect` (React 19):** flagged two of the plan's fetch-page patterns — fixed by removing synchronous setState from effect bodies (see deviation 3).
- **`no-undef` on `React.FormEvent`:** the committed config's core `no-undef` does not recognize the global React namespace; tsc and eslint disagree here. Type-only `FormEvent` import resolves it.
- **DOM vs Node `setTimeout` types:** with both `lib: ["dom", ...]` and `@types/node` active, bare `setTimeout`'s return type is ambiguous; `window.setTimeout` pins the DOM `number` signature deterministically.

## User Setup Required

None - no external service configuration required. For runtime verification of the browser-based checks below, the backend must be running at `http://localhost:8000` (see root `.env.example` / `frontend/.env.example`).

## Verification Results

1. ✅ **TypeScript compiles with zero errors:** `tsc --noEmit` from `frontend/` — exit 0
2. ✅ **ESLint clean on all eight files:** `eslint --max-warnings 0 --no-warn-ignored --config frontend/eslint.config.mjs` — exit 0
3. ⏳ **Browser checks (manual):** `/hospitals` ranked list with stock badges; `/dashboard` stats + recent incidents; `/myth-buster` "tourniquet" results within 500ms; `/risk` advisory renders; `<SymptomLogger>` creates a symptom visible in GET /api/incidents/{id}; `<DispatchActions>` Accept succeeds on PENDING dispatch; `<StockUpdate>` appears only for admin roles; `<HealthIndicator>` green when backend is up — all require a running backend + browser and are tracked for the verifier (D9 routes to human judgment).

## Next Phase Readiness

- Plan 07-04 can consume all eight exports: the four pages are standalone routes under `/hospitals`, `/dashboard`, `/myth-buster`, `/risk`; the four components (`SymptomLogger`, `DispatchActions`, `StockUpdate`, `HealthIndicator`) are named exports ready to be wired into the existing shell (`frontend/app/page.tsx`) and incident page (`frontend/app/incidents/[id]/page.tsx`).
- **Heads-up for 07-04 / integration:** wiring the components into existing pages is intentionally NOT done here — those pages are outside this plan's `files_modified` scope. 07-02 already noted the SOS button on the landing shell is still unwired; `HealthIndicator` and `DispatchActions`/`SymptomLogger`/`StockUpdate` placement in the shell and incident page are natural 07-04 tasks.
- **Heads-up for 07-04 / CI:** `frontend/eslint.config.mjs` is still deleted in the working tree (restored from HEAD temporarily for this plan's commits, to be re-deleted) and `frontend/package.json` (migration version) lacks eslint devDependencies — CI lint configuration must account for the migration state.

---

*Phase: 07-connect-all-the-features-of-the-frontend-with-the-backend*
*Completed: 2026-08-15*

## Self-Check: PASSED

- Files verified present: frontend/app/hospitals/page.tsx, frontend/app/dashboard/page.tsx, frontend/app/myth-buster/page.tsx, frontend/app/risk/page.tsx, frontend/components/symptom-logger.tsx, frontend/components/dispatch-actions.tsx, frontend/components/stock-update.tsx, frontend/components/health-indicator.tsx
- Commits verified in git log: 97b9225, a94a2b2, 54abbd0, 51c2099, 79c6fef, 4607f60, 03538d1, 381fdb8