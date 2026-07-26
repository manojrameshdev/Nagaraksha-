# Technology Stack — Quality Infrastructure

**Project:** NagRaksha — CI/CD and Quality Tooling
**Researched:** 2026-07-26
**Mode:** Ecosystem (CI/CD pipeline, code quality checks, automated testing)

---

## Recommended Stack (Incremental Additions)

The following tools are ADDITIONS to the existing stack. Nothing existing is replaced — only `eslint.config.mjs` rules are re-enabled incrementally, and `tsconfig.json` / `next.config.ts` safety valves are tightened.

### Core Testing Frameworks

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vitest** | ^4.1.10 | TypeScript unit test runner | Faster than Jest, native ESM, Vite-powered, first-class Next.js 16 support via official docs. Works with Bun. |
| **@vitejs/plugin-react** | ^4.x | Vitest plugin for React JSX transform | Required by `vitest/config` to process JSX/TSX. Use `react()`. |
| **jsdom** | ^25.x | DOM environment for component tests | Vitest `environment: 'jsdom'` provides browser-like DOM. Lighter than happy-dom for this codebase. |
| **@testing-library/react** | ^16.3.2 | React component testing utilities | Encourages testing by user behavior, not implementation. v16+ requires React 18+ and `@testing-library/dom` as peer dep. |
| **@testing-library/dom** | ^10.x | DOM query utilities (peer dep) | Required by `@testing-library/react` v16+. |
| **@testing-library/jest-dom** | ^6.x | Custom DOM matchers (`toBeInTheDocument`, `toHaveClass`) | Makes assertions readable. Works with Vitest via `expect.extend`. |
| **pytest** | ^9.1.1 | Python test runner | Standard in Python ecosystem. pytest 9.x adds strict mode. Fixture system, parametrize, and FastAPI TestClient integration. |
| **pytest-cov** | ^6.x | Coverage reporting for pytest | Generates HTML/XML/terminal coverage. Configurable thresholds. |

### Code Quality (Linting & Formatting)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **ESLint** | ^9 (existing) | JS/TS linting | Already installed. Only re-enabling rules incrementally. No upgrade needed. |
| **@typescript-eslint/eslint-plugin** | ^8.65.0 (implicitly existing) | TypeScript ESLint rules | Already pulled in by `eslint-config-next/typescript`. Currently all rules set to `off`. |
| **eslint-plugin-security** | ^4.0.1 | Security hotspot detection | Flat config support in v4. Catches eval, innerHTML, ReDoS, path traversal patterns. Added as new plugin. |
| **Prettier** | ^3.9.6 | Opinionated code formatter | Currently NO formatter exists. Prettier enforces consistent style (semicolons, quotes, trailing commas). Resolves mixed semicolon/no-semicolon files. |

### Static Analysis

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **bandit** | ^1.9.4 | Python security static analysis | 47 security checks across 7 categories. AST-based (no false positives from formatting). Supports SARIF output for GitHub Code Scanning. |

### CI/CD Platform

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **GitHub Actions** | N/A | CI/CD platform | Already decided (see PROJECT.md). Native GitHub integration, free tier (2000 min/month), no external service. |
| **actions/checkout** | @v4 | Checkout repo in CI | Latest major version. |
| **actions/setup-node** | @v6 | Install Node.js in CI | v6.4.0 latest. Supports cache for `bun`? Use `cache: 'npm'` for root `package-lock.json`. |
| **actions/setup-python** | @v5 | Install Python in CI | v5.6.0 latest. Supports `cache: 'pip'` for `requirements.txt`. |

---

## Package Installation Commands

### Frontend (TypeScript) — Run in `frontend/` directory via Bun

```bash
# Vitest + React Testing Library
bun add -D vitest@^4.1.10 @vitejs/plugin-react@^4 jsdom@^25 \
  @testing-library/react@^16.3.2 @testing-library/dom@^10 \
  @testing-library/jest-dom@^6

# ESLint security plugin
bun add -D eslint-plugin-security@^4.0.1

# Prettier
bun add -D prettier@^3.9.6
```

