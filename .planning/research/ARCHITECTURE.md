# Architecture: CI/CD & Quality Infrastructure

**Project:** NagRaksha — CI/CD Pipeline, Test Infrastructure & Quality Gates
**Researched:** 2026-07-26
**Focus:** How CI/CD, testing, linting, and static analysis are structured for a dual-language (TypeScript + Python) brownfield monorepo
**Overall confidence:** HIGH

---

## Table of Contents

1. [CI/CD Pipeline Architecture](#1-cicd-pipeline-architecture)
2. [Test Infrastructure Architecture](#2-test-infrastructure-architecture)
3. [Code Quality Architecture](#3-code-quality-architecture)
4. [Static Analysis Architecture](#4-static-analysis-architecture)
5. [CI Gate Design & Branch Protection](#5-ci-gate-design--branch-protection)
6. [Caching Strategy](#6-caching-strategy)
7. [Build Order & Dependencies](#7-build-order--dependencies)
8. [New vs Modified Components](#8-new-vs-modified-components)
9. [Cost Analysis](#9-cost-analysis)
10. [Sources & Confidence](#10-sources--confidence)

---

## 1. CI/CD Pipeline Architecture

### 1.1 Decision: Single Workflow with Parallel Jobs

**Recommendation: SINGLE workflow (`ci.yml`) with parallel `frontend` and `backend` jobs.**

Rationale against alternatives:

| Approach | Why Not |
|----------|---------|
| **Separate workflows** (`frontend-ci.yml` + `backend-ci.yml`) | Duplicates boilerplate (concurrency, checkout, setup). Two workflow runs to check for the same PR. Harder to add a unified gatekeeper. |
| **Matrix strategy** | This is a TWO-service system, not a multi-package monorepo. Matrix is designed for "same job, different configs" (e.g., test across Node 18/20/22). Frontend and backend have *different* runtimes, different dependency managers, different test runners. Matrix would force a generic setup step that installs both Node and Python for every cell — wasteful. |
| **Dynamic discovery** (`dorny/paths-filter`) | Powerful for large monorepos (50+ packages), but over-engineering for 2 services. A simple path change check `frontend/**` and `backend/**` with `if:` conditions is sufficient. |

**Structure:**

```
ci.yml
  ├── frontend (TypeScript)
  │   ├── Checkout
  │   ├── Setup Node (cache: 'npm')
  │   ├── npm ci
  │   ├── Lint (eslint)
  │   ├── Type check (tsc --noEmit)
  │   ├── Unit test (vitest run --coverage)
  │   └── Build (next build)
  │
  ├── backend (Python)
  │   ├── Checkout
  │   ├── Setup Python (cache: 'pip')
  │   ├── pip install -r requirements.txt
  │   ├── Lint (bandit)
  │   └── Unit test (pytest --cov)
  │
  └── gatekeeper (required status check)
      └── Aggregates frontend + backend results
```

### 1.2 Path-Based Triggers

Use `paths` / `paths-ignore` to avoid running both jobs when only one side changes:

| Change | Jobs Run |
|--------|----------|
| `frontend/src/**` change | Frontend only |
| `backend/app/**` change | Backend only |
| `eslint.config.mjs` change | Frontend only |
| `backend/requirements.txt` change | Backend only |
| `README.md` or `docs/**` change | Neither (skipped entirely) |
| `.github/workflows/ci.yml` change | Both |

**Implementation via `paths-filter`** (not `paths:` on the workflow trigger, which would skip the entire workflow):

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
      ci: ${{ steps.filter.outputs.ci }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            frontend:
              - 'frontend/**'
              - 'eslint.config.mjs'
              - 'package.json'
            backend:
              - 'backend/**'
            ci:
              - '.github/workflows/ci.yml'

  frontend:
    needs: changes
    if: ${{ needs.changes.outputs.frontend == 'true' || needs.changes.outputs.ci == 'true' }}
    ...
```

**This avoids the "skipped status check blocks merge" problem** — the `gatekeeper` job handles that (see section 5).

### 1.3 concurrency & Cancel-in-Progress

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

- Groups runs by branch/PR ref
- New push to the same PR cancels the in-progress run
- Prevents wasted minutes on stale commits

### 1.4 Workflow YAML (Complete Skeleton)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "22"
  PYTHON_VERSION: "3.12"

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.filter.outputs.frontend }}
      backend: ${{ steps.filter.outputs.backend }}
      ci: ${{ steps.filter.outputs.ci }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            frontend:
              - 'frontend/**'
              - 'eslint.config.mjs'
              - '.prettierrc*'
              - 'package.json'
            backend:
              - 'backend/**'
            ci:
              - '.github/workflows/**'

  frontend:
    needs: changes
    if: ${{ needs.changes.outputs.frontend == 'true' || needs.changes.outputs.ci == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Check formatting
        run: npx prettier --check "src/**/*.{ts,tsx}"

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npx vitest run --coverage

      - name: Build
        run: npm run build

  backend:
    needs: changes
    if: ${{ needs.changes.outputs.backend == 'true' || needs.changes.outputs.ci == 'true' }}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Security lint
        run: python -m bandit -r app/ -x tests/

      - name: Test
        run: python -m pytest --cov=app --cov-report=term --cov-report=xml

      - name: Upload backend coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-backend
          path: backend/coverage.xml

  gatekeeper:
    needs: [frontend, backend]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check all checks passed
        run: |
          if [ "${{ needs.frontend.result }}" = "failure" ] || [ "${{ needs.backend.result }}" = "failure" ]; then
            exit 1
          fi
          if [ "${{ needs.frontend.result }}" = "cancelled" ] || [ "${{ needs.backend.result }}" = "cancelled" ]; then
            exit 1
          fi
          # If both were skipped (no code changes), that's OK
          if [ "${{ needs.frontend.result }}" = "skipped" ] && [ "${{ needs.backend.result }}" = "skipped" ]; then
            echo "No code changes detected — all checks skipped"
          fi
```
---

## 2. Test Infrastructure Architecture

### 2.1 Vitest Configuration (Frontend)

**File:** `frontend/vitest.config.ts` (NEW)

**Key decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Environment | `jsdom` | Stable, sufficient for component tests. happy-dom is faster but has edge cases with canvas/WebGL used in this project. |
| Globals | `true` | `describe`/`it`/`expect` without imports. Matches Jest API familiarity. |
| Coverage provider | `@vitest/coverage-v8` | V8 native coverage. Faster than Istanbul. Vitest 4.x default. |
| Test file pattern | `src/**/*.test.{ts,tsx}` and `src/**/*.spec.{ts,tsx}` | Covers both conventions. Co-located with source. |

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/components/ui/**',         # shadcn/ui — tested upstream
        'src/test/**',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// frontend/src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock browser APIs not available in jsdom
vi.stubGlobal('IntersectionObserver', vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})));

vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));
```

### 2.2 Test File Organization: Co-located (Not `__tests__`)

**Recommendation: CO-LOCATED**

```typescript
// Before (hypothetical)
src/
  lib/
    haversine.ts
    __tests__/
      haversine.test.ts      # 👎 Two directory levels away

// After (recommended)
src/
  lib/
    haversine.ts
    haversine.test.ts         # 👍 Right next to the code it tests
    nagraksha.ts
    nagraksha.test.ts
  components/
    sections.tsx
    sections.test.tsx
    interactive.tsx
    interactive.test.tsx
```

**Rationale:**

| Aspect | Co-located | `__tests__` dir |
|--------|------------|-----------------|
| Discoverability | High — see test alongside source | Lower — need to navigate to `__tests__/` |
| Import paths | `../` not needed | `../` required |
| Refactoring | Move/delete source = move/delete test together | Tests orphaned more easily |
| Bundle exclusion | Vitest config excludes by pattern | Same |
| Project convention | Used by `@testing-library` examples, shadcn/ui, tRPC | Used by Jest defaults, legacy |

**Exception:** Test setup files (`setup.ts`, mocks in `src/test/` or `src/__mocks__/`) live in a shared directory since they're not specific to one module.

### 2.3 Pytest Configuration (Backend)

**File:** `backend/pyproject.toml` (NEW) — also add `backend/tests/` directory.

```toml
# backend/pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]

[tool.coverage.run]
source = ["app"]
omit = ["tests/*"]

[tool.coverage.report]
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
]
```

### 2.4 Test Isolation Strategy for SQLite

**This is the most critical architectural decision for backend testing.**

**Problem:** The backend uses a file-based SQLite database at `backend/db/nagraksha.db` (path overridable via `NAGRAKSHA_DB` env var). Tests must NEVER touch the development database.

**Solution: Temporary SQLite database with fresh schema per test session.**

Architecture:

```
┌──────────────────────────────────────────────────────┐
│                    conftest.py                        │
│                                                      │
│  @pytest.fixture(scope="session")                    │
│  def _session_db():                                  │
│      tmp_db = tmp_path / "test.db"                   │
│      os.environ["NAGRAKSHA_DB"] = str(tmp_db)        │
│      from app.database import init_db                │
│      init_db()                    # Create tables    │
│      yield tmp_db                                     │
│      tmp_db.unlink(missing_ok=True)  # Cleanup       │
│                                                      │
│  @pytest.fixture(autouse=True)                       │
│  def _clean_tables(_session_db):                     │
│      yield                                           │
│      conn = sqlite3.connect(_session_db)             │
│      for table in TABLES:                            │
│          conn.execute(f"DELETE FROM {table}")        │
│      conn.commit()                                   │
│      conn.close()                                    │
└──────────────────────────────────────────────────────┘
```

**Key design elements:**

| Element | Detail |
|---------|--------|
| **Database location** | `tmp_path / "nagraksha_test.db"` — unique per test session, in OS temp dir |
| **Schema creation** | `init_db()` called once at session start — creates all tables via `SCHEMA` constant |
| **Test isolation** | Each test gets clean DB state via `DELETE FROM` on all tables after each test (`autouse` fixture) |
| **Environment override** | `os.environ["NAGRAKSHA_DB"]` overrides the path before any import that reads it |
| **Transaction rollback** | Tests that crash roll back via `get_conn()` context manager's `except Exception: conn.rollback()` |
| **Parallel safety** | `tmp_path` is unique per worker — even with `pytest-xdist -n auto`, no collision |
| **No cleanup risk** | `tmp_path` is cleaned by pytest automatically after the session |

```python
# backend/tests/conftest.py
"""
Pytest fixtures for NagRaksha backend testing.

Isolates tests from the production SQLite database by:
1. Creating a temporary database file for each test session
2. Re-initializing the schema from scratch
3. Cleaning all tables between each test (autouse)
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from app.main import app

# List of tables in dependency order (child tables first for FK compliance)
TABLES = [
    "SymptomObservation",
    "SnakeObservation",
    "AntivenomStock",
    "DispatchAttempt",
    "MythThread",
    "OutboxEvent",
    "AuditEvent",
    "KnowledgeChunk",
    "RiskReport",
    "Hospital",
    "Incident",
]


@pytest.fixture(scope="session")
def db_path(tmp_path_factory: pytest.TempPathFactory) -> Generator[Path, None, None]:
    """Create a temporary SQLite database for the test session."""
    tmp_dir = tmp_path_factory.mktemp("nagraksha_test")
    db_file = tmp_dir / "nagraksha_test.db"

    # Override the database path before any imports that read it
    os.environ["NAGRAKSHA_DB"] = str(db_file)

    # Import database module AFTER setting the env var
    from app.database import init_db

    init_db()  # Creates all tables from SCHEMA

    yield db_file

    # Cleanup after session
    db_file.unlink(missing_ok=True)


@pytest.fixture(autouse=True)
def _clean_tables(db_path: Path) -> Generator[None, None, None]:
    """Clean all tables after each test to ensure isolation."""
    yield
    conn = sqlite3.connect(str(db_path))
    try:
        for table in TABLES:
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def client() -> TestClient:
    """Provide a FastAPI TestClient for integration tests."""
    return TestClient(app)
```

**Edge case: Outbox worker thread.** The backend's `start_worker()` runs a background polling thread. During tests, this thread must NOT run because:
1. It would poll the test database for PENDING events
2. It has `time.sleep(2.5)` — slowing tests
3. It mutates shared state (event subscriptions)

**Solution:** Override in conftest or use a flag:

```python
# In main.py or eventbus.py — add a test mode flag
import os
DISABLE_OUTBOX_WORKER = os.environ.get("NAGRAKSHA_TEST", "").lower() in ("1", "true")

# In startup hook:
if not DISABLE_OUTBOX_WORKER:
    start_worker()
```

Or, more cleanly, mock the worker in test fixtures:

```python
@pytest.fixture(autouse=True)
def _disable_outbox_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prevent the outbox worker thread from starting during tests."""
    monkeypatch.setattr("app.eventbus.start_worker", lambda: None)
```

### 2.5 What to Test First

**Priority order** (build confidence incrementally):

| Priority | Area | Frontend/Backend | Rationale |
|----------|------|------------------|-----------|
| 1 | Domain logic: `haversine`, `rank_hospitals`, `simulate_dispatch` | Both (duplicated logic) | Pure functions, no mocks needed, highest business value |
| 2 | API handlers: SOS creation, hospital listing, risk endpoint | Backend | Validates route logic + DB interaction |
| 3 | Domain helpers: `apiUrl`, `cn`, `stockFreshness` | Frontend | Utility functions, easy to test |
| 4 | React components: MythBuster, SOS form (unit tests) | Frontend | Component rendering + user interaction |
| 5 | RAG pipeline: `retrieve`, `rag_answer` | Backend | Mock TF-IDF index, test ranking + fallback chain |

---

## 3. Code Quality Architecture

### 3.1 ESLint Flat Config — Progressive Rule Enablement

**File:** `eslint.config.mjs` (MODIFIED — same file, rule changes only)

**Architecture principle:** Rules are enabled in waves, NOT all at once. Each wave must pass CI before the next wave is merged.

**Wave structure:**

```
eslint.config.mjs
├── Existing nextCoreWebVitals (unchanged)
├── Existing nextTypescript (unchanged)
├── eslint-plugin-security (NEW — added as separate config object)
│
├── Base rules (always enabled):
│   ├── "prefer-const": "error"
│   ├── "no-console": "warn"
│   ├── "no-unused-vars": "off"  # Delegate to @typescript-eslint
│   └── "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
│
├── Wave 2 (after Wave 1 is green):
│   ├── "react-hooks/exhaustive-deps": "warn"
│   ├── "@typescript-eslint/ban-ts-comment": "warn"
│   └── "@next/next/no-img-element": "warn"
│
├── Wave 3 (after Wave 2 is green):
│   ├── "@typescript-eslint/no-explicit-any": "warn"
│   ├── "react/no-unescaped-entities": "warn"
│   └── "no-empty": "warn"
│
└── Wave 4 (after Wave 3 is green, after TypeScript strict mode):
    ├── All remaining rules → "error" or project-appropriate level
    ├── "react-hooks/exhaustive-deps": "error"
    └── "@typescript-eslint/no-explicit-any": "error"
```

**Plugin integration: `eslint-plugin-security`**

```
npm install eslint-plugin-security --save-dev
# or
bun add -D eslint-plugin-security
```

```javascript
import pluginSecurity from 'eslint-plugin-security';

// In the config array:
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  pluginSecurity.configs.recommended,  // Flat config compatible in v4+
  { /* your rules */ },
];
```

### 3.2 Prettier Integration

**One-time formatting commit** (before any rule changes to reduce noise):

```
bun add -D prettier
# Config file: frontend/.prettierrc
# CI check: prettier --check "src/**/*.{ts,tsx}"
```

**Order of operations:**
1. Add `.prettierrc` to `frontend/`
2. Run `npx prettier --write "frontend/src/**/*.{ts,tsx}"` — this reformats everything
3. Commit ONLY formatting changes (single commit with message "chore: format all files with prettier")
4. All subsequent PRs enforce `prettier --check` in CI

**Why Prettier first:** Without it, ESLint Wave 1+ will generate noise from style issues vs actual bugs. Prettier removes all formatting variability.

### 3.3 TypeScript Strict Mode Progression

| Phase | Change | File | Expected Issues |
|-------|--------|------|-----------------|
| 1 (immediate) | Remove `noImplicitAny: false` → `strict: true` handles it | `tsconfig.json` | HIGH — many implicit `any` in existing code |
| 2 (after tests) | Remove `ignoreBuildErrors: true` | `next.config.ts` | MEDIUM — should pass after phase 1 |
| 3 (optional) | Set `reactStrictMode: true` | `next.config.ts` | LOW — fix `useEffect` cleanup |

**Strategy for Phase 1:** Fix errors in waves:
1. Add explicit `: any` annotations where types are genuinely unknown (quick fix, lets strict mode pass)
2. Replace `: any` with proper types in subsequent PRs (tracked via `@typescript-eslint/no-explicit-any: "warn"`)
3. When `any` usage is below threshold, enable `@typescript-eslint/no-explicit-any: "error"`

---

## 4. Static Analysis Architecture

### 4.1 bandit (Python Security)

**Single config file:** `backend/.bandit` (optional — CLI args sufficient for this codebase)

```bash
# CI command (already configured in workflow)
python -m bandit -r app/ -x tests/

# What it catches (relevant to codebase):
# - B101: assert statements (used in tests, excluded via -x tests/)
# - B102: exec() usage
# - B113: (unsafe) requests without timeout
# - B307: eval() usage
# - B703: Django-specific (N/A — FastAPI)
# - Import injection: dynamic imports
```

**Severity for codebase size:** ~19 Python files, all first-party code. bandit's 47 checks are sufficient. No need for Semgrep or SonarQube.

### 4.2 eslint-plugin-security

**Flat config compatible in v4.** Adds these checks:

| Rule | What It Catches | Relevance |
|------|-----------------|-----------|
| `detect-non-literal-fs-filename` | Dynamic file paths | Low (no fs access in frontend) |
| `detect-possible-timing-attacks` | Timing-based comparison | Low (no password comparison) |
| `detect-eval-with-expression` | `eval()` usage | Medium |
| `detect-pseudoRandomBytes` | `Math.random()` for crypto | Medium |
| `detect-buffer-noassert` | Unsafe Buffer operations | Low (Bun runtime) |
| `detect-object-injection` | Dynamic property access | **HIGH** — most relevant for this codebase |

**Expected issues:** Object injection warnings from `[]` property access patterns in `nagraksha.ts`, `interactive.tsx`. Start as "warn", not "error".

---

## 5. CI Gate Design & Branch Protection

### 5.1 Required vs Optional Checks

| Check | Required | Rationale |
|-------|----------|-----------|
| **Formatting** (`prettier --check`) | ✅ Required | Eliminates style discussions in PRs. Zero interpretation. |
| **Lint** (`eslint .`) | ✅ Required | Catches bugs, bad patterns. Tautological — if it passes `warn`-level, unblocking. |
| **TypeScript type check** (`tsc --noEmit`) | ✅ Required | Catches type errors before build. |
| **Frontend tests** (`vitest run`) | ✅ Required | Must pass for code quality. |
| **Backend tests** (`pytest`) | ✅ Required | Must pass for code quality. |
| **Backend security lint** (`bandit`) | ✅ Required | Low false-positive rate on this codebase. |
| **Frontend build** (`next build`) | ⚠️ Optional (for now) | `ignoreBuildErrors: true` is still set. Make required AFTER TypeScript strict mode passes. |
| **Coverage thresholds** | ❌ Optional | Deferred per PROJECT.md — will set after test suite stabilizes. |
| **Frontend coverage upload** | ❌ Optional | Nice to have but not blocking. |
| **Backend coverage upload** | ❌ Optional | Same. |

### 5.2 Branch Protection Rules (GitHub Settings)

Configure in Settings → Branches → Add rule for `main`:

| Setting | Value |
|---------|-------|
| **Require pull request reviews before merging** | ✅ (1 reviewer) |
| **Dismiss stale pull request approvals when new commits are pushed** | ✅ |
| **Require status checks to pass before merging** | ✅ |
| **Require branches to be up to date** | ✅ |
| **Status checks** | `gatekeeper` (NOT individual frontend/backend jobs) |
| **Require conversation resolution first** | ✅ |
| **Include administrators** | ✅ (keeps pipeline honest) |
| **Allow force pushes** | ❌ |
| **Allow deletions** | ❌ |

**Why `gatekeeper` as single status check:** If individual `frontend` and `backend` jobs are set as required, and they get skipped by path filters, the PR is **unmergeable** — GitHub sees a required check that never reported success. The `gatekeeper` pattern solves this: it always runs, aggregates results, and is the only check listed as required.

### 5.3 Gatekeeper Job Design

```yaml
gatekeeper:
    needs: [frontend, backend]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Verify all checks passed
        run: |
          # Collect results from both jobs
          FE_RESULT="${{ needs.frontend.result }}"
          BE_RESULT="${{ needs.backend.result }}"

          # If either job failed, fail the gate
          if [ "$FE_RESULT" = "failure" ] || [ "$BE_RESULT" = "failure" ]; then
            echo "❌ One or more checks failed"
            exit 1
          fi

          # If either was cancelled, fail (new push cancelled old run)
          if [ "$FE_RESULT" = "cancelled" ] || [ "$BE_RESULT" = "cancelled" ]; then
            echo "❌ Run was cancelled"
            exit 1
          fi

          # If both skipped (no relevant changes), that's fine
          if [ "$FE_RESULT" = "skipped" ] && [ "$BE_RESULT" = "skipped" ]; then
            echo "✅ No relevant changes detected — all checks skipped"
            exit 0
          fi

          # If one ran and passed, the other was skipped — that's fine
          echo "✅ All required checks passed"
```

---

## 6. Caching Strategy

### 6.1 Layer 1: Node.js Dependencies (Frontend)

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: "22"
    cache: "npm"
    cache-dependency-path: frontend/package-lock.json
```

- **Cache key:** Auto-derived from `package-lock.json` hash
- **Scope:** `<os>-.npm-<lock-hash>` — specific to lockfile content
- **Hit rate:** ~95% (lockfile changes are rare after initial setup)
- **Saved time:** ~60s → ~5s per frontend job

**Important note about Bun:** The project uses `bun.lock` for local development. GitHub Actions does NOT support Bun caching natively via `actions/setup-node`. For CI, the project should generate a `package-lock.json` (via `npm install --package-lock-only`) or use `actions/cache` explicitly for Bun's cache directory.

**Recommended approach:** Generate `package-lock.json` from `bun.lock` in CI:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v6
    with:
      node-version: "22"
      cache: "npm"
      cache-dependency-path: frontend/package-lock.json

  - name: Generate lockfile (if missing)
    run: |
      if [ ! -f package-lock.json ]; then
        npm install --package-lock-only
      fi

  - name: Install dependencies
    run: npm ci
```

**Alternative (simpler): Use `actions/cache` for Bun:**

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v2
  with:
    bun-version: latest

- name: Cache Bun dependencies
  uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lock') }}
    restore-keys: |
      bun-${{ runner.os }}-

- name: Install dependencies
  run: bun install --frozen-lockfile
```

**Recommendation:** Use **Bun in CI** for consistency with local development. The `oven-sh/setup-bun` action is actively maintained and handles cross-platform installs.

### 6.2 Layer 2: Python Dependencies (Backend)

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: "pip"
    cache-dependency-path: backend/requirements.txt
```

- **Cache key:** Auto-derived from `requirements.txt` hash
- **Scope:** Pip global cache directory
- **Hit rate:** ~95%
- **Saved time:** ~40s → ~5s per backend job
- **Note:** The `requirements.txt` uses `==` pins for major deps and `>=` for minor ones. `cache-dependency-path` correctly hashes the file content — any version change invalidates the cache.

### 6.3 Layer 3: ESLint Cache (Optional)

```yaml
- name: Restore ESLint cache
  uses: actions/cache@v4
  with:
    path: frontend/.eslintcache
    key: eslint-${{ runner.os }}-${{ hashFiles('eslint.config.mjs', 'frontend/package-lock.json') }}
    restore-keys: |
      eslint-${{ runner.os }}-

# Then: eslint . --cache
```

Benefits: On repeated PR runs, only changed files are re-linted. Saves ~10-15s per run.

### 6.4 Cache Invalidation Summary

| Cache | Key Source | Invalidated When |
|-------|-----------|------------------|
| npm / Bun | `package-lock.json` / `bun.lock` | Dependency version changes |
| pip | `requirements.txt` | Dependency version changes |
| ESLint | `eslint.config.mjs` + lockfile | Rule config changes |
| TypeScript | `tsconfig.json` + lockfile | Compiler options change |

---

## 7. Build Order & Dependencies

### 7.1 Recommended Build Sequence

```
Phase 1: Foundation (no dependencies)
├── Prettier formatting (one-time commit)
│   └── Creates: frontend/.prettierrc
│   └── Modifies: all frontend/src files (formatting)
│
└── Git hooks setup
    └── Creates: .husky/pre-commit (lint-staged for prettier + eslint)

Phase 2: Quick Wins (no dependencies)
├── ESLint Wave 1
│   └── Modifies: eslint.config.mjs
│   └── Enable: no-console, prefer-const, no-unused-vars
│
└── Static analysis install
    ├── Creates: eslint-plugin-security in eslint.config.mjs
    └── Creates: bandit check (CI workflow, no config needed)

Phase 3: Test Infrastructure (depends on Phase 1)
├── Vitest setup
│   ├── Creates: frontend/vitest.config.ts
│   ├── Creates: frontend/src/test/setup.ts
│   └── Creates: first tests (domain logic)
│
├── pytest setup
│   ├── Creates: backend/pyproject.toml
│   ├── Creates: backend/tests/conftest.py
│   └── Creates: backend/tests/test_domain.py
│
└── CI workflow
    └── Creates: .github/workflows/ci.yml

Phase 4: TypeScript Strict (depends on Phase 2)
├── noImplicitAny: true
│   └── Modifies: frontend/tsconfig.json
│   └── Action: fix ~50-100 implicit any errors
│
├── ignoreBuildErrors: false
│   └── Modifies: frontend/next.config.ts
│
└── ESLint Wave 2-4 (as strictness increases)

Phase 5: Hardening (depends on Phase 3)
├── ESLint Wave 2 (after TS strict)
├── ESLint Wave 3-4
├── Coverage thresholds (optional)
└── README badges
```

### 7.2 Dependency Graph

```
Phase 1 (Prettier)
    │
    ├──► Phase 2a (ESLint Wave 1)
    │       │
    │       └──► Phase 4 (TypeScript strict) ──► Phase 5 (ESLint Waves 2-4)
    │
    └──► Phase 3a (Vitest setup)
    │       │
    │       └──► Phase 3c (CI workflow)
    │
    └──► Phase 3b (pytest setup)
            │
            └──► Phase 3c (CI workflow)
```

### 7.3 Risk Assessment Per Phase

| Phase | Risk | Mitigation |
|-------|------|------------|
| 1. Prettier | LOW — pure formatting, no logic change | Single "format everything" commit, then CI enforces |
| 2a. ESLint Wave 1 | LOW — warn-level, non-blocking rules | `no-console: warn`, not `error` |
| 2b. Static analysis | LOW — no code changes needed | New plugin only, existing code not modified |
| 3a. Vitest | LOW — no production code changed | New config + test files only |
| 3b. pytest | MEDIUM — test isolation must work correctly | `tmp_path` + env var override + cleanup fixtures verified first |
| 3c. CI workflow | MEDIUM — incorrect caching or path filters waste time | Test with `act` locally or push to branch first |
| 4. TypeScript strict | **HIGH** — many errors expected | Fix incrementally, use `any` annotations as escape hatch early, replace types later |
| 5. ESLint Waves 2-4 | MEDIUM — requires code changes | Fix per-wave, merge green, repeat |

---

## 8. New vs Modified Components

### 8.1 New Components (Created)

| Component | Path | Purpose |
|-----------|------|---------|
| CI workflow | `.github/workflows/ci.yml` | Main CI pipeline |
| Vitest config | `frontend/vitest.config.ts` | Test runner configuration |
| Test setup | `frontend/src/test/setup.ts` | Global mocks, cleanup |
| Test utilities | `frontend/src/test/utils.tsx` | Shared test helpers (wrappers, custom render) |
| Pytest config | `backend/pyproject.toml` | pytest + coverage configuration |
| Test conftest | `backend/tests/conftest.py` | Fixtures, DB isolation, TestClient |
| Domain tests | `backend/tests/test_domain.py` | Geo helpers, ranking, dispatch sim |
| API tests | `backend/tests/test_routes.py` | Route handler integration tests |
| Frontend tests | `frontend/src/lib/nagraksha.test.ts` | Domain logic tests |
| Frontend tests | `frontend/src/lib/api.test.ts` | API helper tests |
| Prettier config | `frontend/.prettierrc` | Formatter settings |
| Bandit config | `backend/.bandit` (optional) | Security linter exclusions |

### 8.2 Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `eslint.config.mjs` | Re-enable rules in waves, add `eslint-plugin-security` | MEDIUM — must not break lint pass |
| `frontend/tsconfig.json` | Remove `noImplicitAny: false` override | **HIGH** — will produce errors |
| `frontend/next.config.ts` | Remove `ignoreBuildErrors: true`, set `reactStrictMode: true` | MEDIUM — build may fail initially |
| `backend/app/database.py` | No change needed — `NAGRAKSHA_DB` env var already supported | NONE — tests override via env |
| `backend/app/main.py` | May need `DISABLE_OUTBOX_WORKER` flag for test mode | LOW — conditional startup branch |
| `frontend/package.json` | Add `test`, `test:watch`, `typecheck`, `format`, `format:check` scripts | NONE — new scripts only |
| `package.json` (root) | Forward test/lint scripts | NONE — delegating |
| `.gitignore` | Add `coverage/`, `htmlcov/`, `.eslintcache`, `.pytest_cache/` | NONE — ignores only |

### 8.3 Data Flow Changes

**Test → Database interaction (NEW):**

```
pytest runs
    │
    ▼
conftest.py: tmp_path / "nagraksha_test.db"
    │
    ├── os.environ["NAGRAKSHA_DB"] = str(tmp_db)
    ├── from app.database import init_db()
    ├── init_db()  → creates tables in temp db
    │
    ▼
Each test function
    │
    ├── Uses client (TestClient) → routes call get_conn()
    │       │
    │       └── get_conn() reads NAGRAKSHA_DB → connects to temp db
    │
    ├── Test runs assertions against temp db
    │
    └── autouse fixture: DELETE FROM all tables (cleanup)
```

**CI → Caching interaction (NEW):**

```
GH Actions runner
    │
    ├── Check cache (setup-node / setup-python)
    │   ├── HIT → restore node_modules (or pip cache)
    │   └── MISS → full install, save to cache
    │
    ├── Run lint / test / build
    │
    └── Upload coverage artifacts (for PR comment / badge)
```

---

## 9. Cost Analysis

### 9.1 GitHub Actions Free Tier

| Metric | Limit | Projected Usage | Headroom |
|--------|-------|-----------------|----------|
| **Public repo minutes** | Unlimited (free) | N/A | — |
| **Private repo minutes** | 2,000 min/month | ~300 min/month | 85% |
| **Storage (artifacts)** | 500 MB | ~10 MB/run (coverage) | 98% |
| **Concurrent jobs** | 20 (macos), 180 (ubuntu) | 2 (frontend + backend) | 99% |

### 9.2 Per-Run Cost Breakdown

| Job | Duration (P50) | Duration (P95) | Key Variable |
|-----|----------------|----------------|--------------|
| Frontend (full) | 3 min | 5 min | `next build` time |
| Frontend (cached) | 2 min | 3 min | Dependency install 💨 |
| Frontend (no build) | 1.5 min | 2 min | If build not required |
| Backend (full) | 1.5 min | 2.5 min | pytest + cleanup |
| Backend (cached) | 45 sec | 1.5 min | Pip install 💨 |

**Monthly projection:**
- 100 PRs × 5 min avg = 500 minutes
- 50 pushes to main × 5 min avg = 250 minutes
- **Total: ~750 min/month** (38% of free tier)

### 9.3 Optimization Levers

| Lever | Savings | Implementation |
|-------|---------|----------------|
| **Cancel-in-progress** | ~20% | Already included |
| **Path-filtering** | ~40% (skip frontend or backend) | Via `dorny/paths-filter` |
| **Caching** | ~50% per job install time | Via built-in cache inputs |
| **Skip build on PR** | ~1 min per frontend run | Build only for push to main |

---

## 10. Sources & Confidence

| Area | Source | Confidence |
|------|--------|------------|
| **GitHub Actions patterns** | Multiple 2026 articles (kaval, ecosire, pockit, 7tech) | HIGH — consistent recommendations across 5+ sources |
| **Vitest + Next.js 16** | Next.js official docs, 2026 community guides | HIGH — official docs verified |
| **pytest SQLite isolation** | Python pytest docs, community patterns | HIGH — well-established pattern |
| **ESLint flat config** | ESLint 10 docs, Nx docs, community guides | HIGH — official docs + multiple 2026 sources |
| **eslint-plugin-security** | npm package (v4.0.x), flat config support | MEDIUM — verified via WebSearch |
| **bandit** | PyPI docs, GitHub repo | HIGH — stable, unchanged patterns |
| **actions/setup-node** | GitHub Marketplace docs | HIGH — official action docs |
| **actions/setup-python** | GitHub Marketplace docs | HIGH — official action docs |
| **Bun in CI** | oven-sh/setup-bun GitHub Action | MEDIUM — WebSearch verified |
| **GitHub cache-dependency-path** | setup-node + setup-python docs | HIGH — official docs |

---

*Architecture analysis for CI/CD quality infrastructure: 2026-07-26*
