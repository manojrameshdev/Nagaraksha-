# Testing Strategy & Patterns

**Analysis Date:** 2026-08-16

## Testing Architecture

NagRaksha employs a comprehensive test suite across both frontend and backend to guarantee zero regressions across clinical decision engines, real-time dispatching, and UI state flows.

```
 +--------------------------------------------------------+
 ¦                   Backend Test Suite                   ¦
 ¦  - 94 Pytest tests in backend/tests/                   ¦
 ¦  - Temp-file SQLite database isolation                 ¦
 ¦  - Mocked outbox workers & ASGI AsyncClient            ¦
 +--------------------------------------------------------+

 +--------------------------------------------------------+
 ¦                   Frontend Test Suite                  ¦
 ¦  - 19 Vitest tests in frontend/lib/ and components/    ¦
 ¦  - Mock Service Worker (MSW) for API interception      ¦
 ¦  - JSDOM & React Testing Library for components        ¦
 +--------------------------------------------------------+
```

## Backend Testing (`backend/tests/`)

- **Runner:** `pytest -v` (configured via `backend/tests/conftest.py`).
- **Database Isolation:** Every test session runs against an isolated, temporary SQLite database (`tempfile.mkstemp(suffix=".db")`) initialized at runtime. Fixtures clean up tables and state after execution.
- **Background Worker Disabling:** `mock_background` fixture automatically mocks out `eventbus.start_worker` and scheduled jobs during test execution to prevent race conditions.
- **Coverage Areas:**
  - `test_domain.py`: Haversine distance, road multipliers, hospital composite ranking, stock freshness decay, and VenomScore clinical classification (neurotoxic, hemotoxic, dry bite, antivenom vials).
  - `test_routes.py`: SOS creation, incident retrieval, symptom logging, responder accept/decline, wound reading persistence, and the end-to-end `TestVenomScoreHospitalLoop` WebSocket broadcast.
  - `test_eventbus.py`: Outbox event appending, transaction boundaries, and simulated dispatch fanout.
  - `test_seed_demo.py`: Karnataka hospital seed verification, compliance scores, stakeholder records, and idempotency across repeated runs.

## Frontend Testing (`frontend/`)

- **Runner:** `vitest run` (configured in `frontend/vitest.config.ts`).
- **Mock Service Worker (MSW):** `frontend/test/handlers.ts` intercepts all API network requests and returns deterministic, type-compliant response payloads.
- **Component & Unit Testing:**
  - `frontend/lib/__tests__/api.test.ts`: Verifies base fetch wrapper, auth headers, and error handling.
  - `frontend/lib/__tests__/nagraksha.test.ts`: Verifies typed API helpers, SOS triggers, symptom logging, and VenomScore client calls.
  - `frontend/components/__tests__/venom-score.test.tsx`: Tests MediaPipe initialization, baseline establishment, 10s scheduled single-flight submissions, and camera error handling.

## Running Tests Locally

```bash
# Run backend tests
cd backend && python -m pytest tests/ -v

# Run frontend tests
cd frontend && npx vitest run

# Run full CI check suite
cd frontend && pnpm run lint && npx tsc --noEmit && pnpm run build
```
