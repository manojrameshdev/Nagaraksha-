---
phase: 08-venomscore-and-august-15-demo-execution
plan: 03
type: execute
subsystem: ui
tags: [mediapipe, tasks-vision, recharts, zustand, msw, websocket, venomscore, ptosis, nextjs]
requires:
  - 08-01-PLAN.md (WS store fix, demo-clean frontend, pnpm workspace)
  - 08-02-PLAN.md (backend VENOM_SCORE_UPDATE broadcast + flat VenomScoreResult contract)
provides:
  - Typed VenomScore data path: PtosisReading/VenomScoreResult/SubmitPtosisResponse interfaces, submitPtosisReading + getVenomScore API helpers, VENOM_SCORE_UPDATE WS union + store branch
  - VenomScoreChart (Recharts closure-% LineChart with ReferenceLines at 40/70)
  - VenomScore MediaPipe Face Landmarker camera component (baseline, blink guard, 10s capture, single-flight submits, status machine, full cleanup)
  - Role-gated ?role=hospital pre-arrival packet on /incidents/[id] fed by store venomScore
  - MSW handlers + store/API/component tests (4 mocked MediaPipe tests)
affects: [08-04 (demo seed + two-session loop rehearsal), verify-work, demo]
actuals:
  tokens: 29480
  tasks: 4
  commits: 3
tech-stack:
  added:
    - "@mediapipe/tasks-vision (^1.0.1)"
    - "recharts (^3.10.1)"
    - "@testing-library/react (^16.3.2, dev)"
  patterns:
    - "In-effect dynamic import of @mediapipe/tasks-vision (no top-level lib import) + pinned CDN WASM/model URLs — SSR-safe, never bundled"
    - "Single-flight capture with a `busy` ref; cancelled-flag guards stale async after unmount"
    - "First-frame baseline with avg-aperture < 0.01 blink guard (stationary victim demo assumption, documented review disposition)"
key-files:
  created:
    - frontend/components/venom-score-chart.tsx
    - frontend/components/venom-score.tsx
    - frontend/store/__tests__/sos-store.test.ts
    - frontend/components/__tests__/venom-score.test.tsx
  modified:
    - frontend/package.json
    - frontend/pnpm-lock.yaml
    - frontend/pnpm-workspace.yaml
    - frontend/lib/nagraksha.ts
    - frontend/lib/realtime.ts
    - frontend/store/sos-store.ts
    - frontend/app/incidents/[id]/page.tsx
    - frontend/test/handlers.ts
    - frontend/lib/__tests__/nagraksha.test.ts
key-decisions:
  - "VENOM_SCORE_UPDATE added to the closed IncidentSocketEvent union (realtime.ts) — backend broadcasts uppercase, existing events stay lowercase; all preserved"
  - "Hospital surface built as a live role-gated packet on /incidents/[id] (?role=hospital) reading store venomScore; static HospitalWorkspace in workspaces.tsx intentionally remains the compliance/stock demo surface (documented review-HIGH disposition, not an omission)"
  - "MediaPipe model/WASM pinned to exact CDN URLs over HTTPS (T-08-03-01 mitigation); runtime-loaded only"
  - "Baseline reading submitted with baselineAperture set and percentChange null; subsequent frames carry percentChange computed against baseline"
  - "Packages verified for legitimacy (blocking human checkpoint) before install — genuine Google/Recharts/Testing Library packages"
