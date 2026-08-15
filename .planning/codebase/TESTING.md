# Testing Patterns

**Analysis Date:** 2026-08-15

## Test Framework

**Runner:**
- Backend: Pytest + `pytest-asyncio` + `pytest-cov` (CI installs these); config: none (defaults, `pytest.ini` absent)
- Frontend: Vitest 4.1.10; config: `frontend/vitest.config.ts` (jsdom, `globals: true`, `setupFiles: ./test/setup.ts`, `@` alias)

**Assertion Library:**
- Backend: pytest asserts + `httpx.AsyncClient` via `ASGITransport`
- Frontend: Vitest built-in `expect` (toBe, toEqual, toMatchObject, toHaveBeenCalledWith)

**Run Commands:**
```bash
cd backend && pytest tests/ -v          # Backend: all tests (61)
cd frontend && npx vitest run           # Frontend: all tests (vitest config has no `test` script)
cd frontend && npx vitest run src/lib   # Frontend: single file/path
```
Root has no unified test script; CI runs each separately (`.github/workflows/ci.yml`).

## Test File Organization

**Location:**
- Backend: `backend/tests/` — one file per module (`test_domain.py`, `test_routes.py`, `test_compliance.py`, `test_rag.py`, `test_eventbus.py`)
- Frontend: `frontend/lib/__tests__/` (`api.test.ts`, `nagraksha.test.ts`) + shared infra in `frontend/test/` (`handlers.ts`, `setup.ts`)

**Naming:**
- Backend: `test_<module>.py`; test functions `test_<scenario>`
- Frontend: `<module>.test.ts`

**Structure:**
```
backend/tests/
  conftest.py          # temp SQLite DB + background-worker mocks + fixtures
  test_routes.py       # 27 route tests (SOS, incidents, hospitals, …)
  test_domain.py       # 21 geo/dispatch/ETA/stock tests
  test_compliance.py   # 6 compliance scoring tests
  test_rag.py          # 5 retrieval tests
  test_eventbus.py     # 2 outbox tests

frontend/lib/__tests__/
  api.test.ts          # apiFetch unit tests (error/status handling)
  nagraksha.test.ts    # typed API layer vs MSW handlers
frontend/test/
  handlers.ts          # MSW request handlers mirroring the real backend
  setup.ts             # setupServer lifecycle (beforeAll/afterEach/afterAll)
```

## Test Structure

**Backend suite organization:**
```python
import pytest
from app import database as db

pytestmark = pytest.mark.asyncio

class TestSOS:
    async def test_sos_creates_incident(self, async_client):
        resp = await async_client.post("/api/sos", json={"lat": 12.8, "lng": 77.6})
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"]["state"] == "DISPATCHING"
```

**Frontend suite organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('apiFetch', () => {
  it('throws ApiError with status on non-2xx', async () => {
    // arrange / act / assert
  });
});
```

**Patterns:**
- Backend: class-per-feature (`TestSOS`, `TestIncidents`) with `pytestmark = pytest.mark.asyncio`; fixtures `async_client`, `seeded_hospital`
- Frontend: `describe`/`it`, async `await` for API calls; MSW server shared via `frontend/test/setup.ts`

## Mocking

**Backend:**
- `conftest.py` autouse fixture patches background work so tests are deterministic and don't spawn threads/SMS:
```python
@pytest.fixture(autouse=True)
def mock_background():
    with (
        patch("app.eventbus.start_worker", return_value=None),
        patch("app.routes.sos.start_worker", return_value=None),
        patch("app.routes.incidents.start_worker", return_value=None),
        patch("app.main.start_worker", return_value=None),
        patch("app.main.ensure_kb_seeded", return_value=None),
    ):
        yield
```
- DB isolation: `conftest.py` sets `NAGRAKSHA_DB` to a `tempfile.mkstemp` DB before importing `app`, so tests never touch the real DB
- `httpx.ASGITransport(app=app)` + `AsyncClient(base_url="http://test")` — full in-process app, real routes

**Frontend (MSW):**
- `frontend/test/handlers.ts` mocks the HTTP layer with shapes that match the real backend (health, auth/token, sos, incidents, hospitals, …)
- `frontend/test/setup.ts`:
```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
- Unit-level mocking: `vi` (Vitest) for functions/modules where needed

**What to Mock:**
- Backend: background workers (start_worker, ensure_kb_seeded), external SMS/LLM providers (by not setting credentials)
- Frontend: all HTTP via MSW; timers/geolocation not currently mocked

**What NOT to Mock:**
- Real route handlers in backend tests (ASGITransport hits actual endpoints)
- Internal pure functions (`backend/app/domain.py` is tested directly, not mocked)

## Fixtures and Factories

**Backend fixtures (`backend/tests/conftest.py`):**
```python
@pytest.fixture
def seeded_hospital():
    hid = "test-hosp-001"
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute("INSERT INTO Hospital (id, name, lat, lng, address, contact, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)", ...)
        conn.execute("INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) VALUES (?, ?, ?, ?, ?, ?, ?)", ...)
    yield hid
    # teardown deletes Hospital + AntivenomStock
```
- Temp DB cleaned up via `atexit`

**Frontend fixtures:**
- MSW handler payloads inline in `frontend/test/handlers.ts` (e.g. SOS response with 3 dispatch lanes)

## Coverage

**Requirements:**
- No enforced coverage target; no coverage thresholds in CI or config
- `pytest-cov` installed in CI but not invoked with thresholds

**Configuration:**
- None (no coverage config in `vitest.config.ts` or pytest config)

## Test Types

**Unit Tests:**
- Backend: `test_domain.py` (21 tests) — pure helpers (haversine, ETA, stock freshness, incident refs); `test_compliance.py` (6) — scoring formula
- Frontend: `frontend/lib/__tests__/api.test.ts` — `apiFetch` behavior (headers, token, error handling)

**Integration Tests:**
- Backend: `test_routes.py` (27) — full HTTP flow through real FastAPI app + real SQLite temp DB, background side-effects mocked
- Frontend: `frontend/lib/__tests__/nagraksha.test.ts` — typed API functions against MSW-mocked endpoints; MSW handlers intentionally mirror backend response shapes (contract tests)

**E2E Tests:**
- None (no Playwright/Cypress)

## Common Patterns

**Async API testing (frontend):**
```typescript
it('returns typed SOS response', async () => {
  const res = await triggerSos({ lat: 12.8, lng: 77.6 });
  expect(res.incident.state).toBe('DISPATCHING');
});
```

**Error Testing:**
```python
async def test_get_nonexistent(self, async_client):
    resp = await async_client.get("/api/incidents/does-not-exist")
    assert resp.status_code == 404
```
```typescript
it('throws ApiError on 401', async () => {
  await expect(apiFetch('/api/auth/token', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 });
});
```

**Snapshot Testing:**
- Not used; explicit assertions preferred

---

*Testing analysis: 2026-08-15*
*Update when test patterns change*
