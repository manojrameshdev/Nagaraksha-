# Project Research Summary

**Project:** NagRaksha — CI/CD Quality Infrastructure for Brownfield Hackathon Project
**Domain:** Dual-language (Next.js 16 + FastAPI + SQLite) web application with LLM integration
**Researched:** 2026-07-26
**Confidence:** HIGH

## Executive Summary

NagRaksha is a brownfield hackathon project with accumulated technical debt: 18+ ESLint rules disabled, `noImplicitAny: false`, `ignoreBuildErrors: true`, no test suite, no CI pipeline, and architectural inconsistencies (dual event bus, duplicate domain logic across TypeScript and Python). The research covers adding professional-grade CI/CD quality infrastructure — ESLint enforcement, TypeScript strict mode, Vitest + pytest test frameworks, static analysis (eslint-plugin-security + bandit), Prettier formatting, and a GitHub Actions pipeline — to a codebase that has never had quality gates.

**The recommended approach is incremental.** Enabling all quality checks at once would produce 200+ lint violations and 30+ TypeScript errors, overwhelming the team and risking abandonment of the entire quality initiative. Instead, the research prescribes a phased rollout: start with formatting consistency (Prettier) and the safest ESLint rules (Wave 1), then build test infrastructure with proper SQLite isolation fixtures, then progressively tighten TypeScript strictness and ESLint rules over 4 waves, and finally wire it all together in a parallelized CI pipeline with a gatekeeper pattern to handle path-skipping correctly.

**Key risks** center on three areas: (1) **SQLite test isolation** — the most critical architectural decision for backend testing, as in-memory databases are per-connection and will cause route handler tests to fail silently without a `conftest.py` that monkeypatches `get_conn()` to use a shared temp file; (2) **TypeScript strict migration** — must be done in sub-phases (`noImplicitAny` first, `strictNullChecks` last) with a `tsconfig.strict.json` whitelist approach to avoid a "wall of red" that stalls feature work; and (3) **LLM API mocking** — tests must mock Grok/Gemini providers from day one, or the pipeline will be at the mercy of rate limits, network issues, and API changes.

## Key Findings

### Recommended Stack

The stack is entirely additive — nothing existing is replaced. New tools layer on top of the current Next.js 16 + FastAPI + SQLite architecture.

**Core additions:**

| Layer | Technology | Purpose | Why |
|-------|-----------|---------|-----|
| **TS Test Runner** | Vitest ^4.1.10 | TypeScript unit tests | Faster than Jest, native ESM, official Next.js 16 recommendation |
| **React Testing** | @testing-library/react ^16.3.2 | Component testing | Tests by user behavior, not implementation; React team recommended |
| **Python Test Runner** | pytest ^9.1.1 | Python unit/integration tests | Standard ecosystem, fixture system, FastAPI TestClient integration |
| **Python Coverage** | pytest-cov ^6.x | Coverage reporting | pytest plugin, HTML/XML/terminal output, per-module thresholds |
| **TS Formatter** | Prettier ^3.9.6 | Code formatting | Eliminates style discussions; one-time format commit then CI enforcement |
| **TS Security Lint** | eslint-plugin-security ^4.0.1 | Security hotspot detection | Flat config compatible, catches eval/ReDoS/object injection |
| **Python Security** | bandit ^1.9.4 | Python security static analysis | 47 checks, AST-based, SARIF output for Code Scanning |
| **CI Platform** | GitHub Actions | CI/CD | Native GitHub, free tier (2000 min/month), public repos unlimited |
| **Node Setup** | actions/setup-node @v6 | Node.js in CI | Built-in npm caching, cache-dependency-path support |
| **Python Setup** | actions/setup-python @v5 | Python in CI | Built-in pip caching |

**Key integration points:** Vitest uses `@vitejs/plugin-react` with jsdom environment; pytest uses a `conftest.py` fixture that creates a temporary SQLite database via `tmp_path` and monkeypatches `get_conn()` to ensure route handlers and fixtures share the same database file. See [STACK.md](./STACK.md) for full configuration details.

### Expected Features

