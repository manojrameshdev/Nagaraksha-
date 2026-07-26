# Feature Research: CI/CD Quality Pipeline

**Domain:** Dual-language (TypeScript + Python) web application CI/CD
**Researched:** 2026-07-26
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any professional project must have. Missing these = the project is not production-ready.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ESLint enforcement (TypeScript) | Block PRs with lint errors; no "all rules disabled" config | MEDIUM | Must re-enable rules incrementally — 18 rules currently set to "off". Need to fix existing violations before enforcement works. |
| TypeScript type checking | `tsc --noEmit` or `tsc --strict` must pass; `ignoreBuildErrors: true` removed | MEDIUM | Currently `ignoreBuildErrors: true` and `noImplicitAny: false`. Fixing type errors is the hardest part — expect 50-200 errors to resolve. |
| Passing test suite | CI must run tests and fail if tests fail | MEDIUM | No tests exist at all. Need to create test infrastructure from scratch AND write meaningful tests. |
| CI blocks broken PRs | Workflow must run on push/PR and report status | LOW | Standard GitHub Actions pattern. Single workflow file, minimal config complexity. |
| Python lint enforcement | Ruff (replacing flake8/pylint) must pass for backend code | LOW | Ruff runs in milliseconds. Configuring `pyproject.toml` is straightforward. One-time fix of existing violations. |
| Frontend build validation | `next build` must succeed | LOW | Currently builds pass. Need to verify this holds after re-enabling type checking. |

### Differentiators (Competitive Advantage)

Features that set the project apart from typical hackathon repos. Not strictly required but valuable for long-term maintainability.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coverage reporting | Shows which code is untested; motivates filling gaps | LOW | `vitest run --coverage` with v8 provider + `pytest --cov=app`. Upload to Codecov or use `--cov-report=html` as an artifact. |
| Security scanning (backend) | Catch hardcoded secrets, unsafe eval, shell injection before merge | LOW | Ruff's S (security) ruleset now covers most of what bandit catches. Keeps toolchain unified. |
| Security scanning (frontend) | eslint-plugin-security catches eval, regex DoS, unsafe paths | LOW | Add `eslint-plugin-security` to existing ESLint config. Configure for TypeScript. |
| Dependency caching | Speeds up CI by 40-60% for both npm and pip | LOW | `actions/setup-node` with `cache: 'npm'` + `actions/setup-python` with `cache: 'pip'`. Standard pattern. |
| Parallel frontend + backend jobs | Full CI in ~3 minutes instead of ~6 (serial) | LOW | GitHub Actions job-level parallelism (separate runners for frontend/backend). Step-level parallelism (new June 2026) for checks within each. |
| PR status badges | README badges showing CI health | LOW | Shields.io + GitHub Actions badge URL. Marketing value for an open-source project. |
| Pre-commit hooks (Husky + lint-staged) | Catch issues before CI; faster feedback | MEDIUM | Requires `husky` + `lint-staged` package install and configuration. Only lint staged files to keep it fast. Lowers CI failure rate. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but create real problems for this brownfield project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Blocking PRs on coverage thresholds | "We need X% coverage to merge" | No tests exist. A threshold would block ALL changes until coverage is built up. Developers will circumvent the system or get frustrated. | Set informational coverage reporting first. After 2-3 months of test accumulation, discuss a threshold. Start with no threshold, add a warning-only flag. |
| Full strict mode TypeScript on day 1 | "We should use all strict checks" | Codebase has `noImplicitAny: false` and likely hundreds of implicit anys. Enabling all strict checks at once would create a massive blocking error count. | Incremental approach: fix `noImplicitAny` first, then `strictNullChecks`, then remaining strict flags. Each in a separate PR. |
| Running E2E tests in CI | "We need browser tests too" | No unit tests exist yet. E2E tests are slow, flaky, and expensive (GitHub Actions minutes). They add frustration before the basics work. | Defer to future milestone. Get unit + integration tests stable first. E2E testing is explicitly listed as Out of Scope in PROJECT.md. |
| SonarQube/SonarCloud | "Enterprise-grade quality dashboard" | Heavier setup, more config, slower scans. The codebase is ~19 Python files + ~25 TypeScript files — overkill. | Lightweight tools (Ruff + ESLint + Vitest/pytest coverage) are sufficient at this scale. |
| Blocking on lint warnings, not errors | "Warnings let us track issues" | In practice, warnings get ignored. Developers learn to scroll past them. Warnings in CI create noise without action. | Set all active rules to "error" or "off". No warnings. If a rule matters, make it fail. |
| pip-audit / npm audit blocking CI | "Security vulnerabilities in deps must block PRs" | Many transitive dependencies have CVEs. Blocking CI on these creates noise, frustration, and incentives to skip/relax the check. | Run audits as informational (non-blocking) steps. Only block on fixable, high-severity issues. |

