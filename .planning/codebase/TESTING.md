# TESTING.md — Testing Strategy & Coverage

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## Test Summary

| Layer | Framework | Count | Status |
|-------|-----------|-------|--------|
| Backend routes | pytest (async httpx ASGI) | 33 | ✅ All passing |
| Backend domain | pytest (unit) | ~10 | ✅ All passing |
| Frontend components | Vitest + jsdom + @testing-library/react | 16 | ✅ All passing |
| TypeScript types | tsc --noEmit | — | ✅ Clean |
| ESLint | eslint (0 warnings mode) | — | ✅ Clean |
| Security | Bandit | — | ✅ Clean |

---

## Backend Tests

### Test Infrastructure (`conftest.py`)

- **Isolated SQLite DB**: `tempfile.mkstemp()` creates a fresh DB per test session — never touches production DB
- **Background worker mocked**: `patch("app.eventbus.start_worker", return_value=None)` prevents threading in tests
- **KB seeding mocked**: `patch("app.main.ensure_kb_seeded", return_value=None)` keeps tests fast
- **ASGI transport**: `httpx.ASGITransport(app=app)` + `AsyncClient` for zero-network route testing
- **`seeded_hospital` fixture**: Inserts + cleans up a confirmed-stock hospital for hospital ranking tests

### Route Tests (`test_routes.py`)

| Class | Tests |
|-------|-------|
| `TestSOS` | Creates incident, uses defaults, persists to DB, creates outbox event |
| `TestIncidents` | Get nonexistent, get real, get audit trail |
| `TestHospitals` | Empty list, seeded list, custom origin, update stock, stock not found |

**Note**: SSE stream endpoint (`/api/incidents/:id/stream`) cannot be tested via httpx ASGI transport (deadlocks on infinite generators). Tested manually.

### Domain Unit Tests (`test_domain.py`)

Tests for: `haversine_km`, `road_km`, `eta_min`, `stock_freshness`, `rank_hospitals`, `simulate_dispatch`, `gen_incident_ref`

### Running Backend Tests

```bash
cd backend
python -m pytest tests/ -q          # quiet
python -m pytest tests/ -v          # verbose
bandit -r . -c ../.bandit.yaml      # security scan
```

---

## Frontend Tests

### Test Infrastructure

- **Vitest** with jsdom environment
- **@testing-library/react** for component rendering
- **@testing-library/jest-dom** for DOM assertions

### Running Frontend Tests

```bash
cd frontend
npm test                 # vitest run (CI mode)
npm run test:watch       # vitest interactive
npx tsc --noEmit         # type check only
npm run lint             # eslint 0 warnings
```

---

## CI Pipeline (`.github/workflows/ci.yml`)

```yaml
on: push/PR to main

jobs:
  frontend:
    - npm ci
    - npx eslint . --max-warnings 0
    - npx tsc --noEmit
    - npx vitest run

  backend:
    - pip install -r requirements.txt
    - pip install bandit pytest httpx pytest-asyncio
    - bandit -r . -c ../.bandit.yaml
    - python -m pytest tests/ -v

  gatekeeper:
    needs: [frontend, backend]
    - Fails if either job fails (blocks merge)
```

---

## Coverage Gaps

| Area | Gap | Priority |
|------|-----|----------|
| SSE stream | Cannot test via httpx ASGI; no integration test | Medium |
| Snake ID Grok Vision | External API not mocked in tests | Medium |
| Geolocation hook | Browser-only API; not tested via vitest | Low |
| Dispatch simulation | `simulate_dispatch` returns fixed data; no edge-case tests | Low |
| RAG pipeline | LLM generation path not unit-tested (uses real TF-IDF index) | Low |

---

## Process Standards

- **Commit triggers**: After every CI pass, milestone completion, or debug session resolution
- **All tests must pass** before any commit that touches source code
- **Lint must be 0 warnings** — `--max-warnings 0` enforced in CI
- **Bandit must be clean** — no unresolved security findings
