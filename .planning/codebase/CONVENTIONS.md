# Coding Conventions

**Analysis Date:** 2026-08-13

## Naming Patterns

**Files:**
- Python modules: snake_case, feature-named (`backend/app/routes/twilio_webhook.py`, `backend/app/knowledge_base_data.py`)
- React components: kebab-case filenames with PascalCase exports (`frontend/src/components/wound-tracker.tsx` exports `WoundTracker`)
- Tests: `test_*.py` for pytest; `*.test.ts` for vitest (`backend/tests/test_domain.py`, `frontend/src/lib/__tests__/nagraksha.test.ts`)

**Functions:**
- Python: snake_case (`get_ranked_hospitals`, `stock_freshness_score`, `_worker_tick`); private helpers prefixed `_` (`_load_incident`, `_twilio_client`, `_emit`)
- TypeScript: camelCase (`apiUrl`, `rankHospitals`, `useIncidentSocket`); React hooks prefixed `use` (`useGeolocation`, `useSosStore`)

**Variables:**
- Python: snake_case (`inc_id`, `hospital_ids`, `freshness_score`); module-level constants UPPER_SNAKE (`ROAD_FACTOR`, `EMERGENCY_RE`, `SYSTEM_PROMPT`)
- TypeScript: camelCase (`activeRole`, `drawerOpen`); UPPER_SNAKE for constants (`RADIUS_EARTH_KM`, `INCIDENT_STATES`)

**Types:**
- Python: Pydantic models in `backend/app/models.py` (singular feature names: `SosRequest`, `StockUpdate`, `MythRequest`, `StakeholderRequest`); inline Pydantic models in `transcribe.py`/`snake_id.py` where local
- TypeScript: interfaces PascalCase, defined near usage (`GeoLocation`, `IncidentData`, `WoundReading`, `RankedHospital`); `type` unions for state enums (`SosState['phase']`, `StockStatus`)

## Code Style

**Formatting:**
- Prettier (`.prettierrc`): semi, singleQuote, tabWidth 2, trailingComma all, printWidth 100, arrowParens always, endOfLine lf
- Enforced via `format:write` / `format:check` scripts (root `package.json`) and lint-staged pre-commit
- Python: no formatter pinned in CI, but ruff is run (`ruff check backend/app` in `.github/workflows/ci.yml`); code uses 4-space indent, docstrings, `from __future__ import annotations`

**Linting:**
- ESLint flat config (`frontend/eslint.config.mjs`): next core-web-vitals + next/typescript + eslint-plugin-security recommended + typescript-eslint
- Key rules at error: `prefer-const`, `no-unused-vars` (with `^_` ignore pattern), `no-console`, `no-debugger`, `no-empty`, `no-fallthrough`, `no-redeclare`, `no-undef`, `no-useless-escape`
- `--max-warnings 0` in lint-staged (root `package.json`)
- Ignored: `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`, `examples`, `skills`, `src/components/ui/**`, `*.test.ts(x)`, `src/test/**`
- Python: ruff in CI; Bandit config `.bandit.yaml` (skips B101, B110, B311; severity/confidence medium; excludes `.planning`, `docs`, `model`, `frontend`)

## Import Organization

**Order (TypeScript):**
1. React/external libraries (`react`, `next`, `zustand`, `lucide-react`)
2. Internal components (`@/components/...`)
3. Internal lib/hooks/stores (`@/lib/api`, `@/store/sos-store`, `@/hooks/use-geolocation`)
4. Relative imports last (`./voice-input`, `../nagraksha`)

**Path Aliases:**
- `@/*` → `frontend/src/*` (`frontend/tsconfig.json:paths`, mirrored in `frontend/vitest.config.ts:resolve.alias`)
- Relative imports used within a directory (`./voice-input` in `interactive.tsx`)

**Order (Python):**
- stdlib → third-party → local (`backend/app/routes/hospitals.py`: `fastapi` then `..models`, `..database`, `..eventbus`); `from __future__ import annotations` first

## Error Handling