requirements-completed: [VENOMSCORE-FE-01, VENOMSCORE-FE-02, VENOMSCORE-FE-03]
coverage:
  - id: FE1
    description: "Typed VenomScore data path — PtosisReading/VenomScoreResult/SubmitPtosisResponse types, submitPtosisReading (snake_case body) + getVenomScore helpers, VENOM_SCORE_UPDATE in the realtime union and the store updateFromWsEvent branch, MSW handlers for both venom endpoints"
    requirement: VENOMSCORE-FE-01
    verification:
      - kind: unit
        ref: "frontend/lib/__tests__/nagraksha.test.ts#venom tests (8 total)"
        status: pass
      - kind: unit
        ref: "frontend/store/__tests__/sos-store.test.ts#VENOM_SCORE_UPDATE branch + actions"
        status: pass
      - kind: other
        ref: "grep 'VENOM_SCORE_UPDATE' frontend/lib/realtime.ts frontend/store/sos-store.ts (1 each)"
        status: pass
    human_judgment: false
  - id: FE2
    description: "VenomScoreChart Recharts closure-% trend chart with ReferenceLine y=40 (Ptosis) and y=70 (Severe), null below 2 points"
    requirement: VENOMSCORE-FE-02
    verification:
      - kind: other
        ref: "grep 'ReferenceLine y={40}' + 'ReferenceLine y={70}' frontend/components/venom-score-chart.tsx"
        status: pass
    human_judgment: false
  - id: FE3
    description: "VenomScore MediaPipe camera component — LM 159/145/386/374 tracking, first-frame baseline with <0.01 blink guard, 10s interval capture, single-flight snake_case submits, status machine (idle/calibrating/tracking/no-face/error), track/interval/cancelled/landmarker cleanup on unmount, advisory footer"
    requirement: VENOMSCORE-FE-02
    verification:
      - kind: unit
        ref: "frontend/components/__tests__/venom-score.test.tsx (4 tests: baseline submit, 10s second reading, cleanup, camera-denied error)"
        status: pass
      - kind: other
        ref: "grep LM constants + setInterval(capture, 10_000) + cancelled flag + busy guard in venom-score.tsx"
        status: pass
    human_judgment: false
  - id: FE4
    description: "Role-gated hospital pre-arrival packet on /incidents/[id] — ?role=hospital renders venomType, vials, dryBiteProbability, confidenceLevel, criticalAlert, ventilator standby, clinicalBasis, disclaimer from store venomScore; victim view mounts VenomScore via next/dynamic ssr:false"
    requirement: VENOMSCORE-FE-03
    verification:
      - kind: other
        ref: "grep 'role === ''hospital''' + next/dynamic ssr:false in frontend/app/incidents/[id]/page.tsx"
        status: pass
      - kind: other
        ref: "cd frontend && npx vitest run (19 passed) && npx eslint . (0 errors) && npx next build (exit 0)"
        status: pass
    human_judgment: false
duration: 100min
completed: 2026-08-16
status: complete
---

# Phase 08 Plan 03: VenomScore Frontend Face Tracking & Hospital Packet Summary

**On-device MediaPipe Face Landmarker ptosis tracker (landmarks 159/145/386/374) with baseline + blink guard, 10s single-flight snake_case submits feeding a Recharts trend chart and a live ?role=hospital pre-arrival packet — all frontend gates green (19 tests, lint 0, build 0)**

## Performance

- **Duration:** ~100 min (commits 23:49 → 01:28 IST; resumed + closed out 2026-08-16)
- **Started:** 2026-08-15T18:19:00Z (Task 1 commit)
- **Completed:** 2026-08-16T19:58:00Z (Task 3 commit)
- **Tasks:** 4 (Task 0 blocking package checkpoint + 3 execution tasks)
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments
- **Typed end-to-end data path** — `PtosisReading` / `VenomScoreResult` (flat, uppercase venomType union) / `SubmitPtosisResponse` interfaces and `submitPtosisReading` (snake_case JSON body) / `getVenomScore` helpers in nagraksha.ts; `'VENOM_SCORE_UPDATE'` opened into the `IncidentSocketEvent` union and the `updateFromWsEvent` store branch sets `venomScore` from `data.venomScore`.
- **VenomScoreChart** — Recharts closure-% LineChart with CartesianGrid, 0–100% Y axis, Tooltip, and `ReferenceLine y={40}` ("Ptosis") / `y={70}` ("Severe") threshold guides; returns null below 2 points.
- **VenomScore camera component** — in-effect dynamic `import('@mediapipe/tasks-vision')` with pinned CDN WASM/model URLs, GPU delegate, first-frame baseline with `avg < 0.01` blink guard, 10-second `setInterval` capture, `busy` single-flight guard, severity thresholds 20/40/70, status machine (`idle`/`calibrating`/`tracking`/`no-face`/`error`), full unmount cleanup (interval, tracks, cancelled flag, landmarker close), and WHO-based advisory footer.
- **Role-gated hospital packet** — `/incidents/[id]?role=hospital` renders a live "VenomScore Pre-arrival Assessment" (venomType, estimatedAntivenomVials, dryBiteProbability %, confidenceLevel, criticalAlert banner, VENTILATOR STANDBY REQUIRED, clinicalBasis, disclaimer) from store `venomScore`; victim view mounts the tracker via `next/dynamic` with `ssr: false`.
- **Tests** — MSW handlers for both venom endpoints; nagraksha API tests; sos-store WS-branch + action tests; 4 component tests mocking `@mediapipe/tasks-vision` and `getUserMedia` (baseline submit, 10s second reading, unmount cleanup, camera-denied error). Full frontend gate green: **19 vitest tests passed, eslint 0 errors, next build exit 0**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Typed VenomScore data path — deps, union, store, chart, MSW, unit tests** - `97cf493` (feat)
2. **Task 2: MediaPipe VenomScore camera component — baseline, tracking, lifecycle** - `437cfd6` (feat)
3. **Task 3: Incident page integration, role-gated hospital packet, component tests** - `f4edc9b` (feat)

