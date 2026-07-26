# Pitfalls Research

**Domain:** CI/CD and quality infrastructure for brownfield hackathon project (NagRaksha)
**Researched:** 2026-07-26
**Confidence:** HIGH — verified against codebase analysis, research from 6+ real-world post-mortems, and official documentation for all tools involved

## Critical Pitfalls

### Pitfall 1: Going Too Strict Too Fast — Enabling All ESLint + TypeScript Rules at Once

**What goes wrong:**
The pipeline is configured to block PRs if lint or typecheck fails. A developer or the team enables all recommended ESLint rules and TypeScript strict mode simultaneously. The next push triggers 200+ ESLint violations (from 19+ currently disabled rules) plus 30+ TypeScript errors (from `noImplicitAny`, `strictNullChecks`, `ignoreBuildErrors` removal). The build is red for days. Developers start using `--no-verify` to bypass pre-commit hooks. The team votes to "revert the CI changes" and the quality initiative stalls.

**Why it happens:**
The current codebase has `eslint.config.mjs` with 19+ rules explicitly set to `"off"`, `tsconfig.json` with `noImplicitAny: false`, and `next.config.ts` with `ignoreBuildErrors: true`. Enabling the recommended configs was intended to be "one PR" but the sheer volume of errors blocks the entire pipeline. The team underestimates the cumulative effect of 3+ years of suppressed quality checks being re-enabled simultaneously.

**How to avoid:**
Enable rules in 4 distinct waves, each producing a green build before the next wave starts:

- **Wave 1 (Phase 1a):** Re-enable only the safest ESLint rules — `no-unused-vars`, `no-console`, `prefer-const`, `no-case-declarations`. These produce the fewest violations and are least likely to break logic. Fix all violations in one pass.
- **Wave 2 (Phase 1b):** Re-enable `@typescript-eslint/no-explicit-any`, `react-hooks/exhaustive-deps`, `@next/next/*` rules. These require more careful fixes but are high-value.
- **Wave 3 (Phase 2a):** Set `noImplicitAny: true` in tsconfig but keep `ignoreBuildErrors: true` temporarily. Fix all implicit any errors by adding type annotations. This alone will surface 30+ errors.
- **Wave 4 (Phase 2b):** Set `ignoreBuildErrors: false` and enable `strictNullChecks`. This is the highest-value but most disruptive flag. Fix errors in dependency order: utility functions → data models → API routes → UI components.

Use `// @ts-expect-error` sparingly as a temporary escape hatch, but track each one with a ticket to fix within 2 sprints. Never use `// @ts-ignore`.

**Warning signs:**
- After enabling rules, the first `npm run lint` produces 50+ violations across 15+ files — this is too many to fix in one sitting
- Any developer responds to a red CI with "I'll just bypass the check for now"
- The `.eslintcache` or `tsconfig.tsbuildinfo` keeps growing with no corresponding fix in violation counts

**Phase to address:**
Phase 1 (ESLint Wave 1 + Wave 2), Phase 2 (TypeScript Wave 3 + Wave 4). These MUST be separate phases, not merged.

---

### Pitfall 2: Flaky Tests from Shared SQLite Database State Between Test Runs

**What goes wrong:**
Backend pytest tests connect to the same `backend/db/nagraksha.db` file (or a shared test DB). Test A creates an incident with a hardcoded ID. Test B queries for "no incidents" and fails because Test A's row leaked. On CI with parallel test execution, multiple workers connect to the same SQLite file, causing `database is locked` errors. The failure is order-dependent — tests pass in isolation but fail in CI. Developers learn to "just re-run" and the pipeline loses credibility.

**Why it happens:**
SQLite uses file-level locking. The same `.db` file cannot be read by multiple processes concurrently without lock contention. Each test that writes data and doesn't clean up leaves state for the next test. The codebase's `get_conn()` context manager opens a new connection per query, which exacerbates the problem. The project tracks `nagraksha.db` in git, meaning even the test database is committed.

**How to avoid:**
Use **per-test in-memory SQLite databases** instead of a shared file. There are three layered strategies:

1. **Per-test in-memory DB (highest isolation, preferred):** Configure pytest to use an in-memory SQLite database via a connection string override. Each test gets `:memory:` which is destroyed when the connection closes. This gives total isolation and zero cleanup cost.

2. **Per-test temp file:** If in-memory doesn't work due to connection pooling, generate a unique temp file per test using `tempfile.mktemp(suffix='.db')` and clean up in a `teardown`/`after` hook. This is what PrefectHQ and CleverAgents do for their SQLite CI.

3. **Transaction rollback (fallback):** Wrap each test in a database transaction that never commits. Use pytest fixtures with `scope="function"` that open a transaction and rollback after the test. This works for single-connection tests but fails if the app opens multiple connections.

For this codebase specifically, since `backend/app/database.py` uses raw sqlite3, create a fixture `test_db` in `conftest.py` that:
- Opens `:memory:` SQLite
- Runs the `SCHEMA` string to create tables
- Provides `get_conn()` override via monkeypatch
- Tears down on test completion

**Warning signs:**
- Any test that passes with `pytest tests/test_file.py` but fails with `pytest tests/` (full suite)
- `database is locked` errors in CI that don't reproduce locally
- Tests asserting hardcoded IDs like `assert incident.id == 1` instead of capturing the returned ID
- More than 5% of CI runs being "retried to green"

**Phase to address:**
Phase 3 — immediately when pytest infrastructure is introduced. Design the test DB fixture from day one, not retrofitted.

---

### Pitfall 3: CI Pipeline Takes 30+ Minutes Because Frontend and Backend Run Sequentially

**What goes wrong:**
The GitHub Actions workflow runs everything in one job: `pip install` → `pytest` → `npm ci` → `vitest` → `npm run build`. Total wall time is 25-35 minutes. Developers push code, switch to another task, and lose context. The pipeline becomes the bottleneck — PRs stack up waiting for green checks. The team starts merging without waiting for CI to finish.

**Why it happens:**
The default instinct is a single linear workflow ("checkout → install deps → test → build"). This codebase has two completely independent language stacks (Python and TypeScript) that can run in parallel with zero shared state beyond the SQLite database file.

**How to avoid:**
Structure the CI workflow into **parallel job groups** with dependency gates:

```yaml
# GitHub Actions: Three parallel lanes
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -r requirements.txt
      - run: pytest tests/

  frontend-lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
        working-directory: frontend
      - run: npx eslint . --max-warnings 0
        working-directory: frontend
      - run: npx tsc --noEmit
        working-directory: frontend

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
        working-directory: frontend
      - run: npx vitest run
        working-directory: frontend

  # Build step only needed for production verification
  build:
    needs: [frontend-lint-typecheck, frontend-tests, backend-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
        working-directory: frontend
```