**Patterns:**
- Backend: fail-open everywhere. LLM providers return `None` on failure (`backend/app/llm.py`); RAG has a 3-tier fallback chain (`backend/app/rag.py:rag_answer`); audit writes wrapped in try/except (`backend/app/eventbus.py:audit`); outbox worker marks events `FAILED` after 4 attempts (`eventbus.py:150-160`)
- HTTP errors: `HTTPException` for real failures (`backend/app/routes/wound.py`, `backend/app/routes/audit.py`); some routes return `{"error": "..."}` with 200 instead (inconsistent — see CONCERNS.md)
- Frontend: `try/catch` around fetches with `toast.error`/`toast.success` (sonner) (`frontend/src/components/interactive.tsx`); `EventSource.onerror` handled gracefully
- Python: `except Exception` broadly, logging via `print()`; type-annotated return `Optional[str]`/`dict | None` to signal fallback paths

## Logging

**Framework:** `print()` statements in backend (no logging module): `[Compliance] ...`, `[Dispatch] ...`, `[RAG] ...`, `[Scheduler] ...`. Frontend uses `console.log/warn/error` (allowed despite `no-console` rule? — no: `no-console` is `error`; `frontend/src/lib/realtime.ts:14` uses `console.log` which would fail lint; verify when linting).

**Patterns:**
- Domain events logged to `AuditEvent` table (`backend/app/eventbus.py:audit`) — the structured log
- Process logs teed to `backend.log` / `dev.log` (root `package.json` scripts)
- Sentry for backend errors when `SENTRY_DSN` set (`backend/app/main.py:22`)

## Comments

**When to Comment:**
- Module-level docstrings explain purpose + run instructions (`backend/app/main.py:1-5`, `backend/app/rag.py:1-5`)
- Section banner comments separate concerns (`# ── Sentry ────`, `# ── Auth token endpoint ────` in `backend/app/main.py`)
- Inline comments document rationale and SRS references (`# nosec B608` in `seed.py`, `# System Design step 3+4` in `sos.py`, `# fixes reconnect loop bug` in `incidents.py`)
- Frontend: `/** */` JSDoc on helpers (`frontend/src/lib/api.ts`, `frontend/src/hooks/use-geolocation.ts`), block comments explain tradeoffs (`lazy-sections.tsx` OOM note)

**JSDoc/TSDoc:**
- Used on exported library functions and hooks; light in components

## Function Design

**Size:** Python modules small and focused (`compliance.py` 73 lines, `auth.py` 73 lines); `snake_id.py` (411) and `llm.py` (294) are the largest. Frontend `interactive.tsx` (1791 lines) is an outlier (see CONCERNS.md).

**Parameters:** Pydantic models for request bodies; explicit typed params for query/forms (`backend/app/routes/hospitals.py` uses `Query(12.8003, ge=-90, le=90)`); optional params default to demo values (lat/lng default Bannerghatta).

**Return Values:**
- Backend routes return dicts (FastAPI serializes); list/dict conventions per endpoint
- Domain functions return dicts with consistent keys (`rank_hospitals` returns hospitals with `rank`, `recommended`, `compositeScore`, `complianceBadge`)
- `simulate_dispatch`/`do_dispatch` share the same return shape `{trained, rescue, ambulance}` for compatibility (`backend/app/dispatch.py:99-118`)
- LLM/vision/audit functions return `None`/fallback values instead of raising

## Module Design

**Exports:**
- Python routers: `router = APIRouter()` per module, registered in `backend/app/main.py`
- Frontend panels: named exports (`export function LiveSosDemo`); `SnakeIdUpload = SnakeId` alias for the same component (`interactive.tsx:1518`)
- Lazy wrappers: `LazyArchitecture`, `LazyLiveSosDemo`, etc. via `next/dynamic` (`frontend/src/components/lazy-sections.tsx`) — note most lazy wrappers are not rendered by `page.tsx`

**Barrel Files:**
- `backend/app/routes/__init__.py` imports route modules for `main.py`
- No frontend barrel files; components imported directly

---

*Convention analysis: 2026-08-13*