**Must have (table stakes) — v1.0 milestone:**

| Feature | Complexity | Notes |
|---------|------------|-------|
| ESLint enforcement | MEDIUM | Re-enable 18+ disabled rules in 4 waves; fix existing violations first |
| TypeScript type checking | MEDIUM | `noImplicitAny: true`, remove `ignoreBuildErrors: true` — 30+ errors expected |
| Passing test suite | MEDIUM | No tests exist; create Vitest + pytest infrastructure from scratch |
| CI blocks broken PRs | LOW | Single workflow with gatekeeper pattern |
| Python lint enforcement | LOW | bandit for security; integrated into CI workflow |
| Frontend build validation | LOW | `next build` must pass (after fixing TypeScript errors) |

**Should have (competitive) — v1.0-/v1.1:**

| Feature | Value | Complexity |
|---------|-------|------------|
| Coverage reporting | Visibility into untested code | LOW |
| Security scanning (frontend + backend) | Catch vulnerabilities before merge | LOW |
| Dependency caching | 40-60% CI speed improvement | LOW |
| Parallel frontend + backend CI jobs | ~3 min wall time vs ~25 min serial | LOW |
| PR status badges | Visual CI health on README | LOW |
| Pre-commit hooks (Husky + lint-staged) | Catch issues before CI | MEDIUM |

**Defer (v2+):**

| Feature | Why Deferred |
|---------|--------------|
| E2E tests with Playwright | No unit tests exist yet; E2E is expensive, flaky in CI |
| Code coverage threshold (blocking) | Premature on zero-test codebase; must build baseline first (2-3 sprints) |
| SonarQube/SonarCloud | Overkill for ~19 Python + ~40 TypeScript files |
| Production CD pipeline | Out of scope per PROJECT.md |
| Performance/load testing | Out of scope per PROJECT.md |
| Dagger programmable CI | Emerging pattern; not yet proven enough for this codebase |

**Anti-features to avoid:** Blocking PRs on coverage thresholds (will fail immediately), enabling full strict mode TypeScript on day 1 (200+ errors), running E2E in CI before unit tests (expensive flakiness), and blocking on npm audit warnings (noise without action).

### Architecture Approach

The architecture uses a **single GitHub Actions workflow with parallel frontend/backend jobs** plus a **gatekeeper job** that aggregates results. This avoids the "skipped status check blocks merge" problem that plagues path-filtered workflows. The pipeline stages run: lint → typecheck → test → build (with build optional until TypeScript strict mode passes).

**Major components:**

1. **CI Pipeline** (`.github/workflows/ci.yml`) — Parallel frontend (Node 22) and backend (Python 3.12) jobs with path-based triggers via `dorny/paths-filter@v3`, cancel-in-progress concurrency, and dependency caching at both Node and pip levels.

2. **Test Infrastructure** — **Co-located test files** (`.test.ts` next to source, not `__tests__/`). Frontend: Vitest 4.x with jsdom, `@testing-library/react`, and a `setup.ts` that mocks `IntersectionObserver` and `matchMedia`. Backend: pytest with a session-scoped `conftest.py` that creates a temp SQLite database, monkeypatches `get_conn()` to share the same file between fixtures and route handlers, and disables the outbox worker thread via `monkeypatch`.

3. **Code Quality System** — ESLint flat config (`eslint.config.mjs`) with **4-wave progressive rule enablement**: Wave 1 (safe: `prefer-const`, `no-unused-vars`), Wave 2 (`react-hooks/exhaustive-deps`, `ban-ts-comment`), Wave 3 (`no-explicit-any`, `no-empty`), Wave 4 (all rules → `error`). Prettier runs as a one-time format-all commit then enforces via `prettier --check` in CI.

4. **Static Analysis** — `eslint-plugin-security` detects object injection and eval patterns in TypeScript; bandit covers Python security (exec, shell injection, unsafe requests).

5. **Caching Strategy** — Three layers: npm/pip dependency caching (lockfile-hash keys), ESLint cache (`.eslintcache`), and Next.js build cache (`.next/cache`).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete workflow YAML, test fixture designs, and caching configurations.

