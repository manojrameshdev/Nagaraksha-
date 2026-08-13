# Testing Patterns

**Analysis Date:** 2026-08-13

## Test Framework

**Runner:**
- Backend: pytest (installed ad-hoc in CI; not pinned in `backend/requirements.txt`)
  - Config: none dedicated (default discovery in `backend/tests/`); `backend/tests/conftest.py` handles fixtures
- Frontend: Vitest 4.1.10 (`frontend/package.json`)
  - Config: `frontend/vitest.config.ts` — jsdom environment, globals true, setup `./src/test/setup.ts`, `@` alias to `./src`

**Assertion Library:**
- pytest `assert`
- Vitest `expect` + `@testing-library/jest-dom` matchers (`frontend/src/test/setup.ts`)

**Run Commands:**
```bash
cd backend && pytest tests/ -v     # Run all backend tests
cd frontend && npx vitest run       # Run all frontend tests
cd frontend && npx vitest           # Watch mode
cd frontend && npx vitest run --coverage   # Coverage (not configured)
```

## Test File Organization

**Location:**
- Backend: dedicated `backend/tests/` directory — `conftest.py`, `test_domain.py`, `test_routes.py`
- Frontend: co-located in `frontend/src/lib/__tests__/` (`nagraksha.test.ts`, `eventbus.test.ts`)

**Naming:**
- Backend: `test_<module>.py`
- Frontend: `<module>.test.ts`

**Structure:**
```
backend/tests/
├── conftest.py            # temp DB env, autouse background mocks, async client, seeded hospital fixture
├── test_domain.py         # pure domain function unit tests (haversine, eta, rank, simulate_dispatch)
└── test_routes.py         # HTTP integration via ASGITransport (sos, incidents, hospitals)
frontend/src/lib/__tests__/
├── nagraksha.test.ts      # TS domain mirror tests (13 passing)
└── eventbus.test.ts       # legacy Prisma bus tests — BROKEN (imports deleted ../eventbus)
```

## Test Structure

**Backend (pytest):**
```python
class TestSOS:
    async def test_sos_creates_incident(self, async_client):
        resp = await async_client.post("/api/sos", json={"lat": 12.8, "lng": 77.6})
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"]["state"] == "DISPATCHING"
        assert data["incident"]["lat"] == 12.8
        assert data["ref"].startswith("NR-")
        assert "streamUrl" in data
```

**Frontend (vitest):**
```typescript
describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });
});
```

**Patterns:**
- Backend: classes group endpoint areas (`TestSOS`, `TestIncidents`, `TestHospitals`); domain tests group by function (`TestHaversine`, `TestEtaMin`, `TestRankHospitals`)
- Backend integration tests use `pytest.mark.asyncio` on the module (`test_routes.py:4`)
- Frontend: `describe`/`it` per function; no `beforeEach`/`afterEach` used in current tests
- Assert on response shape + key fields, not full snapshots

## Mocking

**Framework:**
- Backend: `unittest.mock.patch` in `backend/tests/conftest.py`
- Frontend: Vitest `vi.mock`/`vi.fn()`

**Patterns (backend):**
```python
@pytest.fixture(autouse=True)
def mock_background():
    with (
        patch("app.eventbus.start_worker", return_value=None),
        patch("app.routes.sos.start_worker", return_value=None),
        patch("app.main.start_worker", return_value=None),
        patch("app.main.ensure_kb_seeded", return_value=None),
    ):
        yield
```

**Patterns (frontend):**
```typescript
vi.mock('@/lib/db', () => ({
  db: { outboxEvent: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) } },
}));
```

**What to Mock:**
- Backend: background threads (`start_worker`), KB seeding, external services (via fail-open design — LLM/SMS fall back naturally without keys)
- Frontend: DB layer, network (EventSource/fetch are exercised against real dev backend in manual flows; no HTTP mocking library installed)

**What NOT to Mock:**
- Domain pure functions (tested directly with real inputs)
- SQLite (`conftest.py` points `NAGRAKSHA_DB` at a real temp DB file, exercising real queries)

## Fixtures and Factories

**Backend (`backend/tests/conftest.py`):**
- `mock_background` (autouse): patches worker startup + KB seeding for every test
- `async_client`: `httpx.AsyncClient` over `ASGITransport(app=app)` with `base_url="http://test"`
- `seeded_hospital`: inserts a Hospital + CONFIRMED AntivenomStock row, yields id, cleans up
- Temp DB: `tempfile.mkstemp()` + `os.environ["NAGRAKSHA_DB"]` set at module import; `atexit` cleanup

**Frontend:**
- No fixtures/factories; test data built inline in tests

## Coverage

**Requirements:** None enforced. No coverage config in `vitest.config.ts` or pytest; CI runs tests but does not gate on coverage.

**View Coverage:**
```bash
cd frontend && npx vitest run --coverage
cd backend && pytest --cov=app tests/
```

## Test Types

**Unit Tests:**
- Backend: `backend/tests/test_domain.py` — haversine, road factor, ETA, stock freshness, hospital ranking, incident refs, dispatch simulation shape
- Frontend: `frontend/src/lib/__tests__/nagraksha.test.ts` — TS mirror of the same domain math

**Integration Tests:**
- Backend: `backend/tests/test_routes.py` — full HTTP flow through the FastAPI app with a real temp SQLite DB (SOS creation, incident fetch, audit, hospital listing, stock update)

**E2E Tests:**
- Not used. Live flows (SSE, WebSocket, Twilio webhook, wound upload, vision) are exercised manually against the running stack; `test_routes.py` notes SSE cannot be tested via ASGI transport (`test_routes.py:75-77`)

## Common Patterns

**Async Testing (backend):**
```python
pytestmark = pytest.mark.asyncio

async def test_sos_creates_incident(self, async_client):
    resp = await async_client.post("/api/sos", json={"lat": 12.8, "lng": 77.6})
```

**Error Testing:**
```python
async def test_update_stock_not_found(self, async_client):
    resp = await async_client.patch("/api/hospitals/nonexistent/stock", json={"status": "OUT"})
    assert resp.status_code == 200
    assert data["error"] == "Hospital not found"
```

**Snapshot Testing:**
- Not used. Explicit assertions preferred.

## Gaps

- Frontend vitest is **not run in CI** (`.github/workflows/ci.yml` frontend-build job only builds) — a broken test (`eventbus.test.ts` importing deleted `../eventbus`) passes CI silently
- No backend tests for RAG (`rag.py`), LLM chain (`llm.py`), wound route, audit routes, stakeholders, twilio_webhook, or WS broadcast
- No tests for the outbox worker's `_handle_incident_created` state machine (sleeps make it slow to test)
- No tests for `backend/app/dispatch.py` (dead module) or `backend/app/compliance.py`
- No coverage threshold enforced on either side

---

*Testing analysis: 2026-08-13*