### Backend (Python) — Add to `backend/requirements.txt`

```
# Testing
pytest==9.1.1
pytest-cov==6.0.0

# Static analysis
bandit==1.9.4
```

> **Note:** `httpx` is already in `requirements.txt` (>=0.27). It's used by FastAPI's `TestClient` and is already needed as a dependency. No additional install needed for testing beyond what's listed.

### Root package.json scripts additions

```json
{
  "scripts": {
    "test:frontend": "cd frontend && vitest run",
    "test:frontend:watch": "cd frontend && vitest",
    "test:backend": "cd backend && python -m pytest",
    "test:backend:cov": "cd backend && python -m pytest --cov=app --cov-report=term --cov-report=html",
    "test": "npm run test:frontend && npm run test:backend",
    "lint:frontend": "cd frontend && eslint .",
    "lint:backend": "cd backend && python -m bandit -r app/",
    "format": "prettier --write \"frontend/src/**/*.{ts,tsx}\"",
    "format:check": "prettier --check \"frontend/src/**/*.{ts,tsx}\"",
    "typecheck": "cd frontend && npx tsc --noEmit"
  }
}
```

---

## Integration Points

### 1. Vitest Configuration

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true, // describe, it, expect without imports
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

Create `frontend/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

Add to `frontend/tsconfig.json` (include test types):

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

### 2. Pytest Configuration

Create `backend/pyproject.toml` (or `backend/pytest.ini`):

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]

[tool.coverage.run]
source = ["app"]
omit = ["tests/*"]
```

Create `backend/tests/conftest.py`:

```python
"""Pytest fixtures for FastAPI test client."""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    """Provide a TestClient for integration tests."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def _setup_test_db():
    """Ensure a clean database state for each test.
    
    For now, this is a no-op since SQLite is file-based.
    Future: use tempfile + in-memory SQLite for isolation.
    """
    yield
```

### 3. ESLint Re-enablement Strategy

**Do NOT re-enable all rules at once.** The project has 30+ rules disabled. Enable in waves:

| Wave | Rules | Rationale |
|------|-------|-----------|
| 1 (immediate) | `no-console: "warn"`, `prefer-const: "error"`, `no-unused-vars: ["error", { argsIgnorePattern: "^_" }]`, `@typescript-eslint/no-unused-vars: ["error", { argsIgnorePattern: "^_" }]` | Low-risk, highly beneficial. No refactoring needed for most code. |
| 2 (after small fixes) | `react-hooks/exhaustive-deps: "warn"`, `@typescript-eslint/ban-ts-comment: "warn"`, `@next/next/no-img-element: "warn"` | Moderate risk. Requires adding dependency arrays to hooks, replacing `<img>` with `<Image>`. |
| 3 (after medium fixes) | `no-explicit-any: "warn"`, `react/no-unescaped-entities: "warn"`, `no-empty: "warn"`, `no-case-declarations: "warn"` | Higher risk. Requires adding proper types, escaping entities. |
| 4 (final) | `react-hooks/exhaustive-deps: "error"`, `no-explicit-any: "error"`, `no-debugger: "error"`, all remaining | Full strictness. Only after codebase is clean on waves 1-3. |

Add `eslint-plugin-security` to `eslint.config.mjs`:

```javascript
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import pluginSecurity from "eslint-plugin-security";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  pluginSecurity.configs.recommended,
  {
    rules: {
      // Wave 1: Enable low-risk rules immediately
      "no-console": "warn",
      "prefer-const": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      
      // Keep remaining rules at "off" initially
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "react-hooks/exhaustive-deps": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "no-debugger": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",  // Keep off — noise
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-redeclare": "off",
      "no-undef": "off",  // Already covered by TypeScript
      "no-unreachable": "off",
      "no-useless-escape": "off",
      "no-mixed-spaces-and-tabs": "off",
      
      // Security plugin: start with warnings to avoid blocking build
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-fs-filename": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"],
  },
];

export default eslintConfig;
```