## Feature Dependencies

```
ESLint enforcement
    └──requires──> Fix existing ESLint violations
                        └──requires──> Audit current off-rules, decide which to re-enable

TypeScript type checking
    └──requires──> Fix existing type errors
                        └──requires──> Set noImplicitAny: true
                        └──requires──> Remove ignoreBuildErrors: true

Test suite (Vitest)
    └──requires──> Install test dependencies
    └──requires──> Create vitest.config.ts
    └──requires──> Write first tests (domain logic first)

Test suite (pytest)
    └──requires──> Add pytest to requirements.txt
    └──requires──> Create conftest.py with test fixtures
    └──requires──> Create tests/ directory structure
    └──requires──> Write first tests (pure functions first)

Coverage reporting
    └──enhances──> Test suite (adds --cov / --coverage flags)
    └──requires──> At least some tests existing (coverage of nothing is useless)

Security scanning
    └──requires──> ESLint config working (extend with eslint-plugin-security)
    └──requires──> Ruff config working (add S ruleset)

GitHub Actions CI workflow
    └──requires──> ESLint config working (lint job)
    └──requires──> TypeScript type checking capable (typecheck job)
    └──requires──> Test suite running locally (test jobs)
    └──enhances──> Build validation
    └──enhances──> Coverage reporting
    └──enhances──> Security scanning

Pre-commit hooks
    └──enhances──> GitHub Actions CI (catches issues earlier)

README badges
    └──requires──> GitHub Actions CI workflow created (badge URL needs workflow)
```

### Critical Phase Ordering Rationale

The pipeline has a hard ordering constraint: **you cannot run CI checks that don't pass.** This means the implementation order is:

1. **Fix existing violations first** (ESLint, TypeScript) — this is unglamorous but essential. Attempting to "just add CI" without fixing the codebase first will result in a perpetually red CI.
2. **Set up test infrastructure** (Vitest, pytest) — install deps, create config files, create directory structure.
3. **Write tests for pure/domain logic** — these are the easiest to write (no mocking needed) and provide the most value per test.
4. **Enable CI workflow** — but initially only run checks that are confirmed passing. Add jobs incrementally.
5. **Add differentiators** — coverage, security, caching, badges. These layer on top of working infrastructure.

## MVP Recommendation

### Launch With (v1.0 — this milestone)

The milestone target from PROJECT.md. Minimal quality infrastructure that provides real value.

- [x] **ESLint rules re-enabled with appropriate strictness** — Not all rules, but a meaningful subset. Fix existing violations. Get lint passing.
- [x] **TypeScript strict type checking** — `noImplicitAny: true`, fix type errors, remove `ignoreBuildErrors`. This is the highest-value single change.
- [x] **Unit test frameworks installed** — Vitest (frontend) + pytest (backend). Config files, directory structure, first passing tests.
- [x] **Static analysis tools** — Ruff S ruleset for Python, eslint-plugin-security for TypeScript. Catch security issues early.
- [x] **GitHub Actions CI pipeline** — Runs lint, typecheck, tests on push/PR. Parallel frontend + backend jobs with dependency caching.
- [x] **Tests for domain logic** — haversine, ranking, dispatch simulation. Pure functions = easy tests. Coverage of core business logic.
- [x] **Tests for API routes** — At minimum `POST /api/sos` and `GET /api/hospitals`. Integration tests with test DB fixtures.
- [x] **README badges for CI** — Visible pass/fail status on repo front page.

### Add After Validation (v1.1 — next milestone)

Non-blocking improvements that make the pipeline more robust.

- [ ] **Pre-commit hooks (Husky + lint-staged)** — Catch issues before they reach CI. Must wait until lint + typecheck are consistently passing.
- [ ] **Coverage threshold (informational)** — Generate coverage reports, display in CI, but don't block. Establish baseline numbers first.
- [ ] **Performance regression detection** — Track execution time of critical paths (LLM calls, RAG retrieval). Alert on significant changes.
- [ ] **Dependabot / Renovate config** — Automated dependency updates with grouped PRs.

### Future Consideration (v2+)

Features deferred to later milestones.

