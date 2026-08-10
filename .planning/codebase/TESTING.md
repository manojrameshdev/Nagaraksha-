# Testing Patterns

**Analysis Date:** 2026-08-11

Two independent test suites: Vitest 4 (frontend, `frontend/`) and pytest (backend, `backend/`). Both run in CI (`.github/workflows/ci.yml`).

## Test Framework

### Frontend

**Runner:**
- Vitest 4.1.10 (devDependency in `frontend/package.json`)
- Config: `frontend/vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, `setupFiles: './src/test/setup.ts'`, alias `'@'` → `./src`

**Assertion Library:**
- Vitest built-in `expect` + `@testing-library/jest-dom` matchers (registered in `frontend/src/test/setup.ts` via `import '@testing-library/jest-dom/vitest'`)

**Run Commands:**
```bash
npm test                  # from frontend/ — vitest run (all tests)
npm run test:watch        # vitest (watch mode)
npx vitest run            # CI invocation (.github/workflows/ci.yml)
```

### Backend

**Runner:**
- pytest (installed per CI step; also `pytest-asyncio` and `httpx` are installed in CI for async route tests — see `.github/workflows/ci.yml:44`)
- No pytest config file (no `pytest.ini`/`pyproject.toml`/`setup.cfg`/`tox.ini` in `backend/`); defaults apply
- Dependencies from `backend/requirements.txt`

**Run Commands:**
```bash
python -m pytest tests/ -v     # from backend/ (CI invocation)
pytest tests/                  # plain run
```

## Test File Organization

**Location:**
- Frontend: co-located under a `__tests__/` directory next to the code it tests — `frontend/src/lib/__tests__/eventbus.test.ts`, `frontend/src/lib/__tests__/nagraksha.test.ts`
- Backend: all tests in a single `backend/tests/` directory — `backend/tests/test_domain.py` (pure unit), `backend/tests/test_routes.py` (API), plus shared fixtures in `backend/tests/conftest.py`

**Naming:**
- Frontend: `*.test.ts` / `*.test.tsx` (also lint-ignored in `frontend/eslint.config.mjs` ignores)
- Backend: `test_*.py` with `test_`-prefixed methods

**Structure:**
```
frontend/src/lib/__tests__/      # unit tests for lib modules
backend/tests/
├── conftest.py                  # shared fixtures + temp DB setup
├── test_domain.py               # pure domain/helper unit tests
└── test_routes.py               # async API integration tests
```

## Test Structure

**Suite Organization (frontend):**
```typescript
// frontend/src/lib/__tests__/eventbus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    // ...every Prisma model the module touches is stubbed
  },
}));

const { getBus } = await import('../eventbus'); // dynamic import AFTER vi.mock

describe('eventbus', () => {
  it('getBus returns a singleton', () => {
    const bus1 = getBus();
    const bus2 = getBus();
    expect(bus1).toBe(bus2);
  });
});
```

**Suite Organization (backend):**
```python
# backend/tests/test_domain.py
class TestHaversine:
    def test_zero_distance(self):
        assert haversine_km(12.8, 77.6, 12.8, 77.6) == 0.0
```

```python
# backend/tests/test_routes.py
import pytest
from app import database as db

pytestmark = pytest.mark.asyncio  # module-level marker for all async tests

class TestSOS:
    async def test_sos_creates_incident(self, async_client):
        resp = await async_client.post("/api/sos", json={"lat": 12.8, "lng": 77.6})
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"]["state"] == "DISPATCHING"
```

**Patterns:**
- Frontend: `describe` blocks per function/module; plain `it` names describing behaviour; assertions on exact values, ranges (`toBeGreaterThan`, `toBeGreaterThanOrEqual`), `toMatchObject` with `expect.any(Number)`, and `as const` fixtures
- Backend: test classes group related cases (`TestHaversine`, `TestRoadKm`, `TestEtaMin`, `TestMinsAgo`, `TestStockFreshness`, `TestRankHospitals`, `TestGenIncidentRef`, `TestSimulateDispatch`, `TestSOS`, `TestIncidents`, `TestHospitals`); fixture params injected via function arguments (`async_client`, `seeded_hospital`)
- Backend API tests exercise the full ASGI app through `httpx.ASGITransport` — no network, no uvicorn process

## Mocking

**Framework:** Frontend uses Vitest `vi.mock`/`vi.fn`. Backend uses `unittest.mock.patch` via pytest fixtures.

**Frontend patterns:**
```typescript
// frontend/src/lib/__tests__/eventbus.test.ts
vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    dispatchAttempt: { create: vi.fn(), update: vi.fn() },
    incident: { update: vi.fn() },
    auditEvent: { create: vi.fn() },
    hospital: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
```
- The module under test is imported dynamically with `await import(...)` AFTER the `vi.mock` factory so the mock applies (`frontend/src/lib/__tests__/eventbus.test.ts:27`)
- `vi.fn()` spies for event handlers: `const handler = vi.fn(); bus.on('IncidentCreated', handler); ... expect(handler).toHaveBeenCalledOnce();`

**Backend patterns (`backend/tests/conftest.py`):**
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
- An `autouse` fixture patches every background worker/seed entry point so tests are deterministic
- Mock paths target the import site of each caller (module-qualified: `app.routes.sos.start_worker`), not just the definition

**What to Mock:**
- Frontend: the Prisma client (`@/lib/db`) — network/database boundary
- Backend: worker threads and LLM/RAG seeding (`start_worker`, `ensure_kb_seeded`) — anything spawning threads or making external calls

**What NOT to Mock:**
- Real SQLite database (backend) — tests use a real temp DB and verify persisted rows via `db.get_conn()` (`backend/tests/test_routes.py:26-33, 35-44`)
- Pure domain functions — they are tested directly with real inputs (both suites)
- The HTTP/ASGI stack — route tests run against the real `app.main:app`

## Fixtures and Factories

**Backend conftest (`backend/tests/conftest.py`):**
```python
# temp SQLite DB redirected before any app import
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["NAGRAKSHA_DB"] = _db_path
from app import database as db
from app.main import app
...
db.init_db()