This collapses the critical path from the sum of all steps to the longest single job (likely `backend-tests` at ~3-5 min). Total wall time: ~5 minutes instead of 25+.

**Key optimization:** Use `dorny/paths-filter` to skip frontend jobs when only backend files change and vice versa. For a PR that only touches `backend/app/domain.py`, the frontend jobs are skipped entirely and the pipeline completes in ~3 minutes.

**Warning signs:**
- A single `jobs:` block with 15+ sequential `run:` steps
- The "total duration" column in GitHub Actions showing 20+ minutes
- Developers saying "I'll check CI later, it takes forever"

**Phase to address:**
Phase 5 (CI Pipeline) — design the workflow file with parallelism from the start.

---

### Pitfall 4: Tests That Depend on External LLM APIs (Grok, Gemini) Cause Non-Deterministic CI Failures

**What goes wrong:**
The RAG pipeline tests (`backend/app/rag.py`, `backend/app/llm.py`) make real API calls to Grok (xAI) and Gemini (Google) during test execution. On Monday the tests pass; on Tuesday Gemini returns a 429 rate limit error and the build fails. During peak hours, API latency causes timeout errors. The team has no API key in CI, so the tests are either skipped (false confidence) or fail immediately (blocked pipeline). The `.env.example` references `GROK_API_KEY` and `GEMINI_API_KEY` which may or may not be configured in GitHub Secrets.

**Why it happens:**
The codebase has a real LLM pipeline with fallback chain (GGUF local → Grok → Gemini). Tests for `retrieve()` or `generate_response()` were written without mocking the LLM layer. The developers assumed "testing with real APIs is more realistic." In practice, external API calls in CI are flaky by definition — network issues, rate limits, API changes, and cost constraints make them unreliable.

**How to avoid:**
Implement a **three-tier mocking strategy** for LLM-dependent tests:

1. **Unit tests for RAG retrieval (pytest, fast):** Mock `llm.py` at the module level. Test the TF-IDF retrieval logic, the response source selection, and the fallback chain logic — without ever calling an LLM. Use `unittest.mock.patch('backend.app.llm.generate_response')` to return a canned response.

2. **Integration tests for RAG pipeline (pytest, medium):** Use a fake LLM provider that returns deterministic responses. Replace the real provider chain with a `FakeLLM` class that returns `"This is a test response"` for any input. This validates the full RAG pipeline (retrieve → format → respond) without external dependencies.

3. **Smoke tests for real API (manual / nightly, slow):** A separate CI workflow that runs nightly with actual API keys from GitHub Secrets. This catches API changes and quota issues but doesn't block PRs.

**Concrete implementation for this codebase:**
```python
# backend/app/tests/conftest.py
@pytest.fixture(autouse=True)
def disable_real_llm():
    """Replace real LLM providers with fake for all tests."""
    from app import llm
    original_generate = llm.generate_response

    async def fake_generate(prompt, **kwargs):
        return "Mock response from fake LLM"

    llm.generate_response = fake_generate
    yield
    llm.generate_response = original_generate
```

For `backend/app/rag.py` specifically, test `retrieve()` with a pre-seeded in-memory knowledge base and assert on the TF-IDF ranking results, not on the LLM-generated response.

**Warning signs:**
- Test files importing `llm.generate_response` and calling it without mock
- CI logs showing `POST https://api.x.ai/v1/chat/completions` or `POST https://generativelanguage.googleapis.com`
- Tests that pass with a VPN but fail in CI
- Pipeline logs showing `429 Too Many Requests` or `timeout`

**Phase to address:**
Phase 3 (Test Framework Setup) — mock LLM dependencies from day one. Add nightly smoke tests in Phase 5 (CI Pipeline).

---

### Pitfall 5: Coverage Requirements Set Too High Before Baseline Is Established

**What goes wrong:**
The team sets a project-wide 80% code coverage threshold in CI (`--cov-fail-under=80`) on the first day of testing. The entire codebase has zero tests. Even after adding tests for domain logic (haversine, ranking), the overall coverage is below 20% because there are 19+ Python files, 200+ React components, and dozens of route handlers with no tests. Every commit fails coverage. The team disables the coverage gate entirely, and it's never re-enabled.

**Why it happens:**
Coverage percentages are seductive — they feel objective and measurable. But on a zero-test codebase, the first batch of tests (even well-written ones) will cover <20% of the total code. Setting a monolithic threshold guarantees failure. The team becomes demoralized and the coverage tool is abandoned.

**How to avoid:**
Use **incremental coverage targets** scoped to specific modules, not a blanket project-wide percentage:

1. **Phase 3 (initial):** Set `--cov-fail-under=90` for domain logic ONLY (`backend/app/domain.py`, `frontend/src/lib/nagraksha.ts`). These are pure functions — easy to test, high value. Explicitly exclude everything else with `--cov=backend/app/domain.py`.

2. **Phase 4 (expansion):** Add coverage targets for API routes (`--cov-fail-under=70` for `backend/app/routes/`) and event bus (`--cov-fail-under=60` for `backend/app/eventbus.py`).

3. **Phase 6 (stable):** Set a global `--cov-fail-under=65` target after 3+ sprints of test accumulation.

**Never block PRs on coverage in the first sprint of testing.** Coverage requirements should inform, not gate, until the baseline is stable.

**Specific approach for this codebase:**
```yaml
# CI: Run coverage with module-scoped thresholds
- name: Test domain logic
  run: pytest tests/domain/ --cov=app.domain --cov-fail-under=90

- name: Test API routes
  run: pytest tests/routes/ --cov=app.routes --cov-fail-under=70

- name: Full suite (informational)
  run: pytest --cov=app --cov-report=term-missing
```

**Warning signs:**
- A single `--cov-fail-under=80` in the CI config for `backend/` or `frontend/`
- The coverage report shows 15% for the whole project but 95% for the domain module
- Developers say "coverage check is broken anyway, ignore it"

**Phase to address:**
Phase 3 (initial domain tests) — scoped thresholds. Phase 6 — project-wide threshold after baseline stabilizes.

---

### Pitfall 6: TypeScript Strict Mode Errors Overwhelming the Team

**What goes wrong:**
`noImplicitAny: true` is flipped. `tsc --noEmit` now reports 30+ errors across 15 files. Developers unfamiliar with TypeScript's type system spend hours on a single type annotation. Feature work slows to a crawl. The team reverts the change and the TypeScript config stays permanently lax.

