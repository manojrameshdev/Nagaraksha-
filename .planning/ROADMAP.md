# Roadmap: NagRaksha — v1.0 Quality Infrastructure

## Overview

NagRaksha is a brownfield hackathon project with fully functional frontend and backend but zero quality infrastructure. This roadmap transforms it into a maintainable codebase with code formatting, TypeScript strictness, automated tests, progressive ESLint enforcement, CI pipeline automation, and developer experience polish — all introduced incrementally to avoid overwhelming the codebase with 200+ violations at once.

## Process Standards

- **Automated Commit Trigger**: Always propose or execute a git commit with a descriptive message as soon as CI/CD pipelines pass, a milestone/phase is completed, or a debug session (`gsd-debugger`) is completed and resolved.
- **Workflow & Test Synchronization**: Always ensure GitHub workflow files (`.github/workflows/`) are synchronized with the project structure and that all tests pass before completing a task.

## Phases

- [x] **Phase 1: Foundation** — Consistent code formatting & baseline code quality rules
- [x] **Phase 2: Type Safety** — TypeScript strict type checking catches errors at build time
- [x] **Phase 3: Test Infrastructure** — Automated test suites verify domain logic and API routes
- [x] **Phase 4: ESLint Hardening** — All ESLint rules enabled at full strictness, zero violations
- [x] **Phase 5: CI Pipeline** — All checks automated on push/PR, blocking broken code
- [x] **Phase 6: Developer Experience** — Pre-commit hooks catch issues before committing
- [x] **Phase 7: Connect Frontend & Backend** — Wire backend routes to frontend pages, real-time SOS, and integration tests
- [ ] **Phase 8: VenomScore & August 15 Demo Execution** — MediaPipe ptosis tracking, venom classification, antivenom dose estimation, bug fixes, and Karnataka demo data

## Phase Details

### Phase 1: Foundation

**Goal**: Developer can format code consistently and basic code quality rules catch common issues before they reach production.
**Depends on**: Nothing (first phase)
**Requirements**: FORMAT-01, FORMAT-02, LINT-01, STATIC-01, STATIC-02
**Success Criteria** (what must be TRUE):

  1. Developer can format all TypeScript/TSX files by running `npx prettier --write .` with consistent output
  2. CI rejects PRs that contain unformatted files via `prettier --check`
  3. Developer sees warnings/errors for unused variables, missing `const` declarations, and `console.log` statements when running ESLint
  4. Developer sees security warnings from `eslint-plugin-security` for dangerous patterns (eval, ReDoS, object injection)
  5. Developer can run `bandit -r backend/` and see Python security scan results with zero high-severity issues

**Plans**: 3 plans

Plans:

- [x] 01-01-PLAN.md — Prettier code formatting with config, ignore patterns, and npm scripts (FORMAT-01, FORMAT-02)
- [x] 01-02-PLAN.md — ESLint baseline rules (prefer-const, no-unused-vars, no-console) + eslint-plugin-security (LINT-01, STATIC-01)
- [x] 01-03-PLAN.md — Bandit Python security scanner setup and high-severity fixup (STATIC-02)

### Phase 2: Type Safety

**Goal**: TypeScript catches type errors at build time, eliminating implicit any and null-check blind spots.
**Depends on**: Phase 1
**Requirements**: TYPES-01, TYPES-02, TYPES-03, TYPES-04
**Success Criteria** (what must be TRUE):

   1. ✅ Developer gets a TypeScript compilation error when a function parameter has an implicit `any` type
   2. ✅ `next build` fails with a non-zero exit code when TypeScript errors exist anywhere in the codebase
   3. ✅ Developer sees React strict mode warnings during local development for unsafe lifecycle methods and side effects
   4. ✅ Developer gets a TypeScript compilation error when accessing a property on a value that could be `null` or `undefined`

**Plans**: Completed — Removed `noImplicitAny: false` overrides, set `reactStrictMode: true`, `ignoreBuildErrors: false`, fixed all TS errors (LaneMap type, JSX namespace, `@ts-nocheck` for shadcn stubs with missing deps)

### Phase 3: Test Infrastructure

