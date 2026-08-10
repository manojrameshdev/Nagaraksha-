# Coding Conventions

**Analysis Date:** 2026-08-11

Monorepo with two convention surfaces: a Next.js/TypeScript frontend (`frontend/`) and a Python FastAPI backend (`backend/`). Both are linted in CI (`.github/workflows/ci.yml`).

## Naming Patterns

### Frontend (TypeScript/React)

**Files:**
- `kebab-case` for component/lib/hook files: `frontend/src/components/voice-input.tsx`, `frontend/src/hooks/use-geolocation.ts`, `frontend/src/lib/knowledge-base.ts`
- `snake_case` for test fixtures directory: `frontend/src/lib/__tests__/`
- Config files: `frontend/next.config.ts`, `frontend/vitest.config.ts`, `frontend/tailwind.config.ts`

**Functions:**
- `camelCase`, exported via `export function` declarations (never arrow-const exports): `frontend/src/lib/nagraksha.ts` (`export function haversineKm(...)`)
- Hooks prefixed `use`: `useGeolocation` (`frontend/src/hooks/use-geolocation.ts`), `useScrollProgress`, `useInView`, `useActiveSection` (`frontend/src/hooks/use-scroll.ts`)
- Private helpers are module-local `function` declarations: `emptyLanes()`, `buildLanes()` in `frontend/src/components/interactive.tsx`

**Variables:**
- `camelCase`; destructure with default-safe fallbacks: `const incident = data?.incident;`, `const s = h.antivenomStock[0] as {...} | undefined;` (`frontend/src/lib/eventbus.ts`)
- Constants `UPPER_SNAKE`: `RADIUS_EARTH_KM` (`frontend/src/lib/nagraksha.ts`), `API_PORT` (`frontend/src/lib/api.ts`), `LANE_META` (`frontend/src/components/interactive.tsx`)
- Ignored parameters prefixed `_` (enforced by eslint): `argsIgnorePattern: '^_'` in `frontend/eslint.config.mjs`

**Types:**
- `PascalCase`; exported union/alias types and interfaces: `StockStatus`, `RankedHospital` (`frontend/src/lib/nagraksha.ts`), `GeoLocation` (`frontend/src/hooks/use-geolocation.ts`)
- `as const` literal typing for tone maps: `tone: 'red' as const` (`frontend/src/lib/nagraksha.ts`), `LANE_META ... as const`
- `type` used for unions/aliases, `interface` for object shapes with fields

### Backend (Python)

**Files:**
- `snake_case` modules: `frontend`-independent `backend/app/eventbus.py`, `backend/app/database.py`, `backend/app/routes/hospitals.py`
- Tests `test_*.py`: `backend/tests/test_domain.py`, `backend/tests/test_routes.py`

**Functions:**
- `snake_case`: `haversine_km`, `rank_hospitals`, `stock_freshness` (`backend/app/domain.py`)
- Module-private helpers prefixed `_`: `_load_incident`, `_emit`, `_set_state` (`backend/app/eventbus.py`, `backend/app/routes/incidents.py`)
- Route handlers named by action, one per endpoint: `trigger_sos`, `list_hospitals`, `update_stock`, `ask`, `stream_incident`

**Variables/Types:**
- `snake_case` locals; Pydantic request models `PascalCase`: `SosRequest`, `StockUpdate`, `MythRequest`, `SnakeIdRequest` (`backend/app/models.py`)
- Type hints used on public signatures and internals (`str | None` syntax — requires Python 3.10+, per `from __future__ import annotations` at top of every module)

## Code Style

