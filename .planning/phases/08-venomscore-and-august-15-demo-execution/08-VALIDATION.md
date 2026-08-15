---
phase: 08
slug: venomscore-and-august-15-demo-execution
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-16
---

# Phase 08 — Validation Strategy & Results

> Per-phase validation contract for feedback sampling and test coverage verification.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend Framework** | Pytest 9.x + httpx ASGI + pytest-asyncio |
| **Frontend Framework** | Vitest 4.x + MSW 2.x + React Testing Library |
| **Config files** | `backend/tests/conftest.py`, `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -q` |
| **Full suite command** | `cd backend && pytest tests/ -v && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick test suite
- **After every plan wave:** Run full test suite + linter
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|-----------|-------------------|------|--------|
| 08-01-01 | 01 | 1 | CLEANUP-01 | unit/lint | `npm run lint` | `package.json`, `setup.py`, `.gitignore` | ? green |
| 08-01-02 | 01 | 1 | BUGFIX-01 | unit | `npx vitest run` | `frontend/store/sos-store.ts` | ? green |
| 08-01-03 | 01 | 1 | RATE-LIMIT-01 | route/integration | `pytest backend/tests/test_routes.py` | `backend/app/routes/sos.py` | ? green |
| 08-02-01 | 02 | 2 | VENOMSCORE-BE-01 | db/schema | `pytest backend/tests/test_domain.py` | `backend/app/database.py` | ? green |
| 08-02-02 | 02 | 2 | VENOMSCORE-BE-03 | domain unit | `pytest backend/tests/test_domain.py` | `backend/app/domain.py` | ? green |
| 08-02-03 | 02 | 2 | VENOMSCORE-BE-02 | route/ws | `pytest backend/tests/test_routes.py` | `backend/app/routes/venom_score.py` | ? green |
| 08-03-01 | 03 | 2 | VENOMSCORE-FE-01 | unit/api | `npx vitest run` | `frontend/lib/nagraksha.ts`, `realtime.ts` | ? green |
| 08-03-02 | 03 | 2 | VENOMSCORE-FE-02 | component/mock | `npx vitest run` | `frontend/components/venom-score.tsx` | ? green |
| 08-03-03 | 03 | 2 | VENOMSCORE-FE-03 | integration | `npx vitest run` | `frontend/app/incidents/[id]/page.tsx` | ? green |
| 08-04-01 | 04 | 3 | DEMO-DATA-01 | db integration | `pytest backend/tests/test_seed_demo.py` | `backend/seed_demo.py` | ? green |
| 08-04-02 | 04 | 3 | E2E-TEST-01 | end-to-end loop | `pytest backend/tests/test_routes.py` | full test suite | ? green |

*Status: ? green (94 backend pytest tests passing, 19 frontend vitest tests passing)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-browser live webcam ptosis tracking | DEMO-REHEARSAL | Requires live browser webcam feed and physical user squinting | Start backend + frontend, open victim tab with webcam, squint after 10s, verify hospital tab updates packet |

---

## Validation Sign-Off

- [x] All tasks have automated verification commands
- [x] Sampling continuity: test suites green after every wave
- [x] All 94 backend tests pass
- [x] All 19 frontend Vitest tests pass
- [x] Linter and build pass with 0 errors
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-16