**Why it happens:**
The combination of `ignoreBuildErrors: true` and `noImplicitAny: false` means the codebase has accumulated 30+ type errors that were silently suppressed. These errors cluster around function parameters, API response shapes, and generic type usage. Fixing them requires understanding the runtime contract of each function — which is harder than just adding `: any` annotations.

**How to avoid:**
Use the **files-first, flags-second** strategy:

1. Create `tsconfig.strict.json` extending the base config with `strict: true` but only including a whitelist of files:
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": { "strict": true },
     "include": [
       "src/lib/nagraksha.ts",
       "src/lib/api.ts",
       "src/__tests__/**/*"
     ]
   }
   ```
2. Run `tsc -p tsconfig.strict.json --noEmit` in CI as a separate check. This ensures new files and the most critical modules are strict-checked.
3. Enable `noImplicitAny` at the whole-project level next. This typically produces fewer errors than `strictNullChecks` and is easier to fix (just add `: string`, `: number`, etc.).
4. Enable `strictNullChecks` *last*. This is the highest-value but most disruptive flag. Fix errors in dependency order: utilities → models → API routes → components.
5. Use `typescript-strict-plugin` or the `// @ts-strict` comment approach to enable strict checking file-by-file while the rest of the project remains loose.

**Key insight from real migrations (200k-line codebase experience):** `strictNullChecks` alone found 3 production bugs that existed for months. It's worth the effort — but it must be done incrementally.

**Warning signs:**
- A PR title like "Enable strict mode" with 30+ changed files
- Developers adding `as any` casts as a workaround (check for this in code review)
- Type errors that are fixed with `// @ts-ignore` instead of proper typing
- The build is red for more than 2 days due to type errors

**Phase to address:**
Phase 2 — split into Phase 2a (`noImplicitAny` fix) and Phase 2b (`strictNullChecks` fix). These must be separate sub-phases.

---

### Pitfall 7: Caching Misconfiguration Causing Stale Dependencies in CI

**What goes wrong:**
CI caches `node_modules` using a key that doesn't include the lockfile hash. A developer updates a dependency in `package.json` but the lockfile isn't committed. CI restores the stale cache, installs nothing, and the old version runs. Tests pass locally (new dep) but fail in CI (old dep). Conversely, the cache key is too specific (includes timestamp), so every run is a cache miss and `npm ci` reinstalls from scratch — adding 60-90 seconds to every job.

**Why it happens:**
GitHub Actions caching is straightforward but unforgiving. Too broad a cache key → stale dependencies. Too narrow a key → no caching benefit. The codebase has both `package.json` and `package-lock.json` in `frontend/`, plus `requirements.txt` in `backend/`.

**How to avoid:**
Use lockfile-based cache keys for both Node and Python:

```yaml
# Node modules — cache key is lockfile hash
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: frontend/node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('frontend/package-lock.json') }}

# Python packages — cache key is requirements hash
- name: Cache pip
  uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('backend/requirements.txt') }}
```

**Additional optimization for Python:** Use `setup-python`'s built-in `cache: pip` which manages this automatically with `setup-python@v5`.

**Git clone optimization:** Set `fetch-depth: 1` in `actions/checkout@v4` to avoid pulling full git history (saves 10-20 seconds per job).

**Warning signs:**
- CI logs showing `npm ci` running for 60+ seconds (cache miss)
- CI logs showing `npm ci` running for 0 seconds but a new dependency isn't available (false cache hit)
- The `actions/cache` step showing "Cache not found" on every run
- Developers saying "it works locally but CI fails" when dependency changes are involved

**Phase to address:**
Phase 5 (CI Pipeline) — design caching from the first workflow commit.

---

### Pitfall 8: Ignoring Existing Tech Debt (Dual Event Bus, Duplicate Domain Logic) While Adding Tests

**What goes wrong:**
The team writes exhaustive tests for `backend/app/eventbus.py` including the outbox worker, subscriber management, and retry logic. Two weeks later, they realize the frontend event bus (`frontend/src/lib/eventbus.ts`) duplicates the same logic with slightly different behavior. Tests for the Python event bus pass, but the frontend event bus has different race condition handling. The two systems produce different results in production. All the test investment in the backend event bus is undermined by the unaddressed architectural issue.

**Why it happens:**
The CONCERNS.md document identifies 5+ architectural issues: dual event bus, duplicate domain logic between `nagraksha.ts` and `domain.py`, seed data duplication, Prisma + Python dual schema, and frontend direct DB access. Testing the individual components in isolation doesn't validate that the system as a whole is correct. Writing tests for duplicated code can actually make the duplication *harder* to remove (because now there are "tested" implementations on both sides).

**How to avoid:**
**Triage tech debt before testing.** Address the architectural issues that make the system untestable first:

1. **Delete the frontend event bus** (`frontend/src/lib/eventbus.ts` — the outbox worker code, not the API helper). This is the highest-impact fix. Remove the dual-writer pattern. The Python backend becomes the sole event processor.
2. **Delete duplicate domain logic from frontend** (`frontend/src/lib/nagraksha.ts`). The frontend should call `frontend/src/lib/api.ts` to get ranking/dispatch results from the Python API.
3. **Consolidate seed data** to Python backend only. Remove `frontend/scripts/seed.ts` and `frontend/src/lib/knowledge-base.ts`.
4. **Then** write tests for the remaining code, which is now a single self-consistent system.

If these deletions are too risky for a single phase, at minimum **document the known inconsistencies in test assertions**. Tests for `backend/app/domain.py` should note "this logic is duplicated in frontend — any change must be ported."

**Apply the "you can't test your way out of bad architecture" rule:** If the code has a fundamental inconsistency (two event buses producing different results), no amount of testing will make it correct. Fix the architecture, then test.

**Warning signs:**
- Test plans that include `frontend/src/lib/eventbus.ts` and `backend/app/eventbus.py` separately, without addressing the dual-writer issue
- Test assertions that only verify "the event bus works" without checking which event bus is the canonical one
- Test suite passes but production bugs persist (the tests validated the wrong system)
- More than 20% of test time spent on code that CONCERNS.md flags for deletion

**Phase to address:**
Phase 0 (pre-testing cleanup) — address the dual event bus and duplicate logic BEFORE writing any tests. This is a prerequisite, not a parallel activity.

---

### Pitfall 9: Testing the Wrong Things — Writing Tests for shadcn/ui Wrappers Instead of Domain Logic

**What goes wrong:**
The frontend test suite has 20+ tests for `Button`, `Dialog`, `Select`, and `Card` components — all shadcn/ui wrappers that were generated by the CLI and not customized. Meanwhile, the haversine distance calculation that ranks hospitals and the dispatch simulation logic have zero tests. The CI pipeline passes with 90% "coverage" but the most critical failure paths (wrong hospital ranking, incorrect ETA calculation) are untested. A bug in the ETA formula ships to production because the test suite only verified that buttons render.