### Critical Pitfalls

1. **Going too strict too fast (P1)** — Enabling all ESLint rules + TypeScript strict mode simultaneously produces 200+ violations. **Prevention:** 4-wave ESLint enablement + 2-sub-phase TypeScript strict migration (Phase 1a → 1b → 2a → 2b). Each wave must produce a green build.

2. **Flaky SQLite tests from shared database state (P2/P11)** — Route handler tests open a second connection to `:memory:`, seeing an empty database because SQLite in-memory databases are per-connection. **Prevention:** Use a temporary file-based database (not `:memory:`) and monkeypatch `get_conn()` in `conftest.py` so all connections — fixtures AND route handlers — share the same file.

3. **LLM API dependency in tests (P4)** — Real Grok/Gemini calls cause non-deterministic failures (rate limits, network issues, API changes). **Prevention:** Three-tier strategy: (a) unit tests mock `llm.py` entirely, (b) integration tests use a `FakeLLM` class, (c) real API tests run only in a nightly workflow.

4. **Testing the wrong things (P9)** — Team gravitates toward easy shadcn/ui component tests instead of high-value domain logic (haversine, ranking, dispatch simulation). **Prevention:** Explicitly ban testing shadcn/ui wrappers in first two phases. Enforce domain-first testing with per-module coverage targets (`--cov=app.domain --cov-fail-under=90`).

5. **Ignoring existing tech debt before testing (P8)** — Writing tests for the dual event bus and duplicate domain logic validates the wrong architecture. **Prevention:** Phase 0 cleanup — delete frontend event bus, consolidate duplicate domain logic, remove seed data duplication — BEFORE writing any tests. "You can't test your way out of bad architecture."

## Implications for Roadmap

Based on combined research, the following phase structure accounts for hard dependencies (cannot build CI without passing tests, cannot pass tests without SQLite isolation, etc.) and risk minimization.

### Phase 0: Pre-Testing Cleanup (Foundation)
**Rationale:** The research (P8 in PITFALLS.md, CONCERNS.md) is clear: writing tests for duplicated/contradictory architecture wastes effort. The dual event bus, duplicate domain logic, and committed `nagraksha.db` must be addressed before any test infrastructure is built.
**Delivers:** Consolidated single-event-bus architecture; removed `backend/db/nagraksha.db` from git; corrected `.gitignore` entries for `*.db`, `coverage/`, `.eslintcache`; `NAGRAKSHA_DB` env var confirmed working.
**Addresses:** Anti-features from FEATURES.md (tech debt that makes testing ineffective)
**Avoids:** P8 (ignoring tech debt), P13 (API key leakage from committed DB)
**Research flag:** Standard patterns — this is about executing decisions already made in CONCERNS.md. No additional research needed.

### Phase 1: Formatting & ESLint Wave 1 (Quick Wins)
**Rationale:** No code dependencies. Prettier removes all formatting variability before rule enforcement begins. ESLint Wave 1 enables the safest rules (`prefer-const`, `no-unused-vars` with `argsIgnorePattern: "^_"`, `no-console: "warn"`) that produce few violations and require no refactoring. eslint-plugin-security added as a separate config block.
**Delivers:** One-time format commit; updated `eslint.config.mjs` with Wave 1 rules + security plugin; Prettier CI check; bandit installed and configured.
**Uses:** Prettier ^3.9.6, ESLint ^9 (existing), eslint-plugin-security ^4.0.1, bandit ^1.9.4
**Addresses:** Table stake features (ESLint enforcement, Python lint enforcement)
**Avoids:** P1 (too strict too fast — only Wave 1 enabled)
**Research flag:** Standard patterns — well-documented, established tools. Skip research-phase call.

