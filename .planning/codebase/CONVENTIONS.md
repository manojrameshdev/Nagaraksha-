# Coding Conventions

**Analysis Date:** 2026-07-25

## Languages and Runtimes

| Layer | Language | Runtime | Package Manager |
|-------|----------|---------|-----------------|
| Frontend | TypeScript 5.x | Next.js 16.1.1 (Node) | bun (lock: `bun.lock`) |
| Backend | Python 3.x | FastAPI 0.128.0 / uvicorn 0.44.0 | pip (`requirements.txt`) |
| Database | SQLite | via Prisma (TS) or raw sqlite3 (Python) | — |
| Styling | CSS (Tailwind 4) | PostCSS | — |

## Code Style

### TypeScript / TSX

**Formatting:**
- No Prettier config detected. Files use a mix of semicolon and no-semicolon styles:
  - `src/lib/` files use **no semicolons** (modern style)
  - `src/components/` files use **semicolons** occasionally (shadcn/ui generated code uses semicolons)
- Single quotes preferred in `components/`, double quotes used in some `lib/` files
- 2-space indentation

**Linting (eslint.config.mjs at root):**
- **ALL rules are disabled.** Every single rule in the config is set to `"off"`, including:
  - `@typescript-eslint/no-explicit-any`: off
  - `@typescript-eslint/no-unused-vars`: off
  - `react-hooks/exhaustive-deps`: off
  - `@next/next/no-img-element`: off
  - `no-console`: off, `no-debugger`: off
  - All general JS rules (no-undef, no-unreachable, no-empty, etc.) are off
