---
slug: ci-frontend-setup-missing
status: resolved
trigger: CI failure — Cannot find module 'frontend/src/test/setup.ts'
created: 2026-07-28
resolved: 2026-07-28
---

## Current Focus

**Hypothesis:** Missing `frontend/src/test/setup.ts` causes vitest to crash before any tests run.

**Next action:** ✅ Resolved — setup file created, all 16 tests pass.

## Symptoms

1. CI error: `Error: Cannot find module '/home/runner/work/Nagaraksha-/Nagaraksha-/frontend/src/test/setup.ts'`
2. Two test files affected: `frontend/src/lib/__tests__/eventbus.test.ts` and `frontend/src/lib/__tests__/nagraksha.test.ts`

## Evidence

- timestamp: 2026-07-28T00:00:00Z — `frontend/vitest.config.ts` line 8: `setupFiles: './src/test/setup.ts'`
- timestamp: 2026-07-28T00:00:00Z — `frontend/src/test/` directory exists but is empty (no `setup.ts` file)
- timestamp: 2026-07-28T00:00:00Z — `@testing-library/jest-dom@7.0.0` is in devDependencies
- timestamp: 2026-07-28T00:00:00Z — Test files don't use jest-dom custom matchers (no `toBeInTheDocument`, etc.), so setup can be minimal
- timestamp: 2026-07-28T00:00:00Z — `jsdom@29.1.1` is installed as test environment

## Resolution

**Root cause:** `frontend/vitest.config.ts` references `setupFiles: './src/test/setup.ts'` but the file was never created. Vitest crashes with `Cannot find module` when trying to load the setup file before running tests.

**Fix:** Created `frontend/src/test/setup.ts` with `import '@testing-library/jest-dom/vitest';` — standard vitest setup import that extends matchers for DOM assertions (matches existing devDependency `@testing-library/jest-dom@7.0.0`).

**Verification:** `cd frontend && npx vitest run` — 2 test files, 16 tests — all passed.

## Blameless Postmortem

**Why not caught:** No gate existed for setup file existence — vitest config was added but the target setup file was never scaffolded.

**Guard:** Add a CI check that verifies all files referenced in vitest config (`setupFiles`, `globalSetup`) exist before running tests. Or add a `pre-test` script that validates this.