- [ ] **E2E tests with Playwright** — Full browser tests for SOS flow, myth-buster interaction, PWA offline behavior. Expensive CI minutes.
- [ ] **Code coverage threshold blocking** — Only after 3+ months of test accumulation and a known baseline.
- [ ] **SonarQube/SonarCloud** — Overkill for current codebase size. Revisit at 50+ files or if multi-repo.
- [ ] **Production CD pipeline** — Out of scope per PROJECT.md. Requires deployment target decisions first.
- [ ] **Performance/load testing** — Out of scope per PROJECT.md. Needs production-like environment.
- [ ] **Dagger programmable CI** — Emerging pattern (TypeScript-native pipeline definitions). Worth watching but not adopting yet.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Fix ESLint violations | HIGH (unblock everything) | MEDIUM (audit + fix) | P1 |
| Re-enable ESLint rules | HIGH (code quality gate) | LOW (config changes) | P1 |
| Fix TypeScript strict errors | HIGH (type safety) | HIGH (50-200 errors) | P1 |
| Enable noImplicitAny | HIGH (type safety) | MEDIUM (add explicit types) | P1 |
| Install Vitest + write domain tests | HIGH (test coverage) | MEDIUM (config + tests) | P1 |
| Install pytest + write API tests | HIGH (test coverage) | MEDIUM (config + tests) | P1 |
| Create GitHub Actions CI workflow | HIGH (automation) | LOW (YAML file) | P1 |
| Ruff linting for backend | HIGH (Python quality) | LOW (config) | P1 |
| eslint-plugin-security | MEDIUM (security) | LOW (plugin + config) | P2 |
| Dependency caching in CI | MEDIUM (speed) | LOW (one-liner config) | P2 |
| Coverage reporting | MEDIUM (visibility) | LOW (flag + artifact) | P2 |
| Parallel frontend/backend CI jobs | MEDIUM (speed) | LOW (job config) | P2 |
| README CI badges | LOW (marketing) | LOW (shields.io URL) | P2 |
| Pre-commit hooks | MEDIUM (DX) | MEDIUM (install + config) | P2 |
| Coverage threshold blocking | LOW (premature) | LOW (config) | POSTPONE |

**Priority key:**
- P1: Must have for milestone completion
- P2: Should have, add when possible in same milestone
- POSTPONE: Defer to future milestone

## Pipeline Stage Specification

### Stage 1: Lint
**Tool:** ESLint v9 flat config (frontend), Ruff (backend)
**Command:** `eslint .` / `ruff check --output-format github .`
**Blocking:** YES — must pass before typecheck/tests run
**CI Job:** `frontend-lint` + `backend-lint` (parallel)
**Notes:**
- ESLint uses `@eslint/js` recommended + `typescript-eslint` recommended as base
- Currently 18 rules set to "off" — must audit and re-enable incrementally
- Ruff replaces flake8, pylint, isort, black, AND bandit (S ruleset) in one tool
- Ruff runs in < 100ms for this codebase size

### Stage 2: Type Check
**Tool:** TypeScript Compiler (`tsc --noEmit`)
**Command:** `cd frontend && npx tsc --noEmit`
**Blocking:** YES — must pass before build
**CI Job:** `frontend-typecheck`
**Notes:**
- Currently `ignoreBuildErrors: true` — this must be removed
- Currently `noImplicitAny: false` — this must be set to `true`
- Expect 50-200 errors to resolve; run `npx tsc --noEmit` to count
- Most errors will be implicit `any` parameters and missing return types
- Strategy: fix errors in batches per module, not all at once

### Stage 3: Test
**Tool:** Vitest (frontend), pytest (backend)
**Command:** `cd frontend && vitest run` / `cd backend && python -m pytest`
**Blocking:** YES — must pass for PR merge
**CI Job:** `frontend-test` + `backend-test` (parallel, depend on lint)
**Notes:**
- No tests exist currently — first tests must be written
- Priority: domain logic (pure functions, no mocking needed)
- Vitest config: `vitest.config.ts` with `@vitejs/plugin-react`, jsdom environment
- pytest config: `conftest.py` with test DB fixture and FastAPI `TestClient`
- Use `--junitxml` flag for test reporting in CI

### Stage 4: Static Analysis / Security
**Tool:** eslint-plugin-security (frontend), Ruff S ruleset (backend)
**Command:** Part of ESLint run / `ruff check` already includes S rules
**Blocking:** RECOMMENDED (can be separate non-blocking job initially)
**CI Job:** Part of lint jobs (unified)
**Notes:**
- Ruff S ruleset covers: `hardcoded_password_string`, `request_without_timeout`, `exec_used`, `jinja2_autoescape_false`, `suspicious_function_calls`
- eslint-plugin-security covers: `detect-eval-with-expression`, `detect-non-literal-regexp`, `detect-unsafe-regex`, `detect-child-process`
- No separate config needed — integrate into existing ESLint + Ruff setup