**Formatting:**
- Prettier 3 (`package.json` devDependencies), config in `.prettierrc`: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 100`, `arrowParens: "always"`, `endOfLine: "lf"`
- Ignore list in `.prettierignore`: `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`, `.gitignore`, `.env*`, `*.log`, `backend/db/*.db`, `.planning`, `docs`, `model`
- Root scripts: `format:write` / `format:check` (`package.json`)

**Linting:**
- ESLint 9 flat config in `frontend/eslint.config.mjs`: `eslint-config-next` (`core-web-vitals` + `typescript`), `eslint-plugin-security` recommended, plus `typescript-eslint` plugin
- Custom rules (all `error`): `prefer-const`, `no-unused-vars`/`@typescript-eslint/no-unused-vars` with `^_` ignore patterns, `no-console`, `no-debugger`, `no-empty`, `no-irregular-whitespace`, `no-case-declarations`, `no-fallthrough`, `no-mixed-spaces-and-tabs`, `no-redeclare`, `no-undef`, `no-unreachable`, `no-useless-escape`
- Lint ignores: `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`, `examples`, `skills`, `**/src/components/ui/**` (shadcn-generated), `*.test.ts`, `*.test.tsx`, `src/test/**`
- `no-console` is error — intentional `console.log` requires an eslint-disable comment (see `frontend/scripts/seed.ts:17`)
- Python: Bandit security scanner configured in `.bandit.yaml` (skips B101, B110, B311; medium severity/confidence; excludes `.git`, `node_modules`, `.next`, `.planning`, `docs`, `model`, `frontend`); intentional dynamic SQL marked `# nosec B608` (`backend/app/seed.py:30`)

**CI enforcement:**
- `.github/workflows/ci.yml` frontend job: `npx eslint . --max-warnings 0`, `npx tsc --noEmit`, `npx vitest run`
- backend job: `bandit -r . -c ../.bandit.yaml`, `python -m pytest tests/ -v`
- Pre-commit hook `.husky/pre-commit` runs `npx lint-staged`; lint-staged config in root `package.json` runs `prettier --write` + `eslint --fix --max-warnings 0 --no-warn-ignored --config frontend/eslint.config.mjs` on `*.{ts,tsx,js,jsx,mjs}` and `prettier --write` on `*.{json,css,md}`

## Import Organization

**Frontend:**
1. React / framework imports first (`react`, `next`)
2. Third-party packages (alphabetical-ish): `lucide-react`, `sonner`, `class-variance-authority`
3. Local modules via `@/` alias: `@/components/ui/button`, `@/lib/utils`, `@/hooks/use-scroll`
4. Relative imports for same-directory files: `./voice-input` (`frontend/src/components/interactive.tsx:14`)
5. Type-only imports use `type` keyword: `import { clsx, type ClassValue } from 'clsx'` (`frontend/src/lib/utils.ts:1`), `type ComponentType, type CSSProperties` (`frontend/src/components/interactive.tsx:8-9`)

**Path Aliases:**
- `@/*` → `./src/*` (declared in `frontend/tsconfig.json` `paths` and mirrored in `frontend/vitest.config.ts` `resolve.alias`)
- Backend uses relative package imports: `from .. import database as db`, `from ..models import SosRequest`, `from .domain import simulate_dispatch`

**Backend import order:**
1. stdlib (`json`, `os`, `time`, `threading`)
2. third-party (`fastapi`, `httpx`, `pydantic`, `sklearn`, `numpy`)
3. app-local (`from .. import database as db`, `from . import database as db`)
4. Lazy imports inside functions when heavy or circular: `from llama_cpp import Llama` (`backend/app/llm.py:53`), `from .domain import rank_hospitals` (`backend/app/eventbus.py:204`)

## Error Handling

**Frontend:**
- `try/catch` around async flows; `catch (e: unknown)` then narrow with `e instanceof Error`: `frontend/src/components/interactive.tsx:274-276` (`toast.error(e instanceof Error ? e.message : 'Failed to dispatch')`)
- `fetch` + explicit `if (!res.ok) throw new Error('SOS failed')` (`frontend/src/components/interactive.tsx:236`)
- Silent `.catch(() => {})` for fire-and-forget best-effort calls (`frontend/src/components/architecture.tsx:62`, `frontend/src/components/interactive.tsx:990`)
- `.catch(() => toast.error('Could not load …'))` for user-facing load failures (`frontend/src/components/interactive.tsx:550, 1101, 1229, 1361`)
- Best-effort audit wrapped in `try { ... } catch { /* audit is best-effort; never fail the main flow */ }` (`frontend/src/lib/eventbus.ts:75-88`)
- Outbox worker double-guards ticks with nested try/catch so a failure never crashes the process (`frontend/src/lib/eventbus.ts:207-255`)

**Backend:**
- Best-effort operations swallow exceptions with `except Exception: pass` and a comment (`backend/app/eventbus.py:42-43, 64-65, 162-163`)
- DB transactions handled by `db.get_conn()` contextmanager which commits on success, rolls back on exception, always closes (`backend/app/database.py:170-182`)
- Validation via Pydantic models (e.g. `MythRequest.question: Field(..., min_length=1)`) rather than manual checks (`backend/app/models.py`)
- "Not found" handled by returning an error key in the response body, not HTTP errors: `return {"error": "Hospital not found"}` (`backend/app/routes/hospitals.py:24`), `return {"error": "Not found"}` (`backend/app/routes/incidents.py:68`)
- Parse failures return safe defaults: `mins_ago` returns 0 for invalid ISO (`backend/app/domain.py:32-33`)

## Logging

**Framework:** `sonner` toasts on the frontend (`import { toast } from 'sonner'` in `frontend/src/components/interactive.tsx:11`, `frontend/src/components/ui/sonner.tsx`, mounted in `frontend/src/app/layout.tsx:105`). Backend uses `print` in seed scripts only (`backend/app/seed.py`); runtime logging is implicit (uvicorn).

**Patterns:**
- User-facing success/failure through `toast.success(...)` / `toast.error(...)` (e.g. `frontend/src/components/interactive.tsx:239, 550`)
- `console.log`/`console.error` only in scripts with an eslint-disable comment (`frontend/scripts/seed.ts:17, 92, 154, 161`); app code has `no-console: 'error'`
- Audit trail as the app's logging record: `audit(incident_id=..., actor=..., action=..., entity=..., metadata=...)` in `backend/app/eventbus.py:55-65` and `frontend/src/lib/eventbus.ts:68-88`

## Comments

**When to Comment:**
- Explain "why" / design rationale, referencing the System Design doc or SRS FR numbers: "// NagRaksha in-process event bus + outbox worker + audit logger." (`frontend/src/lib/eventbus.ts:1-12`), "// NagRaksha ranking (per SRS FR-4.2)" (`frontend/src/lib/nagraksha.ts:69-73`), """"Myth-buster RAG route — FR-5.1, 5.2, 5.3.""" (`backend/app/routes/myth_buster.py:1`)
- Section banner comments using `// ----` and `# ──` separators: `# ── helpers ───────────────────────` (`backend/app/llm.py:27`), `/* ============= LIVE SOS DEMO */` (`frontend/src/components/interactive.tsx:45`)
- Inline disclaimers for lint-suppressed lines: `// eslint-disable-next-line security/detect-object-injection` (`frontend/src/lib/eventbus.ts:127`, `frontend/src/components/interactive.tsx:106`)