### 4. TypeScript Strict Mode Changes

| Change | File | What | Risk |
|--------|------|------|------|
| `noImplicitAny: true` | `frontend/tsconfig.json` | Remove the override that allows implicit `any` (currently `noImplicitAny: false` overrides `strict: true`) | **HIGH** — will produce many errors in existing code |
| Remove `ignoreBuildErrors: true` | `frontend/next.config.ts` | Stop ignoring TS errors at build time | **MEDIUM** — after noImplicitAny is resolved |
| `reactStrictMode: true` | `frontend/next.config.ts` | Enable React strict mode (double-rendering in dev) | **LOW** — the effort level is "fix useEffect cleanup functions" |

**Recommended order:** Do NOT do all at once.
1. First: Enable `noImplicitAny: true`, fix all errors across the codebase.
2. Second: Remove `ignoreBuildErrors: true`, verify `next build` passes.
3. Third: Set `reactStrictMode: true`, fix any double-mount issues.

### 5. Prettier Configuration

Create `frontend/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

> **Note:** The project currently has mixed semicolons — `src/lib/` files use no semicolons, `src/components/` files use them. Running Prettier will standardize this. Do a one-time `prettier --write` on the entire `frontend/src/` directory, then commit the formatting change as a single "format everything" commit separate from logic changes.

### 6. GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  frontend:
    name: Frontend (TypeScript)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v6
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npx vitest run --coverage

      - name: Build
        run: npm run build

  backend:
    name: Backend (Python)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Lint (bandit)
        run: python -m bandit -r app/ -x tests/

      - name: Test
        run: python -m pytest --cov=app --cov-report=term --cov-report=xml

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-backend
          path: backend/coverage.xml
```

**CI cost estimate for free tier:**
- Each run: ~4-6 minutes (frontend build takes longest)
- At 50 pushes/PRs per month: ~300 minutes ≈ 5 hours
- Free tier: 2000 min/month (public repos unlimited)
- **Comfortably within limits** for a private repo at this scale.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **TS Test Runner** | Vitest | Jest | Jest has slower startup, ESM/CJS compatibility issues with Next.js 16. Vitest is the official recommendation in Next.js docs. |
| **TS Test Runner** | Vitest | Bun:test | Bun:test is Bun-native but lacks the ecosystem (no @testing-library compatibility). Vitest works with both Bun and Node runtimes. |
| **Python Test Runner** | pytest | unittest | pytest has fixtures, parametrization, better assertion introspection. unittest is stdlib but verbose. |
| **Python Linter (security)** | bandit | Semgrep | Semgrep is more powerful but overkill for ~19 Python files. Bandit is Python-specific, lightweight, and sufficient. |
| **TS Formatter** | Prettier | dprint / Biome | Biome is faster but Prettier is the ecosystem standard. Consistency with shadcn/ui generated code (which uses semicolons). |
| **TS Security Lint** | eslint-plugin-security | SonarQube / CodeQL | Both require separate services/setup. eslint-plugin-security runs inline with ESLint — zero new infra. |
| **CI Platform** | GitHub Actions | CircleCI / GitLab CI | GitHub-native, zero config for GitHub repos. Free tier generous for this codebase size. |
| **Coverage Tool (TS)** | Vitest built-in (@vitest/coverage-v8) | Istanbul | @vitest/coverage-v8 uses native V8 coverage (faster). Istanbul is compatible but slower. |
| **Coverage Tool (Python)** | pytest-cov | coverage.py | pytest-cov integrates as pytest plugin (`--cov`), less config than raw coverage.py. |

---

## Decisions & Rationale

### Why Vitest over Jest
Next.js 16 has an official [Testing with Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest). Vitest natively understands Vite config (used internally by Next.js for the dev server), shares the same transform pipeline, and supports ESM out of the box. Jest requires `next/jest` transformer and has ongoing CJS/ESM compatibility issues with React 19. Vitest 4.x supports globals mode for Jest-like API without needing `@jest/globals`.

