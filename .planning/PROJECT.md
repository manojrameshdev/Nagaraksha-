# NagRaksha

## What This Is

NagRaksha ("snake protection") is a PWA-first emergency response and prevention platform for snakebites in India. One SOS fans out in parallel to three responder categories (trained individual, rescue team, ambulance/hospital), routes to the nearest hospital with confirmed antivenom stock, and adds AI prevention via a myth-buster chatbot, snake photo ID, and weather-based risk advisory.

Target users: snakebite victims and bystanders in India, first responders, rescue teams, and hospital administrators.

## Core Value

A victim or bystander can trigger a one-tap SOS that instantly dispatches three parallel responder lanes and routes to the nearest hospital with confirmed antivenom stock.

## Current Milestone: v1.0 Quality Infrastructure

**Goal:** Establish code quality guardrails, automated testing, and CI/CD pipeline to ensure code correctness and maintainability.

**Target features:**
- ESLint rules re-enabled with appropriate strictness
- TypeScript strict type checking enforcing type safety
- Unit test frameworks (Vitest for frontend, pytest for backend)
- Static analysis tools (bandit for Python, eslint-plugin-security)
- GitHub Actions CI pipeline running all checks on push/PR
- Automated test suite verifying core functionality

## Requirements

### Validated

Shipped capabilities from prior builds:

- ✓ One-tap SOS triggers three-way parallel dispatch — v1.0 (pre-GSD)
- ✓ Live SSE stream for incident state updates — v1.0 (pre-GSD)
- ✓ Hospital ranking by antivenom stock status — v1.0 (pre-GSD)
- ✓ Myth-buster RAG chatbot with TF-IDF retrieval + LLM fallback chain — v1.0 (pre-GSD)
- ✓ Snake photo ID (mock CV with text-based identification) — v1.0 (pre-GSD)
- ✓ Weather/season-based risk advisory — v1.0 (pre-GSD)
- ✓ Admin dashboard with platform stats — v1.0 (pre-GSD)
- ✓ Durable outbox event bus with audit trail — v1.0 (pre-GSD)
- ✓ PWA with offline shell, manifest, service worker — v1.0 (pre-GSD)
- ✓ WebGL shader background and procedural snake scroll progress — v1.0 (pre-GSD)
- ✓ Three-line dock navigation with smooth scroll — v1.0 (pre-GSD)
- ✓ Dark theme with NagRaksha brand palette — v1.0 (pre-GSD)
- ✓ Python FastAPI backend + Next.js frontend separation — v1.0 (pre-GSD)
- ✓ RAG system with 22 medically-reviewed knowledge chunks — v1.0 (pre-GSD)
- ✓ System architecture data-driven manifest — v1.0 (pre-GSD)

### Active

- [ ] ESLint rules re-enabled with strictness appropriate for codebase
- [ ] TypeScript strict type checking enabled (noImplicitAny, ignoreBuildErrors removed)
- [ ] Unit test framework for TypeScript (Vitest)
- [ ] Unit test framework for Python (pytest)
- [ ] Tests for domain logic (haversine, ranking, dispatch simulation)
- [ ] Tests for API routes (SOS, myth-buster, hospitals, risk)
- [ ] Static analysis tools (bandit for Python security, eslint-plugin-security)
- [ ] GitHub Actions CI workflow running lint, typecheck, tests on push/PR
- [ ] README badges and status for CI pipeline

### Out of Scope

- Integration/E2E tests with browser automation — deferred to future milestone
- Performance/load testing — deferred to future milestone
- Code coverage thresholds blocking PRs — will set after initial test suite stabilizes
- Production deployment pipeline (CD) — out of scope for this milestone
- SonarQube or full SonarCloud setup — lighter static analysis tools preferred

## Context

This is a hackathon-originated prototype (Nagathon 2026) with a fully functional backend and frontend but zero test coverage, all ESLint rules disabled, and TypeScript build errors suppressed. The codebase consists of Python FastAPI backend (~19 files) and Next.js 16 frontend (React 19, shadcn/ui, Tailwind v4, Prisma).

The project was built in rapid succession: initial scaffold → PWA + backend + frontend assembly → RAG system → Python backend extraction. No quality infrastructure was added during development due to time constraints.

## Constraints

- **Legacy config**: ESLint, tsconfig, and next.config all have safety valves disabled/relaxed — these must be tightened incrementally without breaking the build
- **No prior tests**: Test frameworks must be introduced from scratch; no existing test patterns to follow
- **Dual-language codebase**: Both TypeScript (frontend) and Python (backend) need test infrastructure
- **CI cost**: GitHub Actions free tier limits apply; keep workflow efficient (< 6hr/month)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vitest over Jest | Faster, native ESM, compatible with Next.js/React | ✓ Pending |
| pytest over unittest | Standard Python test runner, fixture support | ✓ Pending |
| GitHub Actions over alternatives | Native GitHub integration, free tier, widespread | ✓ Pending |
| Lightweight static analysis over SonarQube | Lower setup overhead, sufficient for current codebase size | ✓ Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-07-26 after milestone v1.0 start*