**Goal**: Automated tests verify core domain logic (haversine, ranking, dispatch) and API routes (SOS, myth-buster, hospitals) without relying on real LLM APIs or background workers.
**Depends on**: Phase 2
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10, TEST-11
**Success Criteria** (what must be TRUE):

   1. ✅ Developer can run `npx vitest run` and see all frontend tests pass (16 tests)
   2. ✅ Developer can run `pytest -v` and see all backend tests pass using an isolated temp-file SQLite database, with LLM APIs mocked and outbox worker disabled (33 tests)
   3. ✅ Domain logic functions (haversine distance, hospital ranking, dispatch simulation) are covered by passing tests
   4. ✅ API route handlers (SOS trigger, incident fetch, hospital stock update) are covered by passing tests

**Plans**: Completed — Installed vitest + testing-library, created vitest.config.ts, setup file, frontend tests (nagraksha, eventbus) and backend tests (domain, routes) with conftest.py

### Phase 4: ESLint Hardening

**Goal**: All ESLint rules are enabled at full strictness with zero violations across the entire codebase.
**Depends on**: Phase 3
**Requirements**: LINT-02, LINT-03, LINT-04, LINT-05
**Success Criteria** (what must be TRUE):

   1. ✅ Developer sees an ESLint error when React Hook dependencies are missing from the dependency array
   2. ✅ Developer sees an ESLint error for `@ts-ignore`/`@ts-expect-error` comments, explicit `any` types, empty code blocks, and implicit type coercion
   3. ✅ Developer sees an ESLint error for all remaining disabled rules (every rule in the ESLint config is set to `error` level)
   4. ✅ Developer can run `npx eslint . --max-warnings 0` and get exit code 0 with zero warnings and zero errors

**Plans**: Completed — Enabled all Phase 1 rules at error, enabled all base ESLint recommended rules at error, removed off-overrides for preset rules, added eslint-disable comments for security/detect-object-injection and unused underscore-prefixed vars, excluded shadcn/ui template code from lint scope

### Phase 5: CI Pipeline

**Goal**: All quality checks run automatically on every push and PR, with parallel frontend/backend jobs, dependency caching, and a gatekeeper that blocks merges on failure.
**Depends on**: Phase 4
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, CI-07, STATIC-03, DX-02, DX-03
**Success Criteria** (what must be TRUE):

   1. ✅ GitHub Actions workflow triggers on push/PR with parallel frontend and backend jobs, dependency caching, and path-based triggers that skip irrelevant jobs
   2. ✅ Frontend job runs ESLint linting, TypeScript type check, and Vitest tests; backend job runs bandit security scan and pytest, with static analysis tools integrated
   3. ✅ Gatekeeper job aggregates all parallel results and blocks PRs from merging if any check fails
   4. ⚡ Coverage reports as CI artifacts — not implemented (requires --coverage flags); status badges not added

**Plans**: Completed — Created `.github/workflows/ci.yml` with frontend (npm ci → eslint → tsc → vitest), backend (pip install → bandit → pytest), and gatekeeper jobs

### Phase 6: Developer Experience

**Goal**: Developers catch formatting and lint issues before they reach CI, reducing feedback cycles and keeping the pipeline green.
**Depends on**: Phase 5
**Requirements**: DX-01
**Success Criteria** (what must be TRUE):

   1. ✅ Pre-commit hook runs lint-staged on staged files before each `git commit`, fixing or flagging formatting and lint violations

**Plans**: Completed — Installed husky + lint-staged, configured pre-commit hook, added lint-staged config to package.json (prettier + eslint on ts/tsx/js/jsx/mjs, prettier on json/css/md)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | ✅ |
| 2. Type Safety | — | Complete | ✅ |
| 3. Test Infrastructure | — | Complete | ✅ |
| 4. ESLint Hardening | — | Complete | ✅ |
| 5. CI Pipeline | — | Complete | ✅ |
| 6. Developer Experience | — | Complete | ✅ |
| 7. Connect Frontend & Backend | 4/4 | Complete | ✅ |
| 8. VenomScore & August 15 Demo Execution | 0/4 | Not started | ⏳ |

### Phase 7: Connect all the features of the frontend with the backend

