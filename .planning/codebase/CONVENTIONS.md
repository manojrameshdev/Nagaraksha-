# Coding Conventions

**Analysis Date:** 2026-08-14

## Codebase Shape

The repo is a two-part monorepo with a shared root:

- **Backend** — Python 3.10+ / FastAPI, lives in `backend/app/` (SQLite via raw `sqlite3`, no ORM).
- **Frontend** — Next.js 16 / React 19 / TypeScript / Tailwind v4, lives in `frontend/`.
- **Root** — `package.json` (dev tooling: prettier, eslint, husky, lint-staged), `setup.py`/`start.py` (dev orchestration), `scripts/dev.sh`.

Conventions differ per side and are documented separately below.

---

## Backend (Python) Conventions

### Naming Patterns

**Files:**
- snake_case: `app/database.py`, `app/routes/twilio_webhook.py`
- Tests: `backend/tests/test_*.py` (e.g. `test_routes.py`, `test_eventbus.py`)

**Functions:**
- snake_case: `def haversine_km(...)`, `def stock_freshness(...)` in `backend/app/domain.py`
- Module-private helpers prefixed with `_`: `_load_incident`, `_mark_processed`, `_get_collection`, `_worker_tick` in `backend/app/eventbus.py`, `backend/app/rag.py`
- Dependency-factory functions return a closure named `_check`: see `require_role()` / `require_role_if_enforced()` in `backend/app/auth.py`

**Variables & Module Constants:**
- Local variables: snake_case (`inc_id`, `now`, `attempt_id`)
- Constants: ALL_CAPS at module level — `ROAD_FACTOR`, `SCHEMA`, `TWILIO_FROM`, `EMERGENCY_RE`, `SYSTEM_PROMPT`, `ALGORITHM` (`backend/app/domain.py`, `backend/app/database.py`, `backend/app/rag.py`, `backend/app/auth.py`)
- Module-global mutable state is `_`-prefixed: `_bus_lock`, `_subscribers`, `_worker_started`, `_inflight` in `backend/app/eventbus.py`; `_lock`, `_client`, `_collection` in `backend/app/rag.py`

**Types:**
- Pydantic v2 `BaseModel` request bodies in `backend/app/models.py` (e.g. `SosRequest`, `StockUpdate`, `HouseholdAuditRequest`)
- Field names use the API contract casing: camelCase in `SosRequest` (`biteTime`, `bodyPart`, `snakeType`) and snake_case in audit models (`asha_worker_id`, `gram_panchayat`) — match the JSON contract the route consumes
- Python 3.10+ union syntax `str | None` used in newer modules (`backend/app/llm.py`, `backend/app/scheduler.py`); `Optional[str]` from `typing` still appears in `backend/app/models.py` — prefer `X | None` for new code
- Return annotations on helpers in `backend/app/database.py` (`-> str`, `-> float`); many route/domain functions omit return types (`backend/app/routes/sos.py`, `backend/app/domain.py`) — annotate new functions

### Code Style

**Formatting:**
- 4-space indentation, ~100 char line length (ruff default; `ruff check backend/app` in `.github/workflows/ci.yml`)
- `from __future__ import annotations` is the first import in every module
- Module-level docstring (triple-quoted) at the top of every file, e.g. `"""Outbox worker state machine tests."""` in `backend/tests/test_eventbus.py`
- Box-drawing section separators for file organization: `# ── Sentry ────`, `# ── Rate limiter ────` in `backend/app/main.py`; `# ── public retrieval API ──` in `backend/app/rag.py`; `# ── local GGUF ──` in `backend/app/llm.py`

**Linting:**
- Ruff with default rules via CI: `ruff check backend/app` (`.github/workflows/ci.yml:28`). No `pyproject.toml`/`ruff.toml`/`setup.cfg` exists — rules are defaults
- Bandit configured in `.bandit.yaml` (skips B101 assert, B110 try/except-pass, B311 random; severity/confidence medium). Not run in CI
- `# noqa` used deliberately, e.g. `except Exception as e:  # noqa: BLE001 - guard rail...` in `backend/app/eventbus.py:161`

### Import Organization

**Order:**
1. `from __future__ import annotations`
2. stdlib (`import os`, `import json`, `from contextlib import contextmanager`)
3. third-party (`from fastapi import APIRouter`, `from pydantic import BaseModel`)
4. local relative imports with `from . import database as db` / `from ..models import X` — every module imports the DB layer as `db` (`backend/app/eventbus.py:16`, `backend/app/routes/sos.py:8`)
5. Some modules do lazy in-function imports for optional deps: `from twilio.rest import Client` inside `_twilio_client()` (`backend/app/dispatch.py:21`), `import chromadb` inside `_get_collection()` (`backend/app/rag.py:33`), `from .compliance import compliance_badge` inside `rank_hospitals()` (`backend/app/domain.py:109`)