**Why it happens:**
shadcn/ui components are visually prominent and easy to test (render → assert text exists). Domain logic (pure functions) requires thinking about edge cases. Developers gravitate toward component tests because they produce visible results (a rendered component in a test runner) and feel productive. The testing pyramid is inverted — slow, brittle component tests at the base, no unit tests at the top.

**How to avoid:**
Explicitly **ban testing shadcn/ui wrapper components** in the first two testing phases. Follow the "test what you own" principle:

- **Don't test:** `components/ui/*` (shadcn/ui generated code), `cn()` utility, Tailwind class outputs, Radix behavior (open/close/select — Radix tests itself)
- **Do test first:** `src/lib/nagraksha.ts` (haversine, ranking, dispatch), `backend/app/domain.py` (same logic in Python), `src/lib/api.ts` (API client behavior), `backend/app/rag.py` (retrieval logic)

From the TESTING.md analysis, the priority test targets are clear:
```typescript
// HIGH VALUE — test these
haversineKm(28.6, 77.2, 12.9, 80.1) // Delhi to Chennai: ~1759km
rankHospitals(incidents, hospitals) // Verify ranking by antivenom stock
etaMin(1759, 80) // Expected ~19.8 min at 80 km/h

// LOW VALUE — skip these
<Button variant="outline">Click me</Button> // shadcn/ui default, no custom logic
<Select>...<SelectItem value="1">Option</SelectItem></Select> // Radix behavior
```

**Use per-module coverage targets to enforce this** (see Pitfall 5). Set `--cov=app.domain --cov-fail-under=90` for domain logic and exclude `--cov-ignore=app/ui` for UI wrappers.

**Warning signs:**
- First PR of tests has more `import { render } from '@testing-library/react'` than `import { haversineKm } from '@/lib/nagraksha'`
- Component tests exceed domain logic tests by 3:1 ratio
- Test files in `components/ui/` directory
- Coverage report shows 95% line coverage but 0% for `nagraksha.ts`

**Phase to address:**
Phase 3 — enforce domain-first testing in the testing strategy document and in code review.

---

### Pitfall 10: Service Worker / PWA Tests Failing on Headless CI or Needing Special Browser Setup

**What goes wrong:**
PWA tests are added to verify service worker registration, offline caching, and push notifications. In the local dev environment (`localhost`), the service worker registers and caches the app shell. In CI (headless Chromium), service worker registration fails silently because HTTPS is required (localhost is exempt locally, but CI URLs may use HTTP), or the Playwright context needs explicit `serviceWorkers: 'allow'` configuration. The test suite becomes unreliable — passing locally but failing on every CI run.

**Why it happens:**
Service workers have strict security requirements (HTTPS or localhost only). Playwright's default configuration blocks service workers for predictability. The codebase has `frontend/public/sw.js` with Workbox-based caching, but no test infrastructure validates it. PWA testing requires: (a) a secure context, (b) explicit Playwright service worker permissions, (c) offline simulation via `context.setOffline(true)`, (d) cleanup between tests (unregister + clear caches), and (e) handling the activation lifecycle timing.

**How to avoid:**
Treat PWA tests as a **separate, deferred concern** with explicit infrastructure:

1. **Do not add PWA tests in the first testing phase.** They require Playwright (browser automation), which is deferred per the PROJECT.md ("Integration/E2E tests with browser automation — deferred to future milestone").

2. **When adding PWA tests later:**
   - Use a separate Playwright project config specifically for PWA tests
   - Configure `use: { serviceWorkers: 'allow' }` in the Playwright context
   - Serve the app over HTTPS or ensure `localhost` is used (which is exempt from the SW HTTPS requirement)
   - Wait for `navigator.serviceWorker.ready` before asserting SW state
   - Clean up between tests: unregister service workers and clear Cache Storage in `afterEach`
   - Test offline mode via `context.setOffline(true)` after priming the cache online

3. **Pre-caching test:** Verify that `index.html`, key JS bundles, and the web manifest are in the precache manifest. This is the highest-value PWA test and can be done as a Playwright script that queries `caches.keys()` and `caches.match()`.

4. **Anti-pattern:** Using `page.route()` to intercept requests while also testing SW caching. These conflict — Playwright route interception happens before the SW fetch handler. Blocking SWs with `serviceWorkers: 'block'` is cleaner for non-PWA tests.

**Warning signs:**
- Test files importing `serviceWorker` APIs without context-level `serviceWorkers: 'allow'` config
- Tests using `waitForTimeout` to wait for service worker activation (should use `navigator.serviceWorker.ready`)
- PWA tests mixed into the same test file as unit tests (they need different browser contexts)
- `navigator.serviceWorker` is `undefined` in CI test output
- Cache storage from test A leaking into test B (no cleanup in `afterEach`)

**Phase to address:**
Deferred entirely per PROJECT.md. If PWA tests are added early (Phase 5 or later), they MUST be in a separate Playwright project with explicit SW configuration.

---

### Pitfall 11: Not Handling the Dual-Connection SQLite Problem in Tests

**What goes wrong:**
The pytest fixture sets up an in-memory SQLite database for testing. Backend API route tests use `httpx.AsyncClient` with the FastAPI app to test endpoints like `POST /api/sos`. The route handler calls `get_conn()` from `database.py` which opens a NEW connection to the in-memory database. This second connection doesn't see the data inserted by the fixture's connection. Tests for "create incident" endpoints always return 404 when the fixture tries to verify the created incident exists.

**Why it happens:**
SQLite in-memory databases (`:memory:`) are per-connection. Each call to `sqlite3.connect(":memory:")` creates a completely independent database. The fixture opens a connection, creates tables, inserts seed data. The route handler opens another connection to `:memory:` — and sees an empty database. This is the #1 SQLite testing trap documented by BuildPulse and Exact's research.

**How to avoid:**
Use a **shared in-memory database via a named URI** or a **temp file** instead of the default `:memory:`:

1. **File-based temp DB (recommended for this codebase):** Generate a unique temp file path, set an environment variable, and modify `get_conn()` to read from `TEST_DATABASE_PATH` when set. All connections in the fixture AND the application code use the same file path → same database.

2. **`file::memory:?cache=shared` URI:** SQLite supports a shared in-memory database via the URI `file::memory:?cache=shared`. Multiple connections to this URI see the same data. Set this in the test environment variable.

3. **Monkeypatch `get_conn()` in conftest.py:** Replace `database.get_conn` with a fixture that returns a connection to the test database, wrapping all application code in the same transactional scope.