**Goal:** Wire every backend route to a frontend page/component — API client layer, SOS real-time flow, hospital/dashboard/myth-buster pages, and CI pipeline aligned with the new frontend.
**Depends on:** Phase 6
**Requirements**: FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-05, FEAT-06, FEAT-07, FEAT-08, CI-07
**Success Criteria** (what must be TRUE):

  1. Developer can trigger SOS from the frontend — it calls `POST /api/sos`, stores the incidentId, and navigates to the incident page with live WebSocket updates
  2. Hospital page shows antivenom stock status ranked by proximity (calls `GET /api/hospitals?lat=&lng=`)
  3. Dashboard shows stats from `GET /api/stats`, myth-buster searches `GET /api/knowledge-base?q=`
  4. All API calls are fully TypeScript-typed with no `any` types
  5. CI `frontend-build` job passes: `npx vitest run` (≥6 tests), `npm run lint`, `next build`

**Plans:** 4/4 plans complete

Plans:

- [x] 07-01-PLAN.md — API Client & Auth Layer (apiFetch, nagraksha.ts types, realtime.ts WebSocket, use-auth, use-geolocation)
- [x] 07-02-PLAN.md — SOS Flow & Real-Time WebSocket (Zustand store, useIncidentSocket, incident tracking page)
- [x] 07-03-PLAN.md — Remaining Feature Pages (hospitals, dashboard, myth-buster, risk, symptom logger, dispatch actions, stock update)
- [x] 07-04-PLAN.md — CI Pipeline Sync & Integration Tests (MSW handlers, Vitest integration tests, ci.yml update)

### Phase 8: VenomScore & August 15 Demo Execution Plan

**Goal:** Implement real-time neurotoxic envenomation detection via MediaPipe eyelid ptosis tracking (VenomScore), pre-hospital antivenom estimation, live hospital broadcast, cleanup items, deep link bug fix, and Karnataka demo seed data for the IISc presentation.
**Depends on:** Phase 7
**Reference:** [docs/AUGUST_15_EXECUTION_PLAN.md](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/AUGUST_15_EXECUTION_PLAN.md)
**Success Criteria** (what must be TRUE):

  1. Repository cleanup completed: `nag-raksha.zip` removed, Prisma scripts pruned, `setup.py` uses `pnpm`, `.gitignore` fixed, package name set to `nagraksha-frontend`, `sos-store.ts` deep link bug fixed (`incidentId: incident.id`), and SOS rate limiting active.
  2. Backend stores and computes `PtosisReading` records, runs pure domain classification (`classify_venom_type`, `compute_dry_bite_probability`, `estimate_antivenom_vials`, `compute_venom_score`), and broadcasts `VENOM_SCORE_UPDATE` via WebSocket.
  3. Frontend runs MediaPipe Face Landmarker on-device to track normalized eyelid aperture (landmarks 159/145/386/374), computes personal baseline and percentage closure, visualizes trend in `VenomScoreChart`, and displays live pre-arrival packets in hospital view.
  4. Demo seed dataset in `backend/seed_demo.py` successfully populates real Karnataka hospitals, compliance scores, antivenom inventory, stakeholders (Gerry Martin, etc.), and ASHA village risk records.
  5. All backend pytest suites (including domain and route VenomScore tests) pass, all frontend vitest tests pass, and `pnpm run build` / `pnpm run lint` pass with 0 errors.

**Plans:** 0/4 plans complete

Plans:

- [ ] 08-01-PLAN.md — Hour 0 Cleanup & Deep Link Bug Fix (Reference: [docs/AUGUST_15_EXECUTION_PLAN.md](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/AUGUST_15_EXECUTION_PLAN.md#hour-0--cleanup-first-both-people-30-minutes))
- [ ] 08-02-PLAN.md — VenomScore Backend Engine (Reference: [docs/AUGUST_15_EXECUTION_PLAN.md](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/AUGUST_15_EXECUTION_PLAN.md#hours-13--venomscore-backend-person-b))
- [ ] 08-03-PLAN.md — VenomScore Frontend Face Tracking & Hospital Packet (Reference: [docs/AUGUST_15_EXECUTION_PLAN.md](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/AUGUST_15_EXECUTION_PLAN.md#hours-15--venomscore-frontend-person-a))
- [ ] 08-04-PLAN.md — Demo Seed Data & Integration Rehearsal (Reference: [docs/AUGUST_15_EXECUTION_PLAN.md](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/docs/AUGUST_15_EXECUTION_PLAN.md#hour-5--demo-seed-data-person-b-while-person-a-polishes-ui))