**Path Aliases:** None — Python relative imports only.

### Error Handling

**Patterns:**
- API errors: `raise HTTPException(status_code=..., detail="...")` — 404 for missing resources, 409 for conflicting state, 401/403 from auth (`backend/app/routes/incidents.py:57,120`, `backend/app/auth.py:100,107`)
- Validation: Pydantic request models + FastAPI `Query(5, ge=1, le=50)` bounds (`backend/app/routes/incidents.py:42`); invalid input surfaces as FastAPI 422 automatically
- Best-effort subsystems swallow errors with bare `except Exception: pass` plus a comment explaining why: subscriber calls (`backend/app/eventbus.py:50-51`), audit writes (`backend/app/eventbus.py:72-73`), worker tick (`backend/app/eventbus.py:223-224`)
- External integrations return `None` on failure so callers fall back: `dispatch_sms()` returns `None` (`backend/app/dispatch.py:63`), `generate()` returns `None` (`backend/app/llm.py:179`), `_generate_*` providers return `None` on any exception
- `try/except` + `finally` for cleanup in tests (`backend/tests/test_compliance.py:33-53`)
- Python `raise ... from` not used; bare `raise` not used

### Logging

**Framework:** `print()` — no `logging` module anywhere in `backend/app/`.

**Patterns:**
- Tagged prefix per subsystem: `print(f"[Eventbus] ...")`, `print(f"[Dispatch] ...")`, `print(f"[Compliance] ...")`, `print(f"[Scheduler] ...")`, `print(f"[RAG] ...")` (`backend/app/eventbus.py:162`, `backend/app/dispatch.py:133`, `backend/app/compliance.py:71`, `backend/app/scheduler.py:31`, `backend/app/rag.py:43`)
- Human-readable status lines at startup (`backend/app/main.py` lifespan, `backend/app/scheduler.py:31`)
- Never log secrets; ASCII-only in prints (comment in `backend/app/dispatch.py:131-132` explains Windows cp1252 constraints)

### Comments

**When to Comment:**
- Module docstrings explain *why* the module exists and design context (e.g. `backend/app/eventbus.py:1-7` quotes the System Design doc)
- Function docstrings document formula/weights and non-obvious behavior (`stock_freshness_score` in `backend/app/domain.py:41-42`, `rank_hospitals` weight table `backend/app/domain.py:79-86`)
- Inline `#` comments explain tradeoffs and fallbacks: `# outbox event in the same transaction (System Design step 3+4)` (`backend/app/routes/sos.py:28`), `# Road distance factor for India (rural winding roads)` (`backend/app/domain.py:19`)
- Section separators use the `# ──` box style
- No TODO/FIXME/HACK comments exist in `backend/app/` or `backend/tests/` (verified via grep)

**Docstrings:**
- Module + function docstrings are the norm; single-line for simple helpers, multi-line with param explanations for complex ones
- Tests carry docstrings only when the test's intent needs explaining (`backend/tests/test_eventbus.py:1-5`)

### Function Design

**Size:** Functions stay small (< ~60 lines); the dispatch handler `_handle_incident_created` (~70 lines) is the largest and is being split via helper `_wait_for_accept_then_advance`.

**Parameters:** Positional with defaults for domain helpers (`rank_hospitals(origin, hospitals, compliance_weight=0.30)`); keyword-only via `*` for public API flags (`generate(prompt, max_tokens=512, temperature=0.7, *, system_prompt="")` in `backend/app/llm.py:179`).

**Return Values:** Plain `dict`/`list`/`str`/`float` — no dataclasses. APIs return nested dicts: `{"incident": ..., "ref": ..., "streamUrl": ...}` (`backend/app/routes/sos.py:39-47`). DB rows are converted `dict(r)` before return (`backend/app/routes/sos.py:55`).

### Module Design

**Exports:**
- Route modules define `router = APIRouter()` and are registered in `backend/app/main.py` via `app.include_router(x.router)`
- Public helpers are importable (`append_outbox`, `audit`, `start_worker` from `backend/app/eventbus.py`); internals `_`-prefixed
- `from . import database as db` aliasing keeps DB calls terse (`db.new_id()`, `db.now_iso()`, `db.get_conn()`)

### Database Access Pattern (special convention)