**Plan metadata:** base `593133e` (post 08-02 docs commit). Task 0 (blocking package-legitimacy human checkpoint) approved before Task 1 — all three packages verified genuine on npmjs.com.

## Files Created/Modified
- `frontend/components/venom-score-chart.tsx` - NEW — `VenomScoreChart` (Recharts, ReferenceLine 40/70, null < 2 points)
- `frontend/components/venom-score.tsx` - NEW — `VenomScore` (LM constants, baselineRef, capture loop, status machine, cleanup)
- `frontend/store/__tests__/sos-store.test.ts` - NEW — WS VENOM_SCORE_UPDATE branch + addPtosisReading/setVenomScore tests
- `frontend/components/__tests__/venom-score.test.tsx` - NEW — 4 mocked MediaPipe/getUserMedia component tests
- `frontend/lib/nagraksha.ts` - PtosisReading, VenomScoreResult, SubmitPtosisResponse; submitPtosisReading, getVenomScore
- `frontend/lib/realtime.ts` - IncidentSocketEvent union + `'VENOM_SCORE_UPDATE'`
- `frontend/store/sos-store.ts` - ptosisReadings/venomScore state; addPtosisReading/setVenomScore actions; WS branch
- `frontend/app/incidents/[id]/page.tsx` - role state, victim VenomScore mount, hospital packet section
- `frontend/test/handlers.ts` - POST reading + GET score MSW handlers
- `frontend/lib/__tests__/nagraksha.test.ts` - venom API tests
- `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/pnpm-workspace.yaml` - deps + workspace wiring

## Decisions Made
- **Union opened, casing preserved** — `'VENOM_SCORE_UPDATE'` added to the closed union; backend broadcasts uppercase while existing events remain lowercase, so all cases are kept as-is.
- **Hospital packet is live, workspaces.tsx stays static** — the review-HIGH "target does not exist" gap is closed with a real store-driven packet behind `?role=hospital`; `HospitalWorkspace` remains the compliance/stock demo surface by documented decision, not omission.
- **First-frame baseline with blink guard** — accepted (Divergent Views resolution) for the stationary-victim demo; frames with avg aperture < 0.01 are skipped rather than accepted as baseline.
- **Dynamic import + pinned CDN** — MediaPipe is loaded in-effect (no top-level import) with exact WASM/model URLs over HTTPS, keeping the bundle SSR-safe and mitigating the CDN-tampering threat (T-08-03-01).

## Deviations from Plan

None - plan executed as written. (Plan 08-03 was executed by a prior session whose 3 commits match Tasks 1-3 exactly; this run closed out the missing SUMMARY.md after verifying every acceptance gate on disk — vitest 19/19, eslint 0, next build 0, and all grep gates.)

## Issues Encountered

- **pnpm unavailable on bash PATH** — `corepack pnpm` fails its internal deps-status check (auto-runs `pnpm install`, which can't find pnpm on PATH). Worked around by invoking `npx vitest run`, `npx eslint .`, and `npx next build` directly against the installed node_modules — equivalent gates, all green. Environment note only, no code impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for **08-04** (Demo Seed Data & Integration Rehearsal): the backend broadcast contract (08-02) and the frontend typed path (08-03) both exist, so the two-session `TestVenomScoreHospitalLoop` can drive UNKNOWN → NEUROTOXIC progression end-to-end.
- The camera feature is real-device dependent; the automated rehearsal gate in 08-04 uses the backend loop test, while the two-browser manual checklist remains a human item.

---
*Phase: 08-venomscore-and-august-15-demo-execution*
*Completed: 2026-08-16*