@atexit.register
def cleanup():  # closes fd + unlinks temp db at interpreter exit
    ...
```
- `async_client` fixture: `ASGITransport(app=app)` + `AsyncClient(transport=transport, base_url="http://test")` (`conftest.py:30-34`)
- `seeded_hospital` fixture: inserts a hospital + a `CONFIRMED` stock row via raw SQL, yields the id, deletes both in teardown (`conftest.py:37-56`)

**Test Data (frontend):**
- Inline object literals typed with `as const` on the discriminator field: `status: 'LOW' as const` (`frontend/src/lib/__tests__/nagraksha.test.ts:78`)
- Time-relative fixtures built at runtime: `new Date(Date.now() - 7_260_000).toISOString()` for stale stock (`frontend/src/lib/__tests__/nagraksha.test.ts:111`)
- Origin constant inside the describe block: `const origin = { lat: 12.97, lng: 77.59 };` (`frontend/src/lib/__tests__/nagraksha.test.ts:71`)

**Location:**
- Backend fixtures: `backend/tests/conftest.py` only
- Frontend: fixtures are inline in each test file; no shared factory modules

## Coverage

**Requirements:** None enforced — no coverage threshold config in `frontend/vitest.config.ts`, no `--cov` flags in CI, no `.coveragerc`/`coverage` config. `.gitignore` ignores `/coverage`.

**View Coverage:**
```bash
npx vitest run --coverage    # frontend (requires @vitest/coverage provider — not currently a devDependency)
```

## Test Types

**Unit Tests (frontend):**
- Pure domain helpers in `frontend/src/lib/__tests__/nagraksha.test.ts`: haversine, road factor, ETA speeds, minutes-ago, stock freshness tones, hospital ranking (order, penalty for stale confirmed stock, recommended flag)
- Event bus singleton behaviour in `frontend/src/lib/__tests__/eventbus.test.ts`

**Unit Tests (backend):**
- `backend/tests/test_domain.py`: mirror of the frontend domain tests — haversine known-distance sanity ranges, road multiplier, ETA bounds, `mins_ago` edge cases (future, invalid ISO), freshness tones, ranking order, `gen_incident_ref` format/uniqueness, `simulate_dispatch` three-lane structure

**Integration Tests (backend):**
- `backend/tests/test_routes.py`: real ASGI app + real temp SQLite DB
  - POST `/api/sos` — response shape, defaults, DB persistence, outbox `IncidentCreated` row with `PENDING` state
  - GET `/api/incidents/{id}` and `/api/incidents/{id}/audit` — nested relations and audit/outbox lists
  - GET `/api/hospitals` — empty vs seeded list, custom origin query params, `recommended` + stock status
  - PATCH `/api/hospitals/{id}/stock` — status update and "Hospital not found" error path

**E2E Tests:** Not used. SSE streaming is explicitly excluded from route tests with an explanatory comment (`backend/tests/test_routes.py:76-78`): "SSE stream endpoint cannot be tested via httpx ASGI transport (deadlocks on infinite streaming responses)."

## Common Patterns

**Async Testing (backend):**
```python
pytestmark = pytest.mark.asyncio  # module-level; all test methods are `async def`

async def test_sos_persists_to_db(self, async_client):
    resp = await async_client.post("/api/sos", json={"lat": 12.0, "lng": 77.0})
    inc_id = resp.json()["incident"]["id"]
    with db.get_conn() as conn:
        row = conn.execute("SELECT id, state, lat, lng FROM Incident WHERE id=?", (inc_id,)).fetchone()
        assert row is not None
        assert row["state"] == "DISPATCHING"
```

**Error Testing:**
```typescript
// frontend/src/lib/__tests__/nagraksha.test.ts — edge-case assertions
it('returns at least 2 minutes', () => {
  expect(etaMin(0.1)).toBe(2);
});
it('returns 0 for future dates', () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  expect(minsAgo(future)).toBe(0);
});
```
```python
# backend/tests/test_domain.py — defensive behavior
def test_invalid_iso_returns_zero(self):
    assert mins_ago("not-a-date") == 0
```

**Behavioural Range Assertions (backend):**
```python
def test_bangalore_to_mysore(self):
    dist = haversine_km(12.97, 77.59, 12.30, 76.65)
    assert 120 < dist < 150
```

## Coverage Gaps

- Frontend has NO component tests — no `*.test.tsx` files exist; `frontend/src/components/*` and `frontend/src/hooks/*` are untested
- Frontend has no tests for `frontend/src/lib/api.ts`, `frontend/src/lib/db.ts`, or `frontend/src/lib/knowledge-base.ts`
- Backend `app/routes/` modules other than SOS/incidents/hospitals (`risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `architecture.py`, `ops.py`, `transcribe.py`) have no direct tests (the RAG/LLM path in `backend/app/rag.py`, `backend/app/llm.py`, `backend/app/routes/myth_buster.py` is untested)
- SSE streaming endpoint is intentionally untested (`backend/app/routes/incidents.py:63-107`)
- No coverage thresholds are enforced anywhere

---

*Testing analysis: 2026-08-11*
