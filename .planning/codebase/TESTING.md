# Testing Patterns

**Analysis Date:** 2026-07-25

## Current Status (Honest Assessment)

**No tests exist anywhere in the codebase.**

This is a deliberate, acknowledged decision — this is a hackathon prototype (Nagathon 2026) built under extreme time constraints. Key evidence:

- **Zero test files:** `*.test.*`, `*.spec.*`, `__tests__/` — none found in any directory
- **No test dependencies in `package.json`:** No Jest, Vitest, Mocha, Playwright, Cypress — not even in devDependencies. The only devDependencies are `eslint`, `eslint-config-next`, `tailwindcss`, `typescript`, and `@types/*`
- **No test scripts:** Both `package.json` files have zero test commands:
  ```json
  // Root package.json — only dev, lint, db:push, db:generate, backend:seed
  // frontend/package.json — only dev, build, start, lint, db:push, db:generate
  ```
- **No test framework config:** No `jest.config.*`, `vitest.config.*`, `.mocharc.*`
- **No CI/CD pipeline:** No `.github/` directory, no CI config files
- **No Python test infrastructure:** No `pytest`, `unittest`, `tox`, `pytest.ini`, no `test_*.py` files

**Explicit design choices that make testing harder:**
- `ignoreBuildErrors: true` in `next.config.ts` means TypeScript errors never block builds
- `noImplicitAny: false` in `tsconfig.json` allows implicit `any` types
- ESLint has every rule disabled — no static analysis guardrails
- Global singleton state (`globalThis.__nagrakshaBus`, `globalForPrisma`) makes test isolation harder
- Python uses raw `sqlite3` with side-effecting global state (module-level `_subscribers`, `_model`)

## Test Framework (Suggested for Post-Hackathon)

**Recommended for TypeScript (frontend):**

```
vitest          # Fast, compatible with Next.js/React
@testing-library/react   # Component testing
@testing-library/jest-dom  # Custom DOM matchers
@vitejs/plugin-react  # React plugin for Vitest
```

**Recommended for Python (backend):**

```
pytest           # Standard Python test runner
httpx            # Already a dependency — use for async API testing
pytest-cov       # Coverage reporting
```

## Test Structure (Suggested)

### Suggested directory layout

```
frontend/
├── src/
│   ├── __tests__/              # Unit tests mirroring src structure
│   │   ├── lib/
│   │   │   ├── nagraksha.test.ts
│   │   │   ├── eventbus.test.ts
│   │   │   └── api.test.ts
│   │   └── components/
│   │       └── sections.test.tsx
│   └── components/             # Integration tests co-located or in __tests__

backend/
├── app/
│   ├── tests/
│   │   ├── conftest.py          # Pytest fixtures (test DB, test client)
│   │   ├── test_sos.py
│   │   ├── test_domain.py
│   │   ├── test_rag.py
│   │   └── test_eventbus.py
│   └── routes/
│       └── tests/
│           ├── test_hospitals.py
│           └── test_myth_buster.py
```

### Suggested naming conventions

- TypeScript: `{module}.test.ts` or `{component}.test.tsx`
- Python: `test_{module}.py`
- Test data: `fixtures/` directory or `{module}.fixtures.ts`

## Mocking Strategy (Suggested)

### What to mock

| Module | Mock Target | Reason |
|--------|------------|--------|
| `src/lib/db.ts` | PrismaClient | Database calls in unit tests |
| `src/lib/api.ts` | fetch/HTTP | Network calls in component tests |
| `src/lib/eventbus.ts` | EventEmitter | Event bus side effects |
| `backend/app/database.py` | sqlite3 connection | Isolate from real DB |
| `backend/app/llm.py` | LLM providers | Avoid API calls in tests |
| `backend/app/eventbus.py` | Outbox worker | Background thread interference |

### Suggested mocking approach