### Phase 2: Test Infrastructure Setup (Vitest + pytest)
**Rationale:** Must come after Phase 0 (clean architecture ensures tests validate the right system). Independent of Phase 1 (can run in parallel). The most critical architectural decision is the SQLite test fixture — getting this right prevents 50+ hours of flaky-test debugging (P2, P11).
**Delivers:** `frontend/vitest.config.ts`, `frontend/src/test/setup.ts` (with IntersectionObserver/matchMedia mocks), `backend/tests/conftest.py` (with temp-file SQLite isolation, `get_conn()` monkeypatch, outbox worker disable), first 10-15 passing tests for domain logic (haversine, ranking, dispatch simulation).
**Uses:** Vitest ^4.1.10, @vitejs/plugin-react ^4.x, jsdom ^25.x, @testing-library/react ^16.3.2, @testing-library/jest-dom ^6.x, pytest ^9.1.1, pytest-cov ^6.x
**Addresses:** Table stake features (passing test suite); differentiator (coverage reporting)
**Avoids:** P2/P11 (SQLite state leakage from shared/naive `:memory:`), P4 (LLM mocking from day one), P9 (domain logic tested first, not shadcn/ui wrappers)
**Research flag:** Needs deeper research during implementation for Phase 0 tech debt cleanup decisions. Test infrastructure itself is well-documented standard patterns.

### Phase 3: TypeScript Strict Mode + ESLint Waves 2-4 (Tightening)
**Rationale:** TypeScript strict mode is the highest-value single improvement but also the most disruptive. Must come after Phase 1 (formatting reduces noise) and ideally after Phase 2 (tests validate the code works before/after type changes). Uses `tsconfig.strict.json` whitelist approach to avoid overwhelming the team.
**Delivers:** `noImplicitAny: true` fixed across all files; `ignoreBuildErrors: true` removed from `next.config.ts`; all ESLint rules at full strictness (Wave 4); `reactStrictMode: true` enabled.
**Addresses:** Table stake features (TypeScript type checking, frontend build validation, ESLint enforcement at full strength)
**Avoids:** P1 (rules enabled in waves), P6 (TypeScript overwhelm via whitelist approach)
**Research flag:** Standard patterns — TypeScript strict migration is well documented (jsmanifest.com, wolf-tech.io, dev.to/alexrogovjs). No additional research needed.

### Phase 4: CI Pipeline (Automation)
**Rationale:** Must come AFTER Phases 1-3 because CI must run checks that pass. The workflow file is designed once and remains stable. The gatekeeper pattern with `dorny/paths-filter` ensures skipped jobs don't block merging.
**Delivers:** `.github/workflows/ci.yml` with parallel frontend/backend jobs, dependency caching, path-based triggers, concurrency group with cancel-in-progress, gatekeeper job for required status checks, README CI badges.
**Uses:** GitHub Actions, actions/checkout@v4, actions/setup-node@v6, actions/setup-python@v5, dorny/paths-filter@v3
**Addresses:** Table stake features (CI blocks broken PRs); differentiators (parallel jobs, dependency caching, PR status badges)
**Avoids:** P3 (slow sequential CI), P7 (cache misconfiguration via lockfile-based keys)
**Research flag:** Standard patterns — GitHub Actions CI/CD is extremely well documented. Use `act` locally to test workflow before pushing.

### Phase 5: Developer Experience Polish (Hardening)
**Rationale:** Pre-commit hooks and coverage thresholds are valuable but must come after the CI pipeline is stable and fast. Adding pre-commit hooks too early causes developers to bypass them (P12). Coverage thresholds need a baseline.
**Delivers:** Husky + lint-staged (lint-stage only — fast, <5 sec); `tsc --noEmit` in pre-push hook (not commit); per-module coverage thresholds (informational, not blocking); coverage artifacts uploaded in CI.
**Addresses:** Differentiators (pre-commit hooks, coverage reporting)
**Avoids:** P5 (coverage too high too early — use per-module scoped thresholds), P12 (slow pre-commit hooks — only lint-staged, never `tsc`)
**Research flag:** Standard patterns — Husky + lint-staged configuration is well documented.

### Phase Ordering Rationale

```
Phase 0 (Tech Debt)         Phase 1 (Formatting + Wave 1)
        │                              │
        └──────────┬───────────────────┘
                   ▼
          Phase 2 (Test Infrastructure)
                   │
                   ▼
          Phase 3 (TypeScript Strict + ESLint Waves 2-4)
                   │
                   ▼
          Phase 4 (CI Pipeline)
                   │
                   ▼
          Phase 5 (DX Polish)
```