- Raw SQL with camelCase table/column names matching the old Prisma schema (`Incident`, `DispatchAttempt`, `AntivenomStock` — see `backend/app/database.py:19-236` SCHEMA)
- Every access goes through the `@contextmanager` `db.get_conn()` which commits on success, rolls back on exception, closes in `finally` (`backend/app/database.py:274-288`)
- IDs from `db.new_id()` (`uuid4().hex[:24]`); timestamps from `db.now_iso()` (UTC, `Z` suffix)
- Migrations are idempotent ALTER TABLE guards in `migrate_db()` (`backend/app/database.py:244-261`)

### Test Conventions (Python)

See TESTING.md for the full pattern; key style rules: classes `TestXxx`, methods `test_xxx`, plain `assert` (no pytest.raises style exceptions to that — see `backend/tests/test_eventbus.py`), `pytestmark = pytest.mark.asyncio` for async suites, DB fixtures that insert then delete rows.

---

## Frontend (TypeScript/React) Conventions

### Naming Patterns

**Files:**
- kebab-case: `layout.tsx`, `page.tsx`, `globals.css`, `workspaces.tsx`, `shared.tsx`, `button.tsx` under `frontend/app/`, `frontend/components/`
- Path alias `@/*` maps to the `frontend/` root (`frontend/tsconfig.json:21-23`) — imports use `@/lib/utils`, `@/components/nagraksha/shell`

**Functions/Components:**
- PascalCase component names, exported as named `export function` (NOT arrow functions, NOT default exports except pages/layouts): `export function AppShell(...)`, `export function WorkspaceSidebar(...)` in `frontend/components/nagraksha/shell.tsx`
- `function RoleWorkspace(...)` dispatch component uses early-return if/else chain (`frontend/components/nagraksha/workspaces.tsx:19`)
- camelCase for helper functions and state setters: `demoSos()`, `setRole` (`frontend/app/page.tsx:11`)

**Types:**
- Inline prop type annotations directly on the parameter list, no separate `interface`/`type Props`: `{ role, onRoleChange }: { role: Role; onRoleChange: (role: Role) => void }` (`frontend/components/nagraksha/shell.tsx:20`)
- Union string literal types for closed sets: `type Role = 'Victim' | 'Responder' | ...` (`shell.tsx:8`), `type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'` (`frontend/components/nagraksha/shared.tsx:7`)
- `Record<Role, ...>` maps for role → config: `roleIcons`, `labels` (`shell.tsx:9,16`)
- `import type { ... }` for type-only imports (`shared.tsx:3`)

### Code Style