**JSDoc/TSDoc:**
- Frontend uses JSDoc on exported functions and types: `/** Rough road-distance factor for India (roads rarely straight). */` (`frontend/src/lib/nagraksha.ts:18`), extended multi-line docs for hooks with usage warnings (`frontend/src/hooks/use-scroll.ts:52-58`)
- Backend uses module docstrings for every file and one-line `"""docstrings"""` on public functions (`backend/app/domain.py:1, 48`, `backend/app/rag.py:53`)

## Function Design

**Size:** Free-form; single-purpose functions. Largest app files are component-heavy: `frontend/src/components/interactive.tsx` (1777 lines) and `frontend/src/components/sections.tsx` (826 lines) co-locate many small components/panels; lib modules stay small and focused (`frontend/src/lib/api.ts` is 13 lines).

**Parameters:**
- Frontend pure helpers take primitives or small inline object types: `rankHospitals(origin: { lat: number; lng: number }, hospitals: Array<{...}>)` (`frontend/src/lib/nagraksha.ts:74-91`)
- Backend: keyword defaults and optional `None`: `def audit(incident_id=None, actor="system", action="", entity=None, metadata=None):` (`backend/app/eventbus.py:55`)

**Return Values:**
- Frontend pure functions return plain objects with `as const` tone fields (`stockFreshness`, `frontend/src/lib/nagraksha.ts:34-45`); nullish-coalesced fallbacks at call sites (`s?.status ?? 'UNKNOWN'`, `frontend/src/lib/eventbus.ts:279`)
- Backend routes return plain dicts; JSON keys are `camelCase` even though Python identifiers are `snake_case` (`"hospitalId"`, `"distanceKm"`, `"etaMin"` — `backend/app/routes/hospitals.py:34-37`)

