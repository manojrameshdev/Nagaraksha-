# Testing Strategy & Patterns

**Analysis Date:** 2026-08-16

## Testing Architecture

NagRaksha employs a comprehensive test suite across both frontend and backend to guarantee zero regressions across clinical decision engines, real-time dispatching, referral lifecycle, and UI state flows.

```
 +--------------------------------------------------------+
 |                   Backend Test Suite                    |
 |  - 103 tests collected in backend/tests/                |
 |  - Temp-file SQLite database isolation                  |
 |  - Mocked outbox workers & ASGI AsyncClient             |
 +--------------------------------------------------------+

 +--------------------------------------------------------+
 |                   Frontend Test Suite                   |
 |  - 24 Vitest tests (lib/__tests__ + components/__tests__)|
 |  - Mock Service Worker (MSW) for API interception       |
 |  - JSDOM & React Testing Library for components         |
 +--------------------------------------------------------+
```

## Backend Testing (`backend/tests/`)

- **Runner:** `pytest -v` (configured via `backend/tests/conftest.py`).
- **Database Isolation:** Every test session runs against an isolated, temporary SQLite database (`tempfile.mkstemp(suffix=".db")`) initialized at runtime. Fixtures clean up tables and state after execution.
- **Background Worker Disabling:** `mock_background` fixture automatically mocks out `eventbus.start_worker` and scheduled jobs during test execution to prevent race conditions.
- **Coverage Areas (103 collected):**
  - `test_domain.py` (44): Haversine distance, road multipliers, hospital composite ranking, stock freshness decay, VenomScore clinical classification (neurotoxic, hemotoxic, dry bite, antivenom vials), and Care Corridor capability-gap evaluation + capable-hospital hard-filter ranking (`evaluate_capability_gap`, `rank_capable_hospitals`).
  - `test_routes.py` (40): SOS creation, incident retrieval, symptom logging, responder accept/decline, wound reading persistence, referral create/accept/decline/transport/arrive lifecycle + 409 state-machine guards, corridor timeline assembly, and the end-to-end `TestVenomScoreHospitalLoop` WebSocket broadcast.
  - `test_compliance.py` (6): hospital compliance scoring.
  - `test_seed_demo.py` (7): Karnataka hospital seed verification, compliance scores, stakeholder records, and idempotency across repeated runs.
  - `test_rag.py` (5): ChromaDB retrieval + TF-IDF fallback.
  - `test_eventbus.py` (2): outbox event appending, transaction boundaries, and simulated dispatch fanout.

## Frontend Testing (`frontend/`)

- **Runner:** `vitest run` (configured in `frontend/vitest.config.ts`).
- **Mock Service Worker (MSW):** `frontend/test/handlers.ts` intercepts all API network requests and returns deterministic, type-compliant response payloads — including referral and corridor endpoints so component tests exercise the full client flow.
- **Component & Unit Testing (24):**
  - `frontend/lib/__tests__/api.test.ts` (4): base fetch wrapper, auth headers, and error handling.
  - `frontend/lib/__tests__/nagraksha.test.ts` (11): typed API helpers, SOS triggers, symptom logging, VenomScore client calls, and `evaluateReferral` capability/recommendation shape.
  - `frontend/components/__tests__/venom-score.test.tsx` (6): MediaPipe initialization, baseline establishment, 10s scheduled single-flight submissions, and camera error handling.
  - `frontend/components/__tests__/care-corridor-timeline.test.tsx` (3): 8-stage timeline rendering, referral accept/decline actions, and role-based action visibility.

## Running Tests Locally

```bash
# Run backend tests
cd backend && python -m pytest tests/ -v

# Run frontend tests
cd frontend && npx vitest run

# Run full CI check suite
cd frontend && pnpm run lint && npx tsc --noEmit && pnpm run build
```