### Why @testing-library/react over Enzyme
Enzyme is unmaintained since React 17. Testing Library is the React team's recommended approach and tests components the way users interact with them (by role, text, label) rather than by internal state.

### Why pytest-cov over coverage.py
pytest-cov is a pytest plugin (`--cov` flag). Simpler config than standalone `coverage.py` run. Output formats include HTML, XML (for CI), and terminal.

### Why eslint-plugin-security rather than SonarQube
~19 Python files and ~40 TypeScript/TSX files do not warrant a full SonarQube or SonarCloud setup. eslint-plugin-security runs as part of the existing ESLint pipeline — zero additional infrastructure. Bandit covers the Python side similarly.

### Why Prettier now (not later)
The codebase has inconsistent semicolons, quotes, and formatting (shadcn/ui uses semicolons, hand-written lib files don't). Prettier eliminates all style discussions and makes PR diffs predictable. One-time format-all commit, then enforce via CI `prettier --check`.

### Why cache in CI
- Frontend: `actions/setup-node@v6` with `cache: 'npm'` caches `node_modules` based on `package-lock.json` hash.
- Backend: `actions/setup-python@v5` with `cache: 'pip'` caches pip packages based on `requirements.txt` hash.
- Reduces install time from ~60s to ~5s on cache hit.

---

## Phasing Within This Milestone

| Phase | What | Depends On |
|-------|------|------------|
| 1. Prettier + ESLint Wave 1 | Format all files, enable `no-console`, `prefer-const`, `no-unused-vars` | Nothing |
| 2. TypeScript strict mode | `noImplicitAny: true`, fix all errors | Phase 1 (less noise) |
| 3. Vitest setup | Install Vitest + RTL, create config, write first tests | Nothing |
| 4. pytest setup | Install pytest + pytest-cov, create config and fixtures, write first tests | Nothing |
| 5. ESLint Wave 2-4 | Gradually tighten remaining rules | Phase 1-2 (reduced error count) |
| 6. Static analysis | Install eslint-plugin-security, bandit, configure both | Nothing |
| 7. CI workflow | Create `.github/workflows/ci.yml` | Phase 1-6 (CI must pass all checks) |
| 8. README badges | Add CI status, coverage badges | Phase 7 |

---

## Sources

| Tool | Source | Confidence |
|------|--------|------------|
| Vitest 4.1.10 | npm registry (https://www.npmjs.com/package/vitest) | HIGH |
| Next.js Vitest guide | Next.js docs (https://nextjs.org/docs/app/guides/testing/vitest) | HIGH |
| @testing-library/react 16.3.2 | npm registry (https://www.npmjs.com/package/@testing-library/react) | HIGH |
| pytest 9.1.1 | PyPI (https://pypi.org/project/pytest/) | HIGH |
| eslint-plugin-security 4.0.1 | npm registry (https://www.npmjs.com/package/eslint-plugin-security) | HIGH |
| @typescript-eslint/eslint-plugin 8.65.0 | npm registry (https://www.npmjs.com/package/@typescript-eslint/eslint-plugin) | HIGH |
| bandit 1.9.4 | PyPI (https://pypi.org/project/bandit/) | HIGH |
| Prettier 3.9.6 | npm registry (https://www.npmjs.com/package/prettier) | HIGH |
| actions/setup-node@v6 | GitHub Marketplace (https://github.com/actions/setup-node) | MEDIUM (WebSearch-verified) |
| actions/setup-python@v5 | GitHub Marketplace (https://github.com/actions/setup-python) | MEDIUM (WebSearch-verified) |
| FastAPI TestClient | FastAPI docs (https://fastapi.tiangolo.com/tutorial/testing/) | HIGH |

---

*Stack analysis for quality infrastructure: 2026-07-26*