For the `get_conn()` context manager pattern:
```python
# backend/app/tests/conftest.py
import pytest
import tempfile
import os
from app import database

@pytest.fixture(scope="session")
def test_db_path():
    """Create a temp file for the test database."""
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    
    # Create schema
    conn = sqlite3.connect(db_path)
    conn.executescript(database.SCHEMA)
    conn.close()
    
    yield db_path
    
    os.unlink(db_path)

@pytest.fixture(autouse=True)
def use_test_db(monkeypatch, test_db_path):
    """Override get_conn to use the test database."""
    original_get_conn = database.get_conn
    
    def test_get_conn():
        conn = sqlite3.connect(test_db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(f"PRAGMA busy_timeout=5000")
        return conn
    
    monkeypatch.setattr(database, "get_conn", test_get_conn)
    yield
    monkeypatch.setattr(database, "get_conn", original_get_conn)

@pytest.fixture(autouse=True)
def cleanup_db(test_db_path):
    """Delete all rows between tests — not the cleanest but works."""
    yield
    conn = sqlite3.connect(test_db_path)
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    for table in tables:
        conn.execute(f"DELETE FROM {table['name']}")
    conn.commit()
    conn.close()
```

**Warning signs:**
- Tests pass in isolation but fail when the route handler makes a DB query
- HTTP 404 responses when the fixture just inserted data
- `sqlite3.OperationalError: no such table` errors in route handler tests
- Any test using `httpx.AsyncClient` with a real route handler (not mocked DB)

**Phase to address:**
Phase 3 — this must be part of the initial pytest fixture setup, not a later fix. Refactoring the fixture pattern is much harder after tests are written.

---

### Pitfall 12: Adding Pre-commit Hooks That Take Too Long and Get Bypassed

**What goes wrong:**
The team adds `husky` + `lint-staged` with `eslint --max-warnings 0` and `tsc --noEmit` in the pre-commit hook. Running `tsc --noEmit` takes 30+ seconds on every commit. Developers start using `git commit --no-verify` or `git -c core.hooksPath=/dev/null commit` to bypass the hooks entirely. Within 2 weeks, nobody runs the pre-commit checks, quality drops back to baseline, and the team has a negative perception of "quality tooling."

**Why it happens:**
TypeScript type checking requires loading the entire project. On even a moderately sized codebase (this one has 50+ TS/TSX files), `tsc --noEmit` takes 20-45 seconds. Running this on every `git commit` creates friction that developers optimize away by bypassing hooks. The `--max-warnings 0` flag also means any minor formatting warning blocks the commit — even a trailing whitespace error.

**How to avoid:**
Use a **tiered pre-commit approach** that respects developer time:

1. **Pre-commit (fast, <5 seconds):** Run only `lint-staged` with ESLint on staged files (not the whole project). This checks only changed lines. Use `eslint --no-ignore --max-warnings 0` to catch new issues.

2. **Pre-push (medium, <30 seconds):** Run `tsc --noEmit` and the full test suite for the affected module. This is slower but happens less frequently.

3. **CI (slow but comprehensive):** Run everything — ESLint on all files, TypeScript strict check, all tests, build verification.

```jsonc
// .lintstagedrc.json — only ESLint on staged files
{
  "*.{ts,tsx}": ["eslint --fix --max-warnings 0"],
  "*.{json,md}": ["prettier --write"]
}
```

```bash
# .husky/pre-commit — fast
npx lint-staged

# .husky/pre-push — medium
cd frontend && npx tsc --noEmit
cd frontend && npx vitest run --changed
```

**If tsc is still too slow for pre-push,** move it entirely to CI and only run lint-staged locally. Speed trumps completeness for local hooks.

**Warning signs:**
- `husky` pre-commit hook taking more than 10 seconds
- Developers sharing `--no-verify` workarounds in Slack/DM
- `git log --oneline` showing commits with lint errors
- ESLint violations increasing over time even though the hook exists
- The `.husky/pre-commit` file includes `tsc --noEmit`

**Phase to address:**
Phase 5 (CI Pipeline) — add pre-commit hooks LAST, after the CI pipeline is stable and fast.

---

### Pitfall 13: LLM API Key Leakage via CI Logs or Test Artifacts

**What goes wrong:**
A developer adds a test that logs the `GROK_API_KEY` for debugging ("why is the API call failing?"). The test output is captured by pytest's verbose mode and printed to CI logs. GitHub Actions logs are publicly accessible for public repositories. Even for private repos, anyone with repo access can see the logs. The API key is compromised.

**Why it happens:**
The codebase uses `GROK_API_KEY` and `GEMINI_API_KEY` from `.env`. The `.env.example` documents these keys. CI secrets are configured in GitHub Secrets. But test logs, error messages, and debug output can inadvertently leak values. The `dev.log` file (generated by `next dev 2>&1 | tee ../dev.log`) is gitignored but not, but CI pipelines that capture ALL output can accidentally log secrets passed as environment variables.

**How to avoid:**
1. **Never use real API keys in CI.** Use fake keys for unit/integration tests (see Pitfall 4). Only real keys go in the nightly smoke test workflow.
2. **Always mock LLM calls in test code** (per Pitfall 4). If a test never calls the real API, the key is never used.
3. **Add a secret scanner to CI:** Use `trufflehog` or `ggshield` to scan for committed secrets. Run it as a fast parallel check.
4. **Use GitHub's secret scanning** which auto-detects many common API key formats.
5. **Never `print()` or `logger.debug()` the value of a secret.** Add a lint rule or code review check.
6. **Add `backend/db/nagraksha.db` to `.gitignore` and remove it from git history.** Per CONCERNS.md, this database may contain PII.

**For the `.env` pattern:** Ensure `.env*` in `.gitignore` doesn't accidentally commit `.env.production` or `.env.local`. The current pattern `.env*` is correct but verify it with a test commit.

**Warning signs:**
- CI logs showing `GROK_API_KEY=sk-...` or similar key-value pairs
- `print()` or `console.log()` in test files that mention API keys
- The `.env.example` committed with real key names but placeholder values (safe, but worth noting)
- Any `--verbose` flag in CI test commands that could output environment values
- `process.env.GROK_API_KEY` referenced directly in test assertions

