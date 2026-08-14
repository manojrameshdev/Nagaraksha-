# Testing Patterns

**Analysis Date:** 2026-08-14

## Test Framework

**Runner (backend):**
- pytest (no version pinned; CI installs latest via `pip install pytest pytest-cov pytest-asyncio ruff` in `.github/workflows/ci.yml:25`)
- Config: none — there is no `pytest.ini`, `pyproject.toml`, `setup.cfg`, or `tox.ini` anywhere in `backend/`. Async tests opt in explicitly (see below)

**Runner (frontend):**
- No frontend test framework is currently configured. No `vitest.config.*` exists, no `*.test.ts(x)`/`*.spec.ts(x)` files exist anywhere in `frontend/`
- CI still attempts to run Vitest: `npx vitest run` in `.github/workflows/ci.yml:58` — this job will fail because the current frontend has no vitest config, no `src/test/setup.ts`, and no test files (the `frontend/src/` prototype that had them was replaced by the `frontend/app` + `frontend/components` structure). See `.planning/debug/ci-frontend-setup-missing.md` for the history of the previous vitest setup

**Assertion Library:**
- Backend: plain Python `assert` (pytest style); no pytest.raises/approx/special assertion helpers in use
- Frontend: none currently

**Run Commands:**
```bash
cd backend && pytest tests/ -v            # Run all backend tests (CI form)
cd backend && pytest tests/test_domain.py # Single file
cd backend && pytest tests/ -k hospital   # Filter by keyword
cd backend && pytest --cov=app --cov-report=term-missing   # Coverage (pytest-cov installed in CI)
```

**CI lint/syntax gates (backend, `.github/workflows/ci.yml:27-37`):**
```bash
ruff check backend/app
python -m py_compile backend/app/*.py backend/app/routes/*.py
```

## Test File Organization

**Location:**
- Backend: all tests live in `backend/tests/` (not co-located) — `conftest.py` + `test_*.py`
- Frontend: none

**Naming:**
- Files: `test_<module>.py` mirroring the `backend/app/` module under test — `test_domain.py`, `test_routes.py`, `test_eventbus.py`, `test_compliance.py`, `test_rag.py`
- Classes: `Test<Thing>` (`TestHaversine`, `TestSOS`, `TestOutboxWorker`)
- Methods: `test_<behavior>` (`test_confirmed_ranked_first`, `test_accept_no_pending_attempt_409`)
- Helper functions for test setup are `_`-prefixed module-level functions: `_insert_incident_outbox()`, `_wait_until()` in `backend/tests/test_eventbus.py:15-64`, `_hospital()` in `backend/tests/test_compliance.py:7`

**Structure:**
```
backend/tests/
├── conftest.py          # shared fixtures + autouse background mocks
├── test_domain.py       # pure unit tests (no DB, no fixtures)
├── test_routes.py       # HTTP integration via ASGI transport (async)
├── test_eventbus.py     # outbox worker state machine (polls DB)
├── test_compliance.py   # DB-backed scoring tests
├── test_rag.py          # RAG fallback tests (ChromaDB patched out)
└── __init__.py          # empty package marker
```

## Test Structure

**Suite Organization:** Test classes group methods by domain area; class names read as nouns, methods as behavior:

```python
class TestStockFreshness:                                   # backend/tests/test_domain.py:65
    def test_out_of_stock(self):
        recent = datetime.now(timezone.utc).isoformat()
        res = stock_freshness("OUT", recent)
        assert res["stale"] is True
        assert res["tone"] == "red"
```

**Async suites** declare the asyncio marker once per module, then use `async def` tests:

```python
import pytest
from app import database as db

pytestmark = pytest.mark.asyncio                            # backend/tests/test_routes.py:4

class TestSOS:
    async def test_sos_creates_incident(self, async_client):
        resp = await async_client.post("/api/sos", json={"lat": 12.8, "lng": 77.6})
        assert resp.status_code == 200
```

Because there is no `pytest.ini`/`asyncio_mode = auto`, every async test file **must** include `pytestmark = pytest.mark.asyncio` (strict mode) or the async tests will be skipped.

**Patterns:**
- **Setup:** `conftest.py` runs module-level setup (temp DB + `db.init_db()`) before import of the app; fixtures do per-test data seeding
- **Teardown:** data-seeding fixtures delete their rows after `yield`; DB-backed unit tests use `try/finally` cleanup inline (`backend/tests/test_compliance.py:33-53`)
- **Assertion:** plain `assert` with `==`, `in`, `is True`, comparisons, and type checks (`isinstance(data["audit"], list)` in `backend/tests/test_routes.py:101`)