**TypeScript (Vitest):**
```typescript
// vi.mock for module-level mocking
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    incident: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    outboxEvent: {
      create: vi.fn(),
    },
  },
}));
```

**Python (pytest):**
```python
# Monkeypatch or unittest.mock
from unittest.mock import patch, MagicMock

@patch("app.database.get_conn")
def test_trigger_sos(mock_get_conn):
    mock_conn = MagicMock()
    mock_get_conn.return_value.__enter__.return_value = mock_conn
    # test logic
```

### What NOT to mock

- Pure domain functions (`haversineKm`, `rankHospitals`, `stockFreshness`) — test them with real data
- `cn()` utility — trivial, test it only for regression
- Data structures and types — not runtime behavior

## Coverage Goals (Suggested)

| Area | Target | Priority |
|------|--------|----------|
| Domain logic (`nagraksha.ts`, `domain.py`) | 90%+ | High — mostly pure functions, easy to test |
| API helpers (`api.ts`) | 80%+ | Medium — small utility |
| Event bus (`eventbus.ts`, `eventbus.py`) | 70%+ | Medium — stateful, needs fixtures |
| RAG pipeline (`rag.py`) | 60%+ | Medium — TF-IDF is deterministic |
| React components (`components/`) | 50%+ | Low — visual, many shadcn/ui wrappers |
| Backend routes (`routes/`) | 70%+ | Medium — integration tests preferred |
| shadcn/ui components | Skip | Generated code, thin wrappers |
| Knowledge base data | Skip | Static data, no logic to test |

**Target overall: 65%+** before adding more code.

## Test Commands (Suggested for Addition)

To `frontend/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

To root `package.json`:
```json
{
  "scripts": {
    "test": "cd frontend && vitest run && cd ../backend && pytest",
    "test:frontend": "cd frontend && vitest run",
    "test:backend": "cd backend && pytest",
    "test:watch": "cd frontend && vitest"
  }
}
```

To `backend/requirements.txt`:
```
pytest>=8.0
pytest-cov>=5.0
```

## Test Types Needed

### Unit tests (priority: highest)

**Pure function tests** (no mocking needed):
- `haversineKm()` — known coordinates, expected distances
- `rankHospitals()` — controlled input, verify ranking order
- `stockFreshness()` — test all status/time combinations
- `etaMin()`, `roadKm()` — edge cases (0 distance, large distance)
- `simulateDispatch()` — deterministic output verification

### Integration tests (priority: high)

**API route tests:**
- `POST /api/sos` — creates incident + outbox event in one transaction
- `POST /api/myth-buster` — RAG pipeline with mock LLM
- `POST /api/snake-id` — text-based identification
- `GET /api/risk` — nearest risk report selection
- `GET /api/health` — basic connectivity

### Component tests (priority: medium)

**React component smoke tests:**
- `Hero` renders without crashing
- `Prevention` renders children correctly
- `Reveal` shows content on scroll
- `LiveSosDemo` triggers SOS flow

### E2E tests (priority: low)

**Full flow tests** (for later):
- SOS trigger → dispatch → state transitions
- Hospital ranking display
- Knowledge base search flow
- PWA offline shell behavior

## Risk Areas (No Test Coverage)

These are the highest-risk untested areas:

1. **Outbox worker** (`src/lib/eventbus.ts` lines 201-256, `backend/app/eventbus.py` lines 130-163): Background poller with retry logic, concurrent DB writes, event emission — complex state machine with zero tests
2. **Dispatch fan-out** (`src/lib/eventbus.ts` lines 103-193): Multi-lane parallel dispatch with timing-dependent state transitions — hard to validate manually
3. **RAG pipeline** (`backend/app/rag.py`): TF-IDF indexing + LLM fallback chain with 4 possible response sources — retrieval quality unmeasured
4. **LLM fallback chain** (`backend/app/llm.py`): 3 providers tried in order, each can fail at any point — no test coverage of fallback behavior

---

*Testing analysis: 2026-07-25*
