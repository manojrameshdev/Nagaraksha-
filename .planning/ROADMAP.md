# Roadmap: NagRaksha — v1.0 Quality Infrastructure

## Overview

NagRaksha is a brownfield hackathon project with fully functional frontend and backend but zero quality infrastructure. This roadmap transforms it into a maintainable codebase with code formatting, TypeScript strictness, automated tests, progressive ESLint enforcement, CI pipeline automation, and developer experience polish — all introduced incrementally to avoid overwhelming the codebase with 200+ violations at once.

## Phases

- [ ] **Phase 1: Foundation** — Consistent code formatting & baseline code quality rules
- [ ] **Phase 2: Type Safety** — TypeScript strict type checking catches errors at build time
- [ ] **Phase 3: Test Infrastructure** — Automated test suites verify domain logic and API routes
- [ ] **Phase 4: ESLint Hardening** — All ESLint rules enabled at full strictness, zero violations
- [ ] **Phase 5: CI Pipeline** — All checks automated on push/PR, blocking broken code
- [ ] **Phase 6: Developer Experience** — Pre-commit hooks catch issues before committing

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
**Plans**: TBD

### Phase 2: Type Safety
**Goal**: TypeScript catches type errors at build time, eliminating implicit any and null-check blind spots.
**Depends on**: Phase 1
**Requirements**: TYPES-01, TYPES-02, TYPES-03, TYPES-04
**Success Criteria** (what must be TRUE):
  1. Developer gets a TypeScript compilation error when a function parameter has an implicit `any` type
  2. `next build` fails with a non-zero exit code when TypeScript errors exist anywhere in the codebase
  3. Developer sees React strict mode warnings during local development for unsafe lifecycle methods and side effects
  4. Developer gets a TypeScript compilation error when accessing a property on a value that could be `null` or `undefined`
**Plans**: TBD

### Phase 3: Test Infrastructure
**Goal**: Automated tests verify core domain logic (haversine, ranking, dispatch) and API routes (SOS, myth-buster, hospitals) without relying on real LLM APIs or background workers.
**Depends on**: Phase 2
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08, TEST-09, TEST-10, TEST-11
**Success Criteria** (what must be TRUE):
  1. Developer can run `npx vitest run` and see all frontend tests pass
  2. Developer can run `pytest -v` and see all backend tests pass using an isolated temp-file SQLite database, with LLM APIs mocked and outbox worker disabled
  3. Domain logic functions (haversine distance, hospital ranking, dispatch simulation) are covered by passing tests
  4. API route handlers (SOS trigger, myth-buster RAG, hospital stock update) are covered by passing tests
**Plans**: TBD

### Phase 4: ESLint Hardening
**Goal**: All ESLint rules are enabled at full strictness with zero violations across the entire codebase.
**Depends on**: Phase 3
**Requirements**: LINT-02, LINT-03, LINT-04, LINT-05
**Success Criteria** (what must be TRUE):
  1. Developer sees an ESLint error when React Hook dependencies are missing from the dependency array
  2. Developer sees an ESLint error for `@ts-ignore`/`@ts-expect-error` comments, explicit `any` types, empty code blocks, and implicit type coercion
  3. Developer sees an ESLint error for all remaining disabled rules (every rule in the ESLint config is set to `error` level)
  4. Developer can run `npx eslint . --max-warnings 0` and get exit code 0 with zero warnings and zero errors
**Plans**: TBD

### Phase 5: CI Pipeline
**Goal**: All quality checks run automatically on every push and PR, with parallel frontend/backend jobs, dependency caching, and a gatekeeper that blocks merges on failure.
**Depends on**: Phase 4
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, CI-07, STATIC-03, DX-02, DX-03
**Success Criteria** (what must be TRUE):
  1. GitHub Actions workflow triggers on push/PR with parallel frontend and backend jobs, dependency caching, and path-based triggers that skip irrelevant jobs
  2. Frontend job runs ESLint linting, TypeScript type check, and Vitest tests; backend job runs bandit security scan and pytest, with static analysis tools integrated
  3. Gatekeeper job aggregates all parallel results and blocks PRs from merging if any check fails
  4. Coverage reports are generated as CI artifacts and README shows live CI status badges
**Plans**: TBD

### Phase 6: Developer Experience
**Goal**: Developers catch formatting and lint issues before they reach CI, reducing feedback cycles and keeping the pipeline green.
**Depends on**: Phase 5
**Requirements**: DX-01
**Success Criteria** (what must be TRUE):
  1. Pre-commit hook runs lint-staged on staged files before each `git commit`, fixing or flagging formatting and lint violations
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/0 | Not started | - |
| 2. Type Safety | 0/0 | Not started | - |
| 3. Test Infrastructure | 0/0 | Not started | - |
| 4. ESLint Hardening | 0/0 | Not started | - |
| 5. CI Pipeline | 0/0 | Not started | - |
| 6. Developer Experience | 0/0 | Not started | - |