- Config uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` presets but overrides every rule
- **Practical effect:** Linting runs but never reports errors. No quality gates on code style.

**TypeScript Config (`frontend/tsconfig.json`):**
- `strict: true` but `noImplicitAny: false` — allows implicit `any`
- `skipLibCheck: true` — skips type checking of node_modules
- `ignoreBuildErrors: true` in `next.config.ts` — **build succeeds regardless of type errors**
- **Practical effect:** TypeScript is used for editor intellisense but does not block compilation

### Python

**Formatting:**
- No formatter config detected (no `.flake8`, `pyproject.toml` with black/isort, or `.pylintrc`)
- 4-space indentation
- `from __future__ import annotations` at the top of every file (required for PEP 604 syntax)
- Imports grouped: stdlib → third-party → internal, separated by blank lines

**Type Hints:**
- Used inconsistently. Example from `backend/app/domain.py`:
  ```python
  def haversine_km(lat1, lng1, lat2, lng2):  # no type hints
  ```
  Vs. `backend/app/database.py`:
  ```python
  def now_iso() -> str:  # has return hint
  def new_id() -> str:   # has return hint
  ```
- Pydantic `BaseModel` classes use typed fields
- Generally: function **return types** are sometimes annotated; **parameter types** are rarely annotated

**Docstrings:**
- Module-level triple-double-quote docstrings at the top of every `.py` file
- Function-level docstrings are sparse — mostly omitted for simple functions
- Example pattern (`backend/app/database.py`):
  ```python
  """SQLite database layer for NagRaksha (Python backend)."""
  ```

## Naming Conventions

### TypeScript / TSX

| Element | Convention | Examples |
|---------|-----------|---------|
| Files | `kebab-case.ts` or `PascalCase.tsx` | `lazy-sections.tsx`, `tri-line-dock.tsx`, `utils.ts` |
| React Components | `PascalCase` | `Hero`, `Problem`, `Reveal`, `LazyLiveSosDemo` |
| Functions | `camelCase` | `apiUrl()`, `haversineKm()`, `rankHospitals()` |
| Variables | `camelCase` | `incId`, `token`, `ranked` |
| Constants (module-level) | `UPPER_CASE` | `API_PORT`, `RADIUS_EARTH_KM`, `INCIDENT_STATES` |
| Types/Interfaces | `PascalCase` | `BusEventMap`, `RankedHospital`, `SosResponse` |
| Type aliases | `PascalCase` | `ResponderCategory`, `StockStatus` |
| Exports | Named exports (preferred) | `export function Hero()` not `export default Hero` |
| CSS classes | Utility-based (Tailwind) | Inline classes, `cn()` helper for merging |

**File naming rule:** View components (pages) use `PascalCase.tsx`. Library/utility files use `kebab-case.ts`. Component files use `kebab-case.tsx` (e.g., `snake-progress.tsx`).

### Python

| Element | Convention | Examples |
|---------|-----------|---------|
| Files | `snake_case.py` | `eventbus.py`, `myth_buster.py`, `knowledge_base_data.py` |
| Functions | `snake_case` | `init_db()`, `get_conn()`, `rank_hospitals()`, `simulate_dispatch()` |
| Variables | `snake_case` | `inc_id`, `now`, `scored` |
| Constants | `UPPER_CASE` | `SCHEMA`, `DB_DIR`, `DB_PATH`, `ADVISORIES` |
| Classes | `PascalCase` | `SosRequest`, `StockUpdate`, `MythRequest`, `SnakeIdRequest` (all Pydantic models) |
| Modules | `snake_case` | `database`, `domain`, `eventbus`, `llm` |
| Private helpers | `_prefixed` | `_load_chunks()`, `_build_index()`, `_handle_incident_created()` |
| Routes | `snake_case` | `trigger_sos()`, `identify()`, `get_risk()` |

### CSS / Tailwind

- Inline Tailwind utility classes throughout JSX
- Custom CSS classes use `kebab-case` (e.g., `.glass`, `.tnum`, `.sos-pulse`) in `globals.css`
- CSS custom properties (variables) use `--kebab-case` (e.g., `--font-inter`, `--background`)
- The `cn()` utility (`src/lib/utils.ts`) from `clsx` + `tailwind-merge` is used to combine conditional classes
- shadcn/ui components define variants via `class-variance-authority` (`cva()`)

### Database (SQLite)

- Table names: `PascalCase` singular (e.g., `Incident`, `DispatchAttempt`, `AntivenomStock`, `OutboxEvent`)
- Columns: `camelCase` (e.g., `incidentId`, `quantityBand`, `verifiedAt`)
- Primary keys: `id TEXT PRIMARY KEY`
- Foreign keys: referenced table name in `camelCase` (e.g., `hospitalId`, `incidentId`)

## File Organization

```
nagraksha/
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── page.tsx        # Main landing page (server component)
│   │   │   └── layout.tsx      # Root layout + metadata/SEO
│   │   ├── components/         # React components
│   │   │   ├── ui/             # shadcn/ui primitives (60+ components)
│   │   │   ├── sections.tsx    # Page sections (Hero, Problem, etc.)
│   │   │   ├── lazy-sections.tsx # Code-split dynamic imports
│   │   │   ├── interactive.tsx # Interactive demo components (1226 lines)
│   │   │   ├── reveal.tsx      # Scroll-reveal animation wrapper
│   │   │   └── ...             # Other components
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── use-toast.ts    # Toast state management (194 lines)
│   │   │   ├── use-scroll.ts   # Scroll progress, in-view, active section
│   │   │   └── use-mobile.ts   # Mobile breakpoint detection
│   │   └── lib/                # Utilities and business logic
│   │       ├── api.ts          # API URL helper (XTransformPort)
│   │       ├── db.ts           # Prisma client singleton
│   │       ├── eventbus.ts     # Event bus + outbox worker (285 lines)
│   │       ├── nagraksha.ts    # Domain logic (geo, ranking, dispatch)
│   │       ├── knowledge-base.ts # Curated KB data (203 lines)
│   │       └── utils.ts        # cn() helper
│   ├── prisma/                 # Prisma schema + migrations
│   ├── public/                 # Static assets, icons, manifest
│   ├── next.config.ts          # Next.js config (ignoreBuildErrors: true)
│   ├── tsconfig.json           # TypeScript config (noImplicitAny: false)
│   └── tailwind.config.ts      # Tailwind theme config
├── backend/
│   └── app/
│       ├── main.py             # FastAPI entry point
│       ├── database.py         # SQLite layer (raw sqlite3)
│       ├── domain.py           # Domain logic (geo, ranking)
│       ├── eventbus.py         # In-process event bus + outbox worker
│       ├── models.py           # Pydantic request models
│       ├── llm.py              # LLM module (local GGUF + cloud fallback)
│       ├── rag.py              # RAG pipeline (TF-IDF + LLM)
│       ├── knowledge_base_data.py # KB seed data (large)
│       ├── seed.py             # Demo data seeder
│       └── routes/             # API route modules
│           ├── sos.py          # POST /api/sos
│           ├── incidents.py    # Incident list + detail
│           ├── hospitals.py    # Hospital list + stock update
│           ├── risk.py         # Weather risk advisory
│           ├── snake_id.py     # Snake photo ID
│           ├── myth_buster.py  # AI myth buster
│           ├── stats.py        # Platform stats
│           ├── architecture.py # System architecture info
│           └── ops.py          # OPS endpoints (seed, health)
├── db/                         # SQLite database files (gitignored)
├── model/                      # Local GGUF model files (gitignored)
├── eslint.config.mjs           # Root ESLint config (all rules off)
├── package.json                # Workspace-level scripts
└── start.py                    # Dev launcher (both processes)
```

**Where to add new code:**
- **New API endpoint:** Create route file in `backend/app/routes/`, add Pydantic model in `backend/app/models.py` if needed, register router in `backend/app/main.py`
- **New frontend page:** Add directory in `frontend/src/app/`
- **New component:** Create file in `frontend/src/components/` (or `ui/` for primitives)
- **New hook:** Create file in `frontend/src/hooks/`
- **New utility/lib:** Create file in `frontend/src/lib/`
- **New backend helper module:** Create file in `backend/app/`

## Error Handling Patterns

### TypeScript

**Silent try/catch (most common pattern):**
```typescript
try {
  await db.auditEvent.create({ ... });
} catch {
  /* audit is best-effort; never fail the main flow */
}
```

**Promise rejection swallowing:**
```typescript
const safe = (fn: (...args: any[]) => Promise<void>) => (...args: any[]) => {
  Promise.resolve()
    .then(() => fn(...args))
    .catch(() => {
      /* handler error — outbox is durable, event already marked processed */
    });
};
```

**`.catch(() => {})` pattern:**
```typescript
safeTick().catch(() => {});
await db.outboxEvent.update(...).catch(() => {});
```

**`@ts-expect-error` usage:**
```typescript
// @ts-expect-error dynamic tag
<Tag ref={ref} ...>
```
Found in `src/components/reveal.tsx`.

**Key observations:**
- No structured error handling (no custom error classes, no error boundaries)
- No error logging to external services — all errors silently ignored
- `reactStrictMode: false` in `next.config.ts` disables React strict mode warnings
- The `eventbus.ts` outbox worker has retry logic (4 attempts before marking FAILED) — the only place with real error handling
- Audit failures are always silently ignored (best-effort pattern throughout)

### Python

**Silent exception catching (identical pattern):**
```python
try:
    with db.get_conn() as conn:
        conn.execute(...)
