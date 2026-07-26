# Requirements: NagRaksha

**Defined:** 2026-07-26
**Core Value:** A victim or bystander can trigger a one-tap SOS that instantly dispatches three parallel responder lanes and routes to the nearest hospital with confirmed antivenom stock.

## v1 Requirements

Requirements for milestone v1.0. Each maps to roadmap phases.

### Code Formatting

- [ ] **FORMAT-01**: Developer can run Prettier to format all TypeScript/TSX files consistently
- [ ] **FORMAT-02**: CI enforces formatting via `prettier --check` on changed files

### Linting (ESLint)

- [ ] **LINT-01**: ESLint rules re-enabled progressively — Wave 1 (prefer-const, no-unused-vars, no-console)
- [ ] **LINT-02**: ESLint rules re-enabled — Wave 2 (react-hooks/exhaustive-deps, ban-ts-comment)
- [ ] **LINT-03**: ESLint rules re-enabled — Wave 3 (no-explicit-any, no-empty, no-implicit-coercion)
- [ ] **LINT-04**: ESLint rules at full strictness — Wave 4 (all remaining rules set to error)
- [ ] **LINT-05**: All existing ESLint violations in the codebase are fixed across all waves

### TypeScript Type Checking

- [ ] **TYPES-01**: TypeScript `noImplicitAny` enabled and violations fixed
- [ ] **TYPES-02**: `ignoreBuildErrors` removed from `next.config.ts` — build fails on type errors
- [ ] **TYPES-03**: `reactStrictMode` set to `true` and React warnings resolved
- [ ] **TYPES-04**: `strictNullChecks` enabled and violations fixed

### Testing Infrastructure

- [ ] **TEST-01**: Vitest test framework configured for frontend TypeScript project
- [ ] **TEST-02**: pytest test framework configured for backend Python project
- [ ] **TEST-03**: SQLite database isolation fixture created for backend tests (temp file, not :memory:)
- [ ] **TEST-04**: LLM API mocking in tests (no real Grok/Gemini calls in CI)
- [ ] **TEST-05**: Outbox worker disabled during tests (no background thread interference)
- [ ] **TEST-06**: Tests for domain logic — haversine distance calculation
- [ ] **TEST-07**: Tests for domain logic — hospital ranking by stock status
- [ ] **TEST-08**: Tests for domain logic — dispatch simulation
- [ ] **TEST-09**: Tests for API routes — SOS trigger creates incident and outbox event
- [ ] **TEST-10**: Tests for API routes — myth-buster RAG pipeline with mocked LLM
- [ ] **TEST-11**: Tests for API routes — hospital stock update endpoint

### Static Analysis

- [ ] **STATIC-01**: `eslint-plugin-security` configured and passing in ESLint
- [ ] **STATIC-02**: `bandit` configured for Python security scanning and passing
- [ ] **STATIC-03**: Both tools integrated into CI pipeline

### CI Pipeline

- [ ] **CI-01**: GitHub Actions workflow created with parallel frontend and backend jobs
- [ ] **CI-02**: Frontend job runs lint (ESLint), typecheck (tsc --noEmit), and test (Vitest)
- [ ] **CI-03**: Backend job runs lint (bandit) and test (pytest)
- [ ] **CI-04**: Dependency caching configured for both npm/bun and pip
- [ ] **CI-05**: Path-based triggers skip irrelevant jobs (only frontend/only backend changes)
- [ ] **CI-06**: Gatekeeper job aggregates results for branch protection
- [ ] **CI-07**: CI blocks PRs with failing checks

### Developer Experience

- [ ] **DX-01**: Pre-commit hooks (Husky + lint-staged) run lint-staged on commit
- [ ] **DX-02**: Coverage reports generated in CI (informational, not blocking)
- [ ] **DX-03**: README badges showing CI status

## Future Requirements (v1.x)

### TypeScript
- **TYPES-05**: Full TypeScript strict mode (`strict: true` with all sub-flags) — remaining flags after noImplicitAny and strictNullChecks

### Testing
- **TEST-12**: Component tests for React components (with @testing-library/react)
- **TEST-13**: Coverage thresholds set to block PRs (after baseline established)
- **TEST-14**: Pre-commit hook runs `tsc --noEmit` in pre-push hook
- **TEST-15**: E2E tests with Playwright

### CI
- **CI-08**: Nightly workflow for real LLM API integration tests
- **CI-09**: Performance regression detection
- **CI-10**: Build artifact caching for Next.js

## Out of Scope

| Feature | Reason |
|---------|--------|
| Production CD / deployment pipeline | Out of scope per milestone definition; this milestone is purely quality infrastructure |
| SonarQube or SonarCloud setup | Lighter static analysis tools preferred (eslint-plugin-security + bandit) |
| E2E browser tests (Playwright) | No unit tests exist yet; E2E is expensive and flaky; deferred to v1.x |
| Code coverage thresholds blocking PRs | Premature on zero-test codebase; will revisit after 2-3 sprints of test accumulation |
| Performance/load testing | Not needed at current scale |
| Docker containerization for CI | Overhead not justified for two-service app |
| Security audit / penetration testing | Out of scope for quality infrastructure milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FORMAT-01 | — | Pending |
| FORMAT-02 | — | Pending |
| LINT-01 | — | Pending |
| LINT-02 | — | Pending |
| LINT-03 | — | Pending |
| LINT-04 | — | Pending |
| LINT-05 | — | Pending |
| TYPES-01 | — | Pending |
| TYPES-02 | — | Pending |
| TYPES-03 | — | Pending |
| TYPES-04 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| TEST-05 | — | Pending |
| TEST-06 | — | Pending |
| TEST-07 | — | Pending |
| TEST-08 | — | Pending |
| TEST-09 | — | Pending |
| TEST-10 | — | Pending |
| TEST-11 | — | Pending |
| STATIC-01 | — | Pending |
| STATIC-02 | — | Pending |
| STATIC-03 | — | Pending |
| CI-01 | — | Pending |
| CI-02 | — | Pending |
| CI-03 | — | Pending |
| CI-04 | — | Pending |
| CI-05 | — | Pending |
| CI-06 | — | Pending |
| CI-07 | — | Pending |
| DX-01 | — | Pending |
| DX-02 | — | Pending |
| DX-03 | — | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 0
- Unmapped: 35 ⚠️

---

*Requirements defined: 2026-07-26*
*Last updated: 2026-07-26 after initial definition*