**Formatting (declared vs actual):**
- `.prettierrc` declares: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`, `arrowParens: "always"`, `endOfLine: "lf"` (root `.prettierrc`)
- **Actual code deviates from the declared config**: current files under `frontend/app/`, `frontend/components/`, `frontend/lib/` use single quotes but NO semicolons (`frontend/lib/utils.ts:1-2`), and many JSX lines far exceed printWidth 100 (e.g. `frontend/components/nagraksha/shared.tsx:16-37` are single-line components, `shell.tsx:18-23`). `npm run format:check` (root `package.json`) will currently fail on these files. New code should match the declared Prettier config and be formatted via `npm run format:write`; do not reproduce the unformatted one-liner style
- 2-space indentation
- Tailwind v4 utility classes throughout; no CSS modules; single `frontend/app/globals.css` with `@theme` design tokens (CSS variables `--color-*`, `--radius-*`)

**Linting:**
- `frontend/package.json:9` has `"lint": "eslint ."` and root `package.json:11` runs `cd frontend && eslint .`
- **No ESLint config file exists** (`eslint.config.mjs` is referenced by root `package.json` lint-staged at `--config frontend/eslint.config.mjs` but the file is absent). `npm run lint` will fail today. Adding `frontend/eslint.config.mjs` (flat config, per `eslint-config-next` + `typescript-eslint` devDeps in root `package.json`) is required before lint gates can run
- `next.config.mjs:3-5` sets `typescript: { ignoreBuildErrors: true }` — type errors do not fail production builds

### Import Organization

**Order:**
1. `'use client'` directive (client components only — `page.tsx`, `shell.tsx`, `shared.tsx`, `workspaces.tsx`)
2. external packages: `import { useState } from 'react'`, `import { cn } from '@/lib/utils'`, `import { Button as ButtonPrimitive } from '@base-ui/react/button'` (aliased re-export pattern in `frontend/components/ui/button.tsx:1`)
3. local alias imports `@/lib/utils`, `@/components/...`
4. relative imports within the same folder: `import { ConnectivityIndicator, DemoModeBadge } from './shared'` (`shell.tsx:6`)
- Type-only imports use `import type` (`frontend/components/nagraksha/shell.tsx:3,7`)

**Path Aliases:**
- `@/*` → `./*` (frontend root): use for cross-directory imports (`@/components/ui/button`, `@/lib/utils`)

### Error Handling

- No try/catch or error boundaries in the current frontend code — the UI is a static/demo presentation layer
- Resilience handled by data-shape defaults: optional props with defaults (`rows = ['NR-DEMO-1042', ...]` in `frontend/components/nagraksha/shared.tsx:33`, `state = 'online'` in `shared.tsx:17`)
- Production-only conditional render for analytics: `{process.env.NODE_ENV === 'production' && <Analytics />}` (`frontend/app/layout.tsx:43`)

### Logging

**Framework:** None in the frontend — no `console.log`/`console.error` calls in `frontend/app/`, `frontend/components/`, or `frontend/lib/`. Debug output goes through the backend `print()` pattern instead.

### Comments

**When to Comment:** Rare — no JSX comments, no TODO/FIXME markers (verified via grep). The code is self-documenting via descriptive names. Only doc-style text lives in copy (visible UI strings) and `metadata`/`manifest` descriptions (`frontend/app/layout.tsx:5-27`, `frontend/app/manifest.ts`).

### Function/Component Design

**Size:** Each workspace component renders one role's full screen inline (no subcomponent extraction) — `VictimWorkspace`, `ResponderWorkspace`, etc. in `frontend/components/nagraksha/workspaces.tsx:9-17` are large single expressions. Prefer extracting small presentational components into `frontend/components/nagraksha/shared.tsx` (the established pattern: `PageTitle`, `MetricCard`, `StatusBadge`, `IncidentTable`, `EmptyState`, `LoadingState`).

**Parameters:** Props destructured inline with defaults: `function EmptyState({ title = 'No active incidents', detail = 'Demo data — ...' }: { title?: string; detail?: string })` (`shared.tsx:29`).

**Return Values:** JSX only. Components return `React.ReactNode` for composition slots (`children`).

### Module Design

**Exports:**
- Named exports for every component/helper; no default exports (except App Router pages/layouts `export default function Page()/RootLayout()` in `frontend/app/page.tsx:7`, `frontend/app/layout.tsx:34`)
- Small building blocks live in `frontend/components/ui/` (primitive wrappers like `Button` with `cva` variants + `data-slot` attributes — shadcn-style, `frontend/components/ui/button.tsx`)
- Domain presentation components live in `frontend/components/nagraksha/` (`shared.tsx` primitives, `shell.tsx` navigation, `workspaces.tsx` role screens)
- Shared utility `cn(...inputs)` (clsx + tailwind-merge) in `frontend/lib/utils.ts` is the single helper used to compose class names

### Accessibility (de-facto convention)

- `aria-label` on icon-only controls (`shell.tsx:18`, `shared.tsx:30`)
- `aria-hidden="true"` on decorative icons, `sr-only` text for search inputs (`workspaces.tsx:16`)
- `aria-current="page"` on active nav items (`shell.tsx:18`)
- `focus-visible:ring-*` classes on interactive elements (`shared.tsx:36`)
- Semantic elements: `<button type="button">`, `<nav aria-label>`, `<table>` with `<thead>`

---

## Cross-Project Conventions

**Commits:** Conventional Commits with optional scope, verified in `git log`:
- `feat: ...`, `fix(llm): ...`, `fix(test): ...`, `refactor: ...`, `docs: ...`, `chore: ...`
- Scope examples: `(llm)`, `(test)`, `(frontend)`, `(setup)`

**Pre-commit gate:** `.husky/pre-commit` runs `npx lint-staged` (root `package.json:17-25`) — prettier write + `eslint --fix --max-warnings 0 --no-warn-ignored --config frontend/eslint.config.mjs` on staged `*.{ts,tsx,js,jsx,mjs}`; prettier write only on `*.{json,css,md}`. Note the lint-staged eslint step will fail until `frontend/eslint.config.mjs` exists.

**Config files:**
- `.prettierrc` + `.prettierignore` (root): ignores `node_modules`, `.next`, `out`, `.env*`, `*.log`, `backend/db/*.db`, `.planning`, `docs`, `model`
- `.bandit.yaml` (root): backend security scan exclusions (`frontend`, `docs`, `model`, `.planning`)
- `.env` / `.env.example` present at root (environment configuration; never commit real values)

---

*Convention analysis: 2026-08-14*