**Phase to address:**
Phase 0 (pre-testing) — move real DB out of git, ensure `.gitignore` is correct, add secret scanning. Phase 3 (testing) — mock all LLM calls.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems when adding CI/testing.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Set `--cov-fail-under=0` to "unblock" CI | Pipeline goes green immediately | No coverage enforcement, quality erodes silently | First sprint only, with a ticket to set proper threshold within 2 weeks |
| Use `// @ts-ignore` instead of fixing types | Unblock developer, quick fix | Accumulates into dozens of ignored errors, type safety is lost | ONLY with a linked ticket and a `FIXME` comment explaining why |
| Use `# type: ignore` in Python | Same as above | Same as above | ONLY for third-party type stubs that are incorrect, never for your own code |
| Skip frontend tests entirely ("backend is the real system") | Faster pipeline | Duplicated domain logic goes untested, frontend regression risk | Never — the frontend has its own logic (event bus, API client) that must be tested |
| Put all tests in one giant file ("it's just a hackathon") | Faster to write, no structure | Tests become unmaintainable, slow to run, impossible to parallelize | Only for the first 10 tests. Split into module-organized files by the 15th test |
| Use a shared test database (single `.db` file) | Simple setup, no temp files | Flaky tests from state leakage, cannot parallelize, CI slowdown | Never — always use per-test in-memory or temp databases |
| Commit `nagraksha.db` with test data | Share DB state across dev machines | PII leak risk, merge conflicts on binary file, stale test data | Never — remove from git per CONCERNS.md |
| Skip mocking LLM ("we'll use free tier keys in CI") | Tests are "realistic" | Flaky CI from rate limits, API changes, network issues | Never — always mock external services |

---

## Integration Gotchas

Common mistakes when connecting CI tools to this specific codebase.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **ESLint + Next.js** | Using `.eslintrc.json` format (deprecated) with ESLint v9 | Use `eslint.config.mjs` flat config. The codebase already uses flat config — don't revert. |
| **pytest + SQLite** | Using `:memory:` for the test DB without handling per-connection isolation | Use a temp file path (not `:memory:`) or `file::memory:?cache=shared` URI so route handlers and fixtures see the same data |
| **Vitest + Prisma** | Running Vitest in browser mode which conflicts with Prisma's Node.js runtime | Use Vitest in Node mode (default) for Prisma-dependent tests. Mark tests as `@jest-environment node` equivalent |
| **GitHub Actions + SQLite** | Running parallel pytest workers against the same `.db` file | Use `pytest-xdist` with `--dist loadfile` (not `load`) to isolate test files, OR give each worker a unique temp DB path |
| **pytest + httpx.AsyncClient** | Not awaiting the async client setup in conftest.py | Use `@pytest_asyncio.fixture` with `async def client()` pattern. The FastAPI `TestClient` is synchronous but `httpx.AsyncClient` is not |
| **GitHub Actions + `actions/cache`** | Using `node_modules` cache without also caching `.next/cache` for build speed | Cache both `node_modules` AND `.next/cache` to speed up `next build` from ~60s to ~15s on cache hit |
| **bandit + Python** | Running bandit as a blocking CI gate without a baseline | Run bandit with `--skip` for known-accepted findings on the first run. Add new findings as failures only for NEW code. Use `--baseline` flag |
| **eslint-plugin-security** | Enabling all rules at once, causing 50+ findings on route handlers | Enable rules incrementally. Start with `detect-non-literal-fs-filename`, `detect-child-process`, `detect-possible-timing-attacks`. Skip `detect-pseudo-random-bytes` (too many false positives) |

---

## Performance Traps

Patterns that work at small scale but fail as CI grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Sequential job pipeline** | CI takes 25+ min for 19 backend + 50 frontend files | Parallelize backend, frontend, and lint jobs (see Pitfall 3) | At 1 PR + 1 full pipeline = 25 min — breaks immediately for this codebase size |
| **No dependency caching** | Every CI run spends 2+ min installing deps | Cache `node_modules` and `~/.cache/pip` with lockfile-hash keys | First run after cache config is added. 2 min × 100 PRs = 200 min/month waste |
| **pytest without `-x` or `--failed-first`** | Full 5-min test suite runs even when the first test fails | Use `pytest -x` (stop on first failure) or `--failed-first` (re-run failures first) locally. CI runs full suite but developers use fast-fail locally | As soon as the test suite exceeds 2 minutes |
| **Full project `tsc --noEmit` on every commit** | 45-second type check blocks `git commit` | Move to pre-push only, or use IDE type checking for instant feedback | At 50+ TS files. This codebase has ~50 files, already at the threshold |
| **Single coverage report for the whole project** | 15% global coverage looks bad even when domain logic is well-tested | Use per-module coverage targets (see Pitfall 5) | Immediately — the first coverage report will show ~15% for the project |
| **Running E2E/PWA tests on every push** | 8+ minute Playwright suite runs on every commit | Gate E2E to PRs only, not direct pushes. Run PWA tests only on SW file changes | As soon as Playwright is configured. Can double CI time on every commit |

---

## Security Mistakes