- **Phase 0 before Phase 2:** You cannot write stable tests for an unstable architecture. The dual event bus and duplicate domain logic must be consolidated first (P8).
- **Phase 1 before Phase 3:** Prettier formatting removes noise, ESLint Wave 1 catches basic issues before TypeScript errors are introduced.
- **Phase 2 can parallel Phase 1:** Test config files have no dependency on lint/formatting config. However, writing *meaningful* tests should wait until Phase 0 cleanup.
- **Phase 3 after Phase 2:** Having passing tests gives safety net during TypeScript strict migration (you can verify behavior didn't change).
- **Phase 4 after Phases 1-3:** CI is the aggregate of all earlier phases. You cannot set up CI checks that don't pass.
- **Phase 5 last:** Developer experience improvements (pre-commit hooks, coverage thresholds) layer on top of a working pipeline.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 0 (Tech Debt Cleanup):** The CONCERNS.md document identifies 5+ architectural issues but doesn't specify the exact order of remediation. Planning should produce a precise deletion/consolidation plan for the dual event bus and duplicate domain logic, with verification steps.
- **Phase 2 (Test Infrastructure):** While test framework setup is standard, the SQLite isolation strategy needs verification against the actual `database.py` implementation. The research assumes `get_conn()` is monkeypatchable — this must be confirmed during implementation.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Formatting + ESLint Wave 1):** Prettier and ESLint flat config are extremely well documented. No additional research needed.
- **Phase 3 (TypeScript Strict):** Multiple 2026 migration guides (jsmanifest.com, wolf-tech.io) document the exact approach. No additional research needed.
- **Phase 4 (CI Pipeline):** GitHub Actions documentation is comprehensive. The gatekeeper pattern used here is a known solution to the "skipped check blocks merge" problem.
- **Phase 5 (DX Polish):** Husky + lint-staged setup is standard. Coverage thresholds are standard pytest/vitest config.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | All versions verified against npm/PyPI registries and official docs. Vitest + Next.js 16 integration confirmed via Next.js official guide. |
| **Features** | HIGH | Feature landscape derived from current codebase audit (verified `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, zero test files). Competitive differentiators from established industry patterns. |
| **Architecture** | HIGH | GitHub Actions patterns verified across 5+ 2026 sources. SQLite test isolation patterns confirmed against PrefectHQ PRs and CleverAgents commit logs. ESLint flat config verified against ESLint 10 docs. |
| **Pitfalls** | HIGH | 13 pitfalls documented with prevention strategies, recovery steps, and phase mappings. Sources include real-world post-mortems (PrefectHQ, CleverAgents), published case studies (BuildPulse, Exact), and 2026 migration guides. |

**Overall confidence:** HIGH

### Gaps to Address

1. **Bun compatibility in CI:** The project uses Bun locally but `actions/setup-node` doesn't support Bun caching. The research offers two options (generate `package-lock.json` or use `oven-sh/setup-bun`), but the decision needs to be made during implementation. **Recommendation:** Use `oven-sh/setup-bun@v2` with `actions/cache` for Bun cache for consistency with local development.

2. **Outbox worker test isolation:** The outbox worker runs a background thread with `time.sleep(2.5)`. The research proposes monkeypatching `start_worker` as a no-op, but this needs verification against the actual startup code in `backend/app/main.py` and `backend/app/eventbus.py`. **Plan to address:** Verify during Phase 2 implementation; if `start_worker` isn't easily monkeypatchable, add a `NAGRAKSHA_TEST` env var guard.

3. **SQLite `get_conn()` monkeypatch feasibility:** The entire pytest isolation strategy depends on `get_conn()` being overridable via monkeypatch. This assumes `get_conn()` is a module-level function, not imported directly at module scope by route handlers. **Plan to address:** Audit `backend/app/database.py` and all imports during Phase 2 implementation. If `get_conn()` is imported at module scope, a different approach (env var override of `NAGRAKSHA_DB`) is needed.

4. **ESLint `no-explicit-any` error count unknown:** The research estimates 30+ errors but cannot verify without running `npx tsc --noEmit` after enabling `noImplicitAny`. **Plan to address:** During Phase 1 implementation, run `npx tsc --noEmit` to get an exact count and plan Wave 3/4 accordingly.

## Sources

### Primary (HIGH confidence)
- [Next.js Vitest Testing Guide](https://nextjs.org/docs/app/guides/testing/vitest) — Official Next.js 16 docs, confirmed Vitest + @vitejs/plugin-react compatibility
- [ESLint Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files) — ESLint v9/v10 official docs
- [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started/) — Official TypeScript ESLint docs
- [pytest Documentation](https://docs.pytest.org/en/stable/) — Official pytest docs, fixture and tmp_path documentation
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/) — Official FastAPI docs, TestClient usage
- [GitHub Actions Documentation](https://docs.github.com/en/actions) — Official workflow syntax, caching, concurrency docs
- [actions/setup-node@v6](https://github.com/actions/setup-node) — Official GitHub Action docs
- [actions/setup-python@v5](https://github.com/actions/setup-python) — Official GitHub Action docs
- [bandit Documentation](https://bandit.readthedocs.io/en/latest/) — Official Python security linter docs
- [pytest-cov Documentation](https://pytest-cov.readthedocs.io/) — Official pytest coverage plugin docs
- [Prettier 3.9.6](https://www.npmjs.com/package/prettier) — npm registry, version verified
- [Vitest 4.1.10](https://www.npmjs.com/package/vitest) — npm registry, version verified
- [eslint-plugin-security 4.0.1](https://www.npmjs.com/package/eslint-plugin-security) — npm registry, flat config compatible
- [Codebase analysis: CONCERNS.md, TESTING.md, PROJECT.md](file://.planning/CONCERNS.md) — First-hand audit of actual codebase state (2026-07-25/26)

### Secondary (MEDIUM confidence)
- BuildPulse.io — "The flakiest test in your suite is fighting over a database row" (2026-07-13). SQLite shared-state flakiness patterns.
- PrefectHQ/pull/20553 — SQLite `busy_timeout` for concurrent test execution (2026). Real-world CI fix.
- CleverAgents Core commit f2b9ccf — Per-scenario temp databases for parallel SQLite tests (2026). Verified fix.
- wolf-tech.io — "TypeScript Strict Mode: How to Survive the Transition" (2026-04-22). Incremental adoption with `tsconfig.strict.json`.
- jsmanifest.com — "Migrating 200k Lines to TypeScript 6.0: What Actually Broke" (2026-07-02). Data on 8,247 errors: 62% null/undefined, 23% implicit any.
- dev.to/uaslimcreate — "GitHub Actions for Parallel FastAPI + React Testing" (2026-05-23). Real implementation, from 8 min to 90 sec.
- dev.to/jimmyyeung — "Systematically Cut Our Monorepo CI Time in Half" (2026-03-26). Bun, Rspack, caching, pytest-xdist patterns.
- carolin-brandt.de — "Addressing Test Flakiness: Practical Approaches in a Database-Reliant Industrial System" (Exact case study, 2026). Pipeline pass rate from 27% to 95%.
- deployflow.co — "Continuous Integration for Legacy Systems: 4-Phase Roadmap" (2026-06-25). Brownfield CI adoption framework.
- oven-sh/setup-bun — Bun CI action (verified via WebSearch, MEDIUM confidence as Bun in CI is less common than Node)

### Tertiary (LOW confidence)
- kriedysystems.com — "Five CI/CD Pipeline Mistakes That Quietly Kill Deployment Confidence" (2026-03-03). Single-source patterns but consistent with other sources.
- theengineeringladder.com — "The CI/CD Pipeline Mistakes That Are Quietly Slowing Your Team Down" (2026-04-26). Sequential execution patterns, parallel fix verification.

---

*Research completed: 2026-07-26*
*Ready for roadmap: yes*
