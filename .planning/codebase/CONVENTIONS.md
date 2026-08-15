# Coding Conventions

**Analysis Date:** 2026-08-15

## Formatting

**Prettier (root `.prettierrc`):**
- `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`, `endOfLine: "lf"`
- Run: `npm run format:write` / `format:check` (covers `**/*.{ts,tsx,js,jsx,json,css,md,mjs}`)
- Exclusions in `.prettierignore`: `.planning/`, `docs/`, `model/`, `*.log`, `.env*`, `backend/db/*.db`

**Backend (Ruff):**
- Enforced in CI: `ruff check backend/app` (`.github/workflows/ci.yml`)
- No ruff config file in repo; CI uses ruff defaults

## Linting

**Frontend ESLint (`frontend/eslint.config.mjs`, flat config):**
- Base: `eslint-config-next` core-web-vitals + typescript, `eslint-plugin-security` recommended
- All rules at `error`; repo scripts enforce `--max-warnings 0`
- Hard errors: `no-console`, `no-debugger`, `no-empty`, `no-undef`, `no-unused-vars` (both core and `@typescript-eslint`) with ignore patterns `^_` for args/vars/caught errors
- Ignored paths: `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`, `components/ui/**`, `*.test.*`, `test/**`

**Backend security (Bandit, `.bandit.yaml`):**
- Skips B101 (assert), B110 (pass), B311 (random); severity/confidence medium
- Excludes `frontend/`, `.planning/`, `docs/`, `model/`

## Code Style

**Frontend (TypeScript/React):**
- Client components start with `'use client';` (`frontend/app/page.tsx`, `frontend/hooks/*.ts`)
- Functional components + hooks; explicit return types on hooks
- No `console.*` — errors surfaced via state (e.g. `sosError`, `error` state in `frontend/store/sos-store.ts`, `frontend/app/incidents/[id]/page.tsx`)
- Lazy state initializers for SSR safety: `useState(readStoredRole)` not `useState(null)` + effect (`frontend/hooks/use-auth.ts`, `use-geolocation.ts`)
- No synchronous `setState` inside effects (react-hooks/set-state-in-effect) — effects do async fetch + cleanup `cancelled` flag (`frontend/app/incidents/[id]/page.tsx`)
- Unused params prefixed `_` (e.g. `(_lat: number)` in `frontend/store/sos-store.ts` actions)
- Types via `interface`; DOM lib types avoided in annotations (`Parameters<typeof fetch>[1]` in `frontend/lib/api.ts`)

**Backend (Python):**
- `from __future__ import annotations` at top of every module
- Module-level docstring explaining purpose (`backend/app/routes/sos.py`, `backend/app/eventbus.py`, `backend/app/database.py`)
- Raw SQL via `sqlite3` with `?` placeholders (no ORM); connection via `db.get_conn()` context manager
- IDs: `db.new_id()` (24-hex uuid); timestamps: `db.now_iso()` (UTC ISO-8601 with `Z`)
- Route modules: `router = APIRouter()` + `@router.<method>` decorators; Pydantic request models in `backend/app/models.py`
- Background/optional providers degrade gracefully: Twilio → `simulate_dispatch()`, LLM → retrieval-only

## Imports

- Python: stdlib → third-party → local (`backend/app/main.py`, `backend/app/eventbus.py`)
- Frontend: external packages first, then `@/` alias imports (`frontend/app/page.tsx`)
- Frontend path alias `@/*` maps to frontend root (`@/lib/nagraksha`, `@/components/ui/button`)

## Error Handling

**Backend:**
- Raise `HTTPException(status_code, detail=...)` at route boundary for expected failures (404/401)
- `RateLimitExceeded` handled globally (slowapi)
- Outbox worker: retries with `attempts` counter, `FAILED` state on exhaustion, `_inflight` set skips in-progress events
- Background WS broadcast wrapped in try/except — best-effort push

**Frontend:**
- `apiFetch` throws `ApiError` (extends Error, explicit `status` property) on non-2xx (`frontend/lib/api.ts`)
- Callers catch and set error state; `e instanceof Error ? e.message : 'fallback'` pattern
- WS message parse failures swallowed silently (`frontend/lib/realtime.ts`)

## Comment Conventions

- Python: docstrings at module/function level; section banner comments (`# ── Auth token endpoint ───`) in `main.py`
- No TODO/FIXME markers found in `backend/app/` or `frontend/` source (grep verified 2026-08-15)
- Comments explain *why* (e.g. the WS payload → DispatchAttempt mapping note in `frontend/store/sos-store.ts`)

## Function Design

- Small focused helpers over monoliths (e.g. `backend/app/domain.py` splits `haversine_km` / `road_km` / `eta_min` / `stock_freshness_score`)
- Guard clauses + early returns (`backend/app/auth.py` `_env_secret`, `backend/app/rag.py` `_get_collection`)
- Lazy loading for heavy optional deps: Twilio client (`backend/app/dispatch.py`), GGUF model (`backend/app/llm.py`), ChromaDB (`backend/app/rag.py`)

## Module Design

- Backend: one route module per feature, registered centrally in `backend/app/main.py`
- Frontend: API surface split into `api.ts` (fetch plumbing) + `nagraksha.ts` (typed endpoints); store actions typed via `interface SosActions`
- Zustand store: individual selectors at call sites (`useSosStore((s) => s.triggerSos)`) to limit re-renders

---

*Convention analysis: 2026-08-15*
*Update when patterns change*