### Stage 5: Build
**Tool:** Next.js build (frontend), Python package validation (backend)
**Command:** `cd frontend && next build` / `cd backend && python -c "import app; print('OK')"`
**Blocking:** YES — ensure code compiles before merge
**CI Job:** `frontend-build` (depends on typecheck + test)
**Notes:**
- `next build` validates that the app compiles correctly
- Currently builds with `ignoreBuildErrors: true` — after fixing types, verify build still passes
- Python validation is lightweight — just verify imports work

### Pipeline Flow Diagram

```
Push/PR trigger
    │
    ├── frontend-lint (ESLint + security plugin)    ──parallel── backend-lint (Ruff check + format)
    │                                                           │
    ├── frontend-typecheck (tsc --noEmit)                      │
    │                                                           │
    ├── frontend-test (vitest run --coverage)     ──parallel── backend-test (pytest --cov=app)
    │                                                           │
    ├── frontend-build (next build)                             │
    │                                                           │
    └── All checks pass → PR can merge                         │
```

## CI Pipeline Cost Analysis

Based on GitHub Actions free tier (2,000 min/month for private repos, unlimited for public):

| Job | Estimated Time (fresh) | Estimated Time (cached) | Frequency |
|-----|----------------------|------------------------|-----------|
| frontend-lint | 1.5 min | 0.5 min | Per push |
| frontend-typecheck | 1.0 min | 0.8 min | Per push |
| frontend-test | 2.0 min | 1.5 min | Per push |
| frontend-build | 1.5 min | 1.0 min | Per push |
| backend-lint | 0.3 min | 0.2 min | Per push |
| backend-test | 1.0 min | 0.8 min | Per push |
| **Total (parallel optimized)** | **~3 min** | **~2 min** | Per push |

With parallel jobs, total wall-clock time = max(frontend, backend) ≈ 2-3 minutes. Total runner-minutes = sum of all jobs ≈ 5-7 minutes per push.

At 100 pushes/month: 500-700 minutes — well within free tier. Public repos are unlimited.

**Optimizations:**
- Use GitHub Actions 1 vCPU runners for lint + typecheck (cheaper)
- Use `paths-filter` to skip backend jobs when only frontend changes and vice versa
- Dependency caching reduces install time by 40-60%

## Competitor / Reference Analysis

Not applicable — this is an internal quality infrastructure feature set, not a competitive market analysis. Reference projects:

| Practice | Reference | Our Approach |
|----------|-----------|--------------|
| Dual-language CI | monorepo pattern (frontend + backend) | Separate jobs in same workflow, parallel execution |
| ESLint flat config | ESLint v9 + typescript-eslint v8 | `eslint.config.mjs` with `tseslint.configs.recommended` |
| Python linting | Ruff replacing flake8/black/isort/bandit | Unified `ruff check` with S ruleset for security |
| Testing pattern | Vitest + @testing-library/react | Domain logic tests first, component tests later |
| CI caching | `actions/setup-{node,python}` with `cache:` | Both npm and pip caching in all jobs |

## Sources

- [Next.js Vitest setup guide](https://nextjs.org/docs/app/guides/testing/vitest) — HIGH confidence, official docs
- [ESLint flat config with TypeScript](https://typescript-eslint.io/getting-started/) — HIGH confidence, official docs
- [Ruff Python linter GitHub Action](https://github.com/astral-sh/ruff-action) — HIGH confidence, official repo
- [Ruff security rules (bandit replacement)](https://tutorials.technology/tutorials/ruff-python-linting-2026.html) — MEDIUM confidence, verified with Ruff docs
- [GitHub Actions parallel steps (June 2026 GA)](https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/) — HIGH confidence, official GitHub changelog
- [GitHub Actions CI/CD guide 2026](https://jishulabs.com/blog/ci-cd-github-actions-2026) — MEDIUM confidence, blog with verified patterns
- [Bandit official GitHub Actions guide](https://bandit.readthedocs.io/en/latest/ci-cd/github-actions.html) — HIGH confidence, official docs
- [pytest-cov documentation](https://pytest-cov.readthedocs.io/) — HIGH confidence, official docs
- [Husky + lint-staged setup](https://typicode.github.io/husky/) — HIGH confidence, official docs
- Current project state: `eslint.config.mjs` (18 rules disabled), `tsconfig.json` (noImplicitAny: false), `next.config.ts` (ignoreBuildErrors: true), no `.github/` directory, no test files — HIGH confidence, directly verified

---
*Feature research for: NagRaksha CI/CD quality pipeline*
*Researched: 2026-07-26*