Domain-specific security issues when adding CI/testing infrastructure.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Storing test API keys in the same env as production keys** | Dev/test keys with access to real LLM APIs could leak via CI logs | Use separate, rate-limited test API keys. Better: mock all LLM calls (Pitfall 4) and never store real keys in CI |
| **Committing `.env` file with real secrets** | Secrets in git history, accessible to all repo collaborators | Add `.env` to `.gitignore` (already done). Verify with `git ls-files | grep '\.env$'`. Add `pre-commit` hook to scan for `.env` files |
| **Not removing `nagraksha.db` from git** | PII (incident locations, victim data) in git history (CONCERNS.md Security #4) | `git rm --cached backend/db/nagraksha.db` + add `*.db` to `.gitignore`. This should be Phase 0 |
| **Exposing server start command output in CI** | CI logs showing `Server running on http://0.0.0.0:8000` with debug info | Use `--log-level warning` for CI server startup. Don't pipe raw server output to CI logs |
| **Using `--cov-report=term-missing` without sanitizing output** | Coverage report could show file paths or code snippets that reveal architecture details | Only relevant for public repos. Use `--cov-report=xml` for CI, keep `term-missing` for local dev |
| **GitHub Actions secrets exposed in workflow logs** | `${{ secrets.GROK_API_KEY }}` leaked if a workflow step accidentally echoes it | Never `echo $MY_SECRET` in any step. GitHub Actions masks secrets in logs, but don't rely on this — just don't print them |

---

## UX Pitfalls

Common developer experience mistakes when adding CI/testing.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **CI takes >10 minutes** | Developers context-switch, lose focus on the change they just made | Target <5 min for lint + typecheck + unit tests. This is achievable with parallel jobs |
| **CI failure messages are opaque** | Developer doesn't know what to fix: "3 tests failed" with no file name | Use `--verbose` / `-v` flags in test runners. Ensure each test failure shows exactly which assertion failed and why |
| **Pre-commit hook blocks on formatting** | Developer frustrated that a trailing space prevents committing | Configure `lint-staged` to auto-fix (--fix) and only warn. Never block commits on formatting — that's CI's job |
| **Coverage badge on README shows 15%** | Team morale drops, coverage is seen as "the thing that makes us look bad" | Only show coverage badges for modules that have targets (domain logic at 90%, routes at 70%). Don't show project-wide coverage until it's >50% |
| **Type errors shown as wall of red text** | Developer overwhelmed, can't find where to start fixing | Sort type errors by file. Fix in dependency order (see Pitfall 6). Show error count daily, not all at once |
| **Test execution order is non-deterministic** | "Tests pass on my machine" becomes a daily complaint | Use `pytest-randomly` plugin and seed-based ordering. Specify the seed in CI logs so any failure can be reproduced locally |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **ESLint config re-enabled:** Re-enabling rules is not enough — verify that `eslint --max-warnings 0` actually produces zero violations on CI. Run it once and fix ALL violations before calling this done.
- [ ] **TypeScript strict mode:** Setting `noImplicitAny: true` is done only when `tsc --noEmit` produces zero errors. Run it with `--strict` flag to verify before declaring victory.
- [ ] **Test infrastructure added:** Installing Vitest and pytest is done only when a minimal test can run in CI. Create a "smoke test" that asserts `1 + 1 === 2` and runs in CI before writing real test logic.
- [ ] **pytest fixtures for database:** Creating `conftest.py` with `test_db_path` fixture is done when a route handler test successfully reads from the same database. See Pitfall 11 — test the fixture by writing a real route test.
- [ ] **CI workflow added:** The workflow YAML file is done when it has been tested with an actual push to a PR branch. Not when it's added to main. Test with a PR that intentionally introduces a lint error and verify CI catches it.
- [ ] **LLM mocking:** Mocking LLM providers is done when a test that exercises `rag.py`'s `retrieve()` function can run without network calls. Verify with `Wireshark` or `--disable-real-network` mode.
- [ ] **Coverage thresholds:** Setting `--cov-fail-under` is done when the current codebase actually meets that threshold. Check the coverage report, add the threshold, verify the build is green.
- [ ] **Pre-commit hooks:** Installed hooks are done when every team member has run `npx husky install` and the hooks trigger on `git commit`. Verify by making a trivial commit.
- [ ] **Dependency caching:** Cache config is done when a second CI run (without changing dependencies) shows `cache hit` for both Node and Python caches. Not when the cache step was added to the YAML.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **All ESLint rules enabled, build is red (Pitfall 1)** | LOW (1-2 hours) | 1. Revert the rule change. 2. Re-enable rules in 4 waves (see prevention). 3. Fix violations in batches per wave. |
| **Flaky tests from shared SQLite (Pitfall 2)** | MEDIUM (2-4 hours) | 1. Add `--randomly-seed=<seed>` to CI to reproduce. 2. Implement per-test temp DB fixture. 3. Quarantine flaky tests in a separate CI job until fix lands. |
| **CI takes 30+ min (Pitfall 3)** | LOW (1 hour) | 1. Split into 3 parallel jobs (backend, frontend-lint, frontend-tests). 2. Add path filtering. 3. Add dependency caching. |
| **LLM API tests failing in CI (Pitfall 4)** | MEDIUM (2-3 hours) | 1. Mock all LLM calls immediately. 2. Add a nightly real-API test. 3. Audit all test files for unmocked external calls. |
| **Coverage threshold too high (Pitfall 5)** | LOW (30 min) | 1. Lower / remove the global threshold. 2. Switch to per-module thresholds. 3. Set informational-only coverage for first sprint. |
| **TypeScript errors overwhelming (Pitfall 6)** | MEDIUM (3-4 hours) | 1. Revert strict flag. 2. Create `tsconfig.strict.json` with file whitelist. 3. Enable strict for new files only. 4. Fix errors in dependency order. |
| **Stale cache causing test failures (Pitfall 7)** | LOW (30 min) | 1. Clear GitHub Actions cache manually (Settings → Actions → Caches). 2. Fix cache key to include lockfile hash. 3. Push a trivial commit to rebuild cache. |
| **Tests passing but system still broken (Pitfall 8)** | HIGH (1-2 weeks) | 1. Stop writing tests. 2. Delete the frontend event bus. 3. Consolidate domain logic. 4. Delete duplicate seed data. 5. Resume testing on the consolidated architecture. |
| **Wrong things tested (Pitfall 9)** | MEDIUM (1-2 days) | 1. Move shadcn/ui component tests to a separate "visual regression" suite that doesn't block CI. 2. Replace them with domain logic tests. 3. Add coverage thresholds per module to enforce correct priorities. |
| **PWA tests failing in CI (Pitfall 10)** | MEDIUM (2-3 hours) | 1. Remove PWA tests from the default CI workflow. 2. Create a separate Playwright project for PWA tests with `serviceWorkers: 'allow'`. 3. Test offline behavior with `context.setOffline(true)` after priming cache. |
| **Dual-connection SQLite in tests (Pitfall 11)** | MEDIUM (3-4 hours) | 1. Replace `:memory:` with a temp file path. 2. Monkeypatch `get_conn()` in conftest.py. 3. Verify with a route handler integration test. |
| **Pre-commit hooks being bypassed (Pitfall 12)** | LOW (30 min) | 1. Remove slow checks from pre-commit. 2. Move to pre-push or CI only. 3. Use `lint-staged` for fast checks only. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **P1: Too strict too fast** (ESLint) | Phase 1a → Wave 1 (safe rules), Phase 1b → Wave 2 (strict rules) | `npm run lint` exits 0 after each wave |
| **P1: Too strict too fast** (TypeScript) | Phase 2a → `noImplicitAny`, Phase 2b → `strictNullChecks` | `tsc --noEmit` exits 0 after each sub-phase |
| **P2: Flaky SQLite tests** | Phase 3 — design test DB fixture with per-test temp DB | `pytest tests/ --randomly-order` passes consistently across 5 runs |
| **P3: Slow sequential CI** | Phase 5 — parallel job structure with path filtering | CI total wall time < 8 minutes after setup |
| **P4: External API test deps** | Phase 3 — mock LLM in conftest.py from day one | `pytest tests/ --no-network` passes without network access |
| **P5: Coverage too high** | Phase 3 → per-module thresholds, Phase 6 → project-wide | Domain logic coverage ≥ 90%, routes ≥ 70% (scoped) |
| **P6: TypeScript overwhelm** | Phase 2a → `tsconfig.strict.json` with whitelist first | `npx tsc -p tsconfig.strict.json --noEmit` passes for new files |
| **P7: Cache misconfiguration** | Phase 5 — set up cache keys from the first CI workflow | Second CI run shows cache hits for Node + Python |
| **P8: Ignoring tech debt** | Phase 0 — delete dual event bus and duplicate domain logic BEFORE testing | `git diff HEAD -- frontend/src/lib/eventbus.ts` shows file deleted |
| **P9: Testing wrong things** | Phase 3 — enforce domain-first testing in test strategy doc | Domain logic tests ≥ 80% of total test count in first PR |
| **P10: PWA tests in CI** | Deferred per PROJECT.md — add only in a separate Playwright project later | PWA tests run in their own CI workflow, not the main pipeline |
| **P11: Dual-connection SQLite** | Phase 3 — proper `conftest.py` fixture with temp file path | Route handler test reads data inserted by fixture |
| **P12: Slow pre-commit hooks** | Phase 5 (last) — only `lint-staged` in pre-commit, `tsc` in pre-push | `git commit` completes in < 5 seconds with hooks active |
| **P13: API key leakage** | Phase 0 (gitignore + secret scan), Phase 3 (mock LLM) | No real API keys used in any CI workflow step |

---

## Sources

- BuildPulse.io — "The flakiest test in your suite is fighting over a database row" (2026-07-13). Documented SQLite shared-state flakiness patterns: leaked transactions, truncate-table drift, hardcoded fixture ID collisions. **HIGH confidence** — verified against PrefectHQ PRs.
- PrefectHQ/pull/20553 — "Fix flaky test: increase SQLite busy_timeout for better concurrency" (2026). Real-world case of `database is locked` errors in CI from SQLite contention. Solution: increased `busy_timeout` + aligned connection-level timeout. **VERIFIED via GitHub**.
- CleverAgents Core commit f2b9ccf — "Isolate parallel behave subprocesses with per-scenario temp databases" (2026). Real fix for parallel SQLite test collision using `tempfile.mktemp()`. **VERIFIED via commit log**.
- wolf-tech.io — "TypeScript Strict Mode: How to Survive the Transition" (2026-04-22). Documented incremental adoption strategy with `tsconfig.strict.json` approach. **HIGH confidence**.
- jsmanifest.com — "TypeScript Strict Migration in 2026: Upgrading a Real Codebase to TS 6.0" (2026-06-16). Migration strategy with flag ordering (`strictNullChecks` → `noImplicitAny` → remaining flags). **HIGH confidence** — verified against official TypeScript docs.
- jsmanifest.com — "Migrating 200k Lines to TypeScript 6.0: What Actually Broke" (2026-07-02). Data on 8,247 errors from strict mode: 62% null/undefined, 23% implicit any, 15% function type incompatibilities. Documents that incremental strategy failed for cross-cutting changes. **HIGH confidence**.
- dev.to/alexrogovjs — "How We Migrated 200K Lines from JS to Strict TypeScript" (2026-03-21). Real migration experience: one module per PR, strictNullChecks found 3 production bugs, ban `any` with ESLint after strict mode. **MEDIUM confidence** (single source).
- deployflow.co — "Continuous Integration for Legacy Systems: 4-Phase Roadmap" (2026-06-25). Framework for sequential CI adoption on brownfield: shadow mode → gate non-critical → expand coverage. **MEDIUM confidence**.
- minimalcd.org — "Migrating Brownfield to CD" practice guide. Flaky test quarantine, DORA metric tracking, incremental adoption alongside feature work. **MEDIUM confidence** (community standard).
- kriedysystems.com — "Five CI/CD Pipeline Mistakes That Quietly Kill Deployment Confidence" (2026-03-03). Flaky tests, no fast/slow separation, secrets committed, no rollback plan. **MEDIUM confidence**.
- theengineeringladder.com — "The CI/CD Pipeline Mistakes That Are Quietly Slowing Your Team Down" (2026-04-26). 6 mistakes: flaky tests, sequential execution (parallel fix with `needs`), caching, env parity, rollback, pipeline observability. **MEDIUM confidence**.
- totalshiftleft.com — "Continuous Testing Pipeline: CI/CD Integration Guide" (2026-06-15). Quality gates must be binary, flaky tests are existential threat, testing pyramid stages. **MEDIUM confidence**.
- shadcnspace.com — "The Ultimate shadcn/ui Handbook" (2026-03-23). Guidance on testing shadcn components: focus on behavior, not implementation details; avoid testing Tailwind classes or Radix behavior. **HIGH confidence**.
- blog.codedthemes.com — "Common Mistakes to Avoid When Using shadcn/ui" (2026-04-27). Section 9: "Skipping Testing" — notes that dialogs, forms, and dropdowns break most often after customization. **MEDIUM confidence**.
- qaskills.sh — "Playwright Service Worker Network Mocking Gotchas" (2026-07-13). Diagnostic guidance for SW/routing conflicts, `serviceWorkers: 'block'` vs `'allow'`, per-context isolation. **HIGH confidence** — verified against Playwright docs.
- assrt.ai — "Test a Service Worker Offline with Playwright in 10 Minutes" (2026-04-17). Step-by-step: wait for SW ready, use `context.setOffline(true)`, clean up in afterEach. Documents 4 failure modes. **MEDIUM confidence**.
- dev.to/uaslimcreate — "GitHub Actions for Parallel FastAPI + React Testing" (2026-05-23). Real implementation: matrix strategy, service containers, caching, from 8 min to 90 sec. **HIGH confidence** — verified against GitHub Actions docs.
- dev.to/jimmyyeung — "Systematically Cut Our Monorepo CI Time in Half" (2026-03-26). 22+ microservice monorepo: toolchain swaps (Bun, Rspack), dependency caching, test parallelization with pytest-xdist. **HIGH confidence**.
- chyshkala.com — "Path Filtering and Matrix Builds Cut Monorepo CI Time in Half" (2026-03-26). Path filtering with `dorny/paths-filter`, matrix builds for independent services. **MEDIUM confidence**.
- curling.io — "Test Isolation for Free with SQLite" (2026-03-03). In-memory per-test databases, SQLite backup API for cloning schema, 12 lines of Erlang FFI. **MEDIUM confidence**.
- carolin-brandt.de — "Addressing Test Flakiness: Practical Approaches in a Database-Reliant Industrial System" (Exact case study, 2026). Raised pipeline pass rate from 27% to 95% by disposing test data, database sanity checks. **HIGH confidence** — peer-reviewed publication.
- Codebase analysis: CONCERNS.md, TESTING.md, PROJECT.md (2026-07-25/26). First-hand audit of the actual codebase state. **HIGHEST confidence**.

---

*Pitfalls research for: NagRaksha CI/CD and quality infrastructure milestone*
*Researched: 2026-07-26*
