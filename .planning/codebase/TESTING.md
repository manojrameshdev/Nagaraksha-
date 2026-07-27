# Testing Infrastructure & Test Suites

**Analysis Date:** 2026-07-27

## Active Test Suites (49 Passing Tests Total)

The repository includes complete automated test coverage across both the TypeScript frontend and Python FastAPI backend layers.

### 1. Frontend Test Suite (Vitest)
- **Runner:** `vitest` (`vitest run` in `frontend/`)
- **Config:** `frontend/vitest.config.ts`
- **Location:** [frontend/src/lib/__tests__/](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/src/lib/__tests__/)
- **Total Tests:** **16 passing**
- **Modules Covered:**
  - `nagraksha.test.ts` (13 tests): Haversine distance, travel-time calculations, antivenom stock freshness, Dijkstra hospital ranking, and dispatch simulation.
  - `eventbus.test.ts` (3 tests): In-process event bus pub/sub, transactional outbox appending, and audit logging.

### 2. Backend Test Suite (Pytest)
- **Runner:** `pytest` (`pytest backend/tests`)
- **Location:** [backend/tests/](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/backend/tests/)
- **Total Tests:** **33 passing**
- **Modules Covered:**
  - `test_domain.py` (21 tests): Pure math helpers, haversine distances, ISO timestamp generators (`datetime.now(timezone.utc)`), Dijkstra travel-time hospital ranking, and dispatch simulation logic.
  - `test_routes.py` (12 tests): End-to-end REST API endpoints (`/api/sos`, `/api/incidents`, `/api/hospitals`, `/api/hospitals/{id}/stock`, `/api/myth-buster`, `/api/risk`, `/api/snake-id`, `/api/stats`, `/api/audit`, `/api/outbox`).

---

## Test Execution Commands

| Target | Command | Environment | Output / Duration |
|--------|---------|-------------|-------------------|
| Frontend Unit Tests | `cd frontend && npm test` | Node.js / Vitest | 16/16 passed (~2.2s) |
| Backend Unit Tests | `pytest backend/tests` | Python 3.12/3.13 | 33/33 passed (~0.3s) |
| Static Type Checking | `cd frontend && npx tsc --noEmit` | TypeScript | 0 errors |

---

*Updated: 2026-07-27*