## Fixtures and Factories

**Test Data (conftest.py `backend/tests/conftest.py`):**

```python
@pytest.fixture
def async_client():
    transport = ASGITransport(app=app)          # httpx ASGI transport — no live server
    client = AsyncClient(transport=transport, base_url="http://test")
    return client

@pytest.fixture
def seeded_hospital():
    hid = "test-hosp-001"
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute("INSERT INTO Hospital ...", (hid, ...))
        conn.execute("INSERT INTO AntivenomStock ...", (...))
    yield hid
    with db.get_conn() as conn:                 # teardown deletes seeded rows
        conn.execute("DELETE FROM AntivenomStock WHERE hospitalId=?", (hid,))
        conn.execute("DELETE FROM Hospital WHERE id=?", (hid,))
```

**Critical setup ordering (`backend/tests/conftest.py:7-15`):** the test DB path must be assigned to `NAGRAKSHA_DB` *before* importing `app.database` / `app.main`, because `database.py:17` reads the env var at import time. `atexit` removes the temp file:

```python
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["NAGRAKSHA_DB"] = _db_path
from app import database as db
from app.main import app
db.init_db()

@atexit.register
def cleanup():
    os.close(_db_fd)
    os.unlink(_db_path)
```

**Location:** Fixtures live only in `backend/tests/conftest.py` (shared) or are inlined as `_`-prefixed helpers in each test file. No factory-boy/faker-style factories; rows are inserted with raw SQL through `db.get_conn()`.

## Mocking

**Framework:** `unittest.mock` (`patch`, `patch.object`) and pytest's `monkeypatch`.

**Autouse fixture** — the single most important mock: it patches the background worker + KB seeding for every test so the outbox thread and ChromaDB seeding never run during tests:

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
        yield                                       # backend/tests/conftest.py:18-27
```

**Patterns:**

```python
# patch.object for module internals (sleep no-op for fast worker tests)
with patch.object(eventbus.time, "sleep", lambda *a, **k: None):
    eventbus._worker_tick()                         # backend/tests/test_eventbus.py:69

# patch.object with side_effect to force failure paths
with patch.object(eventbus, "do_dispatch", side_effect=RuntimeError("boom")):
    ...                                             # backend/tests/test_eventbus.py:96

# monkeypatch.setattr to simulate unavailable external deps
monkeypatch.setattr(rag, "_get_collection", lambda: None)   # backend/tests/test_rag.py:11

# patch.object to stub return values
with patch.object(rag, "retrieve", return_value=[chunk]):
    ...                                             # backend/tests/test_rag.py:35

