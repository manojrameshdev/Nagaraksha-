---
status: resolved
trigger: CI vitest run fails on all 5 frontend test files with "TypeError: webidl.util.markAsUncloneable is not a function" (undici CacheStorage), "no tests / 5 errors / exit 1"
created: 2026-08-16
updated: 2026-08-16
---

# Debug Session: ci-vitest-undici-node20

## Symptoms

- GitHub Actions `frontend-build` job, "Run Vitest" step, fails with exit code 1.
- Vitest 4.1.10 reports "Unhandled Errors" for all 5 test files:
  - components/__tests__/venom-score.test.tsx
  - components/__tests__/care-corridor-timeline.test.tsx
  - lib/__tests__/nagraksha.test.ts
  - store/__tests__/sos-store.test.ts
  - lib/__tests__/api.test.ts
- Every worker fails to start: "[vitest-pool]: Failed to start forks worker for test files ..."
- Caused by: `TypeError: webidl.util.markAsUncloneable is not a function`
  - `new CacheStorage` at `undici/lib/web/cache/cachestorage.js:20`
  - loaded from `jsdom/lib/api.js:12` (jsdom requires undici at module load)
- Summary: Test Files no tests / Tests no tests / Errors 5 errors / exit code 1.
- Warning present but unrelated: Vite config ESM-in-CJS (`configLoader: 'native'`) warning.

## Environment

- CI: ubuntu-latest, Node.js 20 (`node-version: '20'`), pnpm 9, `pnpm install --frozen-lockfile`.
- Local: Windows, Node v22.19.0.
- Versions: vitest 4.1.10, jsdom 30.0.1, undici 8.10.0, msw 2.15.0, vite 8.2.1.

## Current Focus

- hypothesis: CI runs Node 20, but undici 8.10.0 (pulled in by jsdom 30.0.1, which declares `undici: ^8.9.0`) requires Node >= 22.19.0 and calls `node:worker_threads.markAsUncloneable`, which does not exist on Node 20 -> CacheStorage constructor throws at module load -> jsdom env fails -> every vitest worker crashes.
- test: (a) confirm undici 8.10.0 imports markAsUncloneable from node:worker_threads (verified, webidl/index.js:5); (b) confirm jsdom 30.0.1 declares undici ^8.9.0 (verified); (c) confirm local suite passes on Node 22.19.0 (verified: 5 files, 27 tests pass).
- expecting: bumping CI Node to >= 22.19.0 (or pinning undici to 6.x) makes the suite green.
- next_action: choose fix strategy with user (bump CI Node vs pin dependencies), apply, verify.
- reasoning_checkpoint: not applicable (no subagent spawn; inline debugging).

## Evidence

- timestamp: 2026-08-16 — ci.yml: `node-version: '20'` for frontend-build job; vitest run via `npx vitest run`.
- timestamp: 2026-08-16 — frontend/pnpm-lock.yaml: `jsdom@30.0.1(@noble/hashes@1.8.0)` lists `undici: 8.10.0`; `undici@8.10.0: engines: {node: '>=22.19.0'}`.
- timestamp: 2026-08-16 — frontend/node_modules/.pnpm/jsdom@30.0.1*/jsdom/package.json:41: `"undici": "^8.9.0"`.
- timestamp: 2026-08-16 — frontend/node_modules/.pnpm/undici@8.10.0*/undici/lib/web/cache/cachestorage.js:20: `webidl.util.markAsUncloneable(this)`.
- timestamp: 2026-08-16 — undici lib/web/webidl/index.js:5: `const { markAsUncloneable } = require('node:worker_threads')`; line 161 assigns it to `webidl.util.markAsUncloneable`. API added in Node 22.19.0.
- timestamp: 2026-08-16 — Local `npx vitest run` on Node v22.19.0: 5 files passed, 27 tests passed. CI-only failure.
- timestamp: 2026-08-16 — Web search: known issue — undici >= 8.0.3 breaks on runtimes without `markAsUncloneable` (nodejs/undici#5024; bun#29423); librefang CHANGELOG: "runtime incompatibility rather than a test failure — same suite passes on a Node 24 host".
- timestamp: 2026-08-16 — Engine constraints: vitest 4.1.10 `^20.0.0 || ^22.0.0 || >=24.0.0`; vite 8.2.1 `^20.19.0 || >=22.12.0`; undici 8.10.0 `>=22.19.0`. Node 20 satisfies vitest+vite but violates undici.

## Eliminated

- hypothesis: "Vitest config / test code bug" — ELIMINATED: all 5 test files fail identically with the same undici crash before any test code runs; suite passes locally on Node 22.19.0.
- hypothesis: "Missing test setup file" — ELIMINATED: setup runs fine; the crash is in jsdom's module load (undici CacheStorage), not the setup.

## Resolution

- root_cause: CI runs Node 20, but jsdom 30.0.1 (declares `undici: ^8.9.0`) resolves undici 8.10.0, which requires Node >= 22.19.0 (`engines`) and calls `node:worker_threads.markAsUncloneable` (added in Node 22.19.0) in its CacheStorage constructor. On Node 20 the API is undefined -> `TypeError: webidl.util.markAsUncloneable is not a function` at module load -> jsdom environment fails -> every vitest forks worker crashes -> "no tests / 5 errors / exit 1".
- fix: Bump the frontend-build job in `.github/workflows/ci.yml` from `node-version: '20'` to `'24'` (user-selected strategy). Node 24 satisfies all lockfile engines (undici >=22.19.0, vite >=22.12.0, vitest >=24.0.0) and matches local dev (@types/node ^24).
- verification: Local suite on Node v22.19.0 (the undici minimum): 5 test files / 27 tests all pass, proving the tests themselves are sound and the failure is purely the Node-version mismatch. Node 24 engine checks verified against installed package.json engines for undici/vite/vitest.
- files_changed: .github/workflows/ci.yml