## Module Design

**Exports:**
- Frontend: named `export function` / `export const` / `export interface` / `export type`; no default exports except Next.js pages (`frontend/src/app/page.tsx:24`) and root layout (`frontend/src/app/layout.tsx:89`)
- Backend: every route module exposes a `router = APIRouter()` named export; helpers stay module-private (`backend/app/routes/sos.py:12, 49`)

**Barrel Files:**
- `frontend/src/components/sections.tsx` and `frontend/src/components/interactive.tsx` act as barrels — imported as multi-symbol: `import { TopAppBar, NavigationDrawer, SiteFooter } from '@/components/sections'` (`frontend/src/app/page.tsx:5-17`)
- UI primitives live one-per-file under `frontend/src/components/ui/` with named exports (`{ Button, buttonVariants }` from `frontend/src/components/ui/button.tsx`) — shadcn/ui generated, lint-ignored

## Frontend-Specific Conventions

- Client components start with `'use client';` (`frontend/src/app/page.tsx:1`, `frontend/src/components/interactive.tsx:1`, `frontend/src/hooks/use-geolocation.ts:1`)
- State typed as explicit union literals: `'sos' | 'responder' | 'hospital' | 'myth' | 'snake_id' | 'guide' | 'admin'` (`frontend/src/app/page.tsx:26-28`)
- `useCallback` for handlers, `useEffect` with cleanup for subscriptions/observers, `useRef` for stable values (`frontend/src/components/interactive.tsx:217, 246-270`, `frontend/src/hooks/use-scroll.ts`)
- Tailwind utility classes inline; hex color literals like `bg-[#2BB673]` used directly alongside `bg-background` tokens (`frontend/src/app/page.tsx:38`)
- Class merging via `cn()` from `frontend/src/lib/utils.ts`
- Prisma singleton pattern in `frontend/src/lib/db.ts` (globalThis cache, non-production reuse)
- API access through `apiUrl()` helper appending `?XTransformPort=8000`, never absolute localhost URLs (`frontend/src/lib/api.ts`)

## Backend-Specific Conventions

- Every module starts with `from __future__ import annotations` and a module docstring
- Raw SQL with `?` parameter placeholders only — never string interpolation for values (`backend/app/database.py`, all routes)
- Database access only through `db.get_conn()` contextmanager; IDs via `db.new_id()` (uuid hex[:24]), timestamps via `db.now_iso()` (UTC ISO with `Z`) (`backend/app/database.py:185-193`)
- Router modules registered centrally in `backend/app/main.py:49-58` with `app.include_router(x.router)`
- JSON responses built from `dict(row)` after `conn.row_factory = sqlite3.Row` (`backend/app/routes/ops.py`, `backend/app/routes/incidents.py`)

---

*Convention analysis: 2026-08-11*