# monkeypatch.setenv for env-dependent behavior
monkeypatch.setenv("TWILIO_AUTH_TOKEN", "test-auth-token")  # backend/tests/test_routes.py:161
```

**What to Mock:**
- Background threads / schedulers (`start_worker`, `ensure_kb_seeded`) — always, via the autouse fixture
- External providers that would make network calls or download models: ChromaDB collection (`_get_collection`), LLM availability (`is_available`)
- Time (`time.sleep`) in worker tests to keep them fast
- Env vars that gate behavior (`TWILIO_AUTH_TOKEN`)

**What NOT to Mock:**
- The SQLite database — tests use the real DB layer (`db.get_conn()`) against a temp file, inserting/querying actual rows (asserts like `assert row["state"] == "DISPATCHING"` in `backend/tests/test_routes.py:32`)
- The FastAPI app itself — routes are exercised through the real app via `ASGITransport`

**Known untestable path:** the SSE stream endpoint `GET /api/incidents/{id}/stream` is deliberately not tested via ASGI transport because infinite streaming responses deadlock; this is documented in `backend/tests/test_routes.py:104-106`.

## Fixtures and Factories (frontend)

Not applicable — no frontend tests exist. If re-adding Vitest + Testing Library (as in the removed `frontend/src/` prototype), the prior setup required `frontend/src/test/setup.ts` with `import '@testing-library/jest-dom/vitest';` and a `jsdom` test environment (see `.planning/debug/ci-frontend-setup-missing.md`).

## Coverage

**Requirements:** None enforced. `pytest-cov` is installed in CI (`.github/workflows/ci.yml:25`) but the CI test command is plain `pytest tests/ -v` with no `--cov` flag, so coverage is not gated.

**View Coverage:**
```bash
cd backend && pytest tests/ --cov=app --cov-report=term-missing
```

**Coverage focus today:** `test_domain.py` (pure functions) and `test_routes.py` (integration) are the thickest suites. `test_rag.py` and `test_eventbus.py` cover fallback/failure paths. There is no coverage for `backend/app/routes/snake_id.py` (largest file, 378 lines), `backend/app/routes/wound.py`, `backend/app/routes/transcribe.py`, `backend/app/llm.py`'s cloud providers, or `backend/app/seed.py`.

## Test Types

**Unit Tests:**
- Pure-function tests with no fixtures/DB: `backend/tests/test_domain.py` (haversine, eta, freshness, ranking, ref generation, dispatch simulation)
- Guard/factory logic: `backend/tests/test_compliance.py::TestComplianceBadge`, `backend/tests/test_rag.py` (emergency guard short-circuit, fallback answers)

**Integration Tests:**
- HTTP route tests through the ASGI app: `backend/tests/test_routes.py` (SOS creates incident + outbox event, incidents CRUD + 404/409 paths, hospital stock updates, Twilio webhook auth/signature, query-param validation 422s)
- DB-backed state machine tests: `backend/tests/test_eventbus.py` (outbox → HANDED_OFF, retry → FAILED), `backend/tests/test_compliance.py::TestComputeComplianceScore/TestRunComplianceJob`
- `backend/tests/test_routes.py::TestSOS::test_sos_persists_to_db` verifies rows in SQLite after an API call

**E2E Tests:** Not used. No Playwright/Cypress/selenium anywhere.

## Common Patterns

**Async Testing (HTTP):**
```python
pytestmark = pytest.mark.asyncio                    # required per async module

async def test_sos_with_defaults(self, async_client):
    resp = await async_client.post("/api/sos", json={})
    assert resp.status_code == 200
    assert data["incident"]["lat"] == 12.8003        # backend/tests/test_routes.py:19-24
```

**Polling for async worker completion (no sleeps to wait out):**
```python
def _wait_until(predicate, timeout=15.0):
    deadline = _time.time() + timeout
    while _time.time() < deadline:
        if predicate():
            return True
        _time.sleep(0.05)
    return False                                     # backend/tests/test_eventbus.py:58-64

assert _wait_until(lambda: _incident_state(inc_id) == "HANDED_OFF"
                   and _outbox_state_for(inc_id) == "PROCESSED")
```

**Error-path Testing:**
```python
async def test_get_nonexistent(self, async_client):
    resp = await async_client.get("/api/incidents/does-not-exist")
    assert resp.status_code == 404                    # backend/tests/test_routes.py:48-50

async def test_accept_no_pending_attempt_409(self, async_client):
    ... # create incident first, then PATCH accept with no DispatchAttempt rows
    assert resp.status_code == 409                    # backend/tests/test_routes.py:68-73

async def test_signature_required_when_token_set(self, async_client, monkeypatch):
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "test-auth-token")
    ...
    assert resp.status_code == 403                    # backend/tests/test_routes.py:160-167
```

**Validation Tests (422s from FastAPI):**
```python
async def test_knowledge_base_non_numeric_k(self, async_client):
    resp = await async_client.get("/api/knowledge-base?k=abc")
    assert resp.status_code == 422                    # backend/tests/test_routes.py:183-185
```

## Frontend Testing Status & Guidance

- **Current state:** zero frontend tests, no runner config. The backend carries the entire test suite.
- **CI gap:** the `frontend-build` job in `.github/workflows/ci.yml:38-67` will fail at the Vitest step (no config/files), at `npm run lint` (no `eslint.config.mjs`), and possibly at `npm ci --legacy-peer-deps` (it points `cache-dependency-path` at `frontend/package-lock.json`, which does not exist — the frontend uses `pnpm-lock.yaml`).
- **If adding frontend tests:** use Vitest + @testing-library/react with a `jsdom` environment and a setup file importing `@testing-library/jest-dom/vitest` (matches the removed prototype and the CI step). Place tests co-located (`frontend/components/**/__tests__/` or `.test.tsx` siblings) and add `frontend/vitest.config.ts`. Update `.github/workflows/ci.yml` to `pnpm install`/`pnpm vitest run` and to a real eslint config path before relying on the CI gate.

---

*Testing analysis: 2026-08-14*