except Exception:
    pass  # audit is best-effort
```

**Transaction rollback on error:**
```python
@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise  # propagates the exception upward
    finally:
        conn.close()
```

**LLM module fallback chain:**
```python
def generate(...):
    # Tries each provider in order, returns None if all fail
    if _find_model():
        out = _generate_gguf(...)
        if out is not None: return out
    if _env("GROK_API_KEY"):
        out = _generate_grok(...)
        if out is not None: return out
    if _env("GEMINI_API_KEY"):
        out = _generate_gemini(...)
        if out is not None: return out
    return None
```

**Callers handle None gracefully:**
```python
if llm:
    return {"answer": llm, ...}
# fallback: return top retrieved chunk verbatim
```

## Async Patterns

### TypeScript

- `async/await` throughout
- `Promise.all()` for parallel fan-out (dispatch lanes)
- `new Promise(r => setTimeout(r, ms))` for `sleep()` helper
- EventEmitter with typed event maps (`BusEventMap`)
- SSE (Server-Sent Events) for real-time state updates
- Worker interval via `setInterval` + `safeTick` wrapper

### Python

- **Synchronous throughout** — no `asyncio` used despite FastAPI supporting it
- `threading.Thread` for the outbox background worker (daemon thread)
- `time.sleep()` for delays (blocking)
- Thread lock (`threading.Lock()`) for shared state (bus subscribers, LLM model, RAG index)
- FastAPI synchronous route handlers (no `async def`) are run in a thread pool

## State Management

**Pattern:** Singleton via global module variable + EventEmitter (Observer pattern)

**Frontend event bus (`src/lib/eventbus.ts`):**
- NagRakshaBus extends Node.js `EventEmitter`
- Single instance stored on `globalThis.__nagrakshaBus`
- Typed event map with 5 event types: `IncidentCreated`, `DispatchAttempted`, `DispatchAccepted`, `IncidentStateChanged`, `IncidentClosed`
- `getBus()` singleton getter also starts the outbox worker

**Python event bus (`backend/app/eventbus.py`):**
- Module-level `_subscribers: dict[str, list]` protected by `threading.Lock()`
- Same event types dispatched via in-process callbacks

**Toast/notification state (`src/hooks/use-toast.ts`):**
- Reducer pattern (action → dispatch → listener notification)
- External `listeners` array (Observer pattern)
- Global `memoryState` variable outside React

**No React state library** — no Redux, Zustand, Jotai, or React Context for global state. Component state uses `useState` + `useEffect`.

## Configuration Management

**Environment variables:**
- `.env` file loaded by `python-dotenv` in `backend/app/main.py`
- Frontend uses `process.env` (Next.js built-in)
- No `.env.example` schema for the actual required vars (`.env.example` exists but was not read per rules)

**Key configuration points:**
- `next.config.ts`: `output: "standalone"`, `typescript.ignoreBuildErrors: true`, `reactStrictMode: false`
- `tsconfig.json`: `strict: true`, `noImplicitAny: false`, `paths: { "@/*": ["./src/*"] }`
- `tailwind.config.ts`: `darkMode: "class"`, shadcn/ui CSS variables theme
- Python `requirements.txt` pins exact versions for `fastapi==0.128.0`, `uvicorn==0.44.0`, `scikit-learn==1.5.2`
- Root `package.json`: workspace-level dev scripts, no testing/CI scripts

## Documentation Style

**TypeScript comments:**
- Module-level JSDoc in `src/lib/api.ts`, `src/lib/eventbus.ts` with multiline comments:
  ```typescript
  /**
   * API helper — the NagRaksha backend is a separate Python FastAPI service...
   */
  ```
- Inline comments use `//` for logic explanation and architectural notes
- No TSDoc on individual functions (no `@param`, `@returns` annotations)
- Some functions have descriptive names that serve as documentation

**Python comments:**
- Module-level docstrings in triple quotes at top of every `.py` file
- Section separator comments with dashes (e.g., `# ── helpers ──`)
- Inline `#` comments for non-obvious logic
- No formal Sphinx/Google/Numpy docstring style

---

*Convention analysis: 2026-07-25*
