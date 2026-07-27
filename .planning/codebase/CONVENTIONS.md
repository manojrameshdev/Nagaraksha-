# CONVENTIONS.md — Code Conventions

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## Frontend Conventions (TypeScript / React)

### Component Patterns

- **Client components** marked `'use client'` at top of file — all interactive components are client-side
- **React.memo** for stable layout components: `ShaderBackground`, `TopAppBar`, `NavigationDrawer`, `SiteFooter`
- **useCallback** for all event handlers and async fetchers that are passed as props or used in dependency arrays
- **Dependencies must be exhaustive**: lint enforces `react-hooks/exhaustive-deps` — all deps must be listed
- **Prop-driven data**: components accept `lat/lng/address/locationSource` props rather than internal hardcodes

### State Management

- Local `useState` per component; no global state store
- `useRef` for mutable values that shouldn't trigger re-renders (SSE ref, animation RAF, geolocation resolved flag)
- Data fetching gated on `useInView` — components only fetch when scrolled into viewport

### API Calls

- **Always use `apiUrl(path)`** from `src/lib/api.ts` — never hardcode `localhost:8000`
- Pattern: `fetch(apiUrl('/api/sos'), { method: 'POST', headers: {...}, body: JSON.stringify({...}) })`
- Error handling: wrap in `try/catch`, call `toast.error(...)`, set loading to false in `finally`

### Styling

- Tailwind CSS v4 utility classes only
- Inline `style={{ color: tone }}` for dynamic colors (can't use arbitrary Tailwind at runtime)
- Color palette: `#051710` bg, `#2BB673` primary, `#E5484D` alert, `#D69E2E` warning, `#8FA39B` muted
- `cn()` from `src/lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- `sos-pulse` class for SOS button pulsing animation (defined in globals.css)

### Naming

- Components: PascalCase
- Hooks: `use-kebab-case.ts` (file), `useCamelCase` (export)
- Types: PascalCase with descriptive suffix (`SosResponse`, `DispatchAttempt`, `LaneState`)
- Constants: `SCREAMING_SNAKE_CASE` (`LANE_META`, `DEFAULT`)

### Lint Rules

- `eslint-plugin-security` active — object injection warnings on dynamic property access (suppressed with `// eslint-disable-next-line security/detect-object-injection`)
- `react-hooks/set-state-in-effect` — setState in `useEffect` must be deferred via `setTimeout(..., 0)` or moved to callbacks
- `react-hooks/exhaustive-deps` — all deps declared; no suppressions

---

## Backend Conventions (Python / FastAPI)

### Module Structure

- Each route domain gets its own file in `routes/`: `sos.py`, `hospitals.py`, `risk.py`, etc.
- Domain logic (pure functions) lives in `domain.py` — no DB access
- DB access only through `database.get_conn()` context manager
- All functions use `from __future__ import annotations` for PEP 604 union types

### Database Access

```python
with db.get_conn() as conn:
    result = conn.execute("SELECT ...", (param,)).fetchone()
```

- Always parameterised queries — never f-string SQL with user input
- `conn` is a `sqlite3.Row` factory connection (supports column-name access)
- IDs: `db.new_id()` → 24-char hex UUID
- Timestamps: `db.now_iso()` → ISO 8601 UTC string

### Error Handling

- Route handlers return dicts with `{"error": "..."}` on logical failures (not HTTP exceptions)
- Audit calls wrapped in bare `try/except` — audit is best-effort, must not crash routes
- Worker and event bus callbacks catch all exceptions silently to prevent cascading failures

### Bandit Security

- `.bandit.yaml` configured at project root
- `# nosec B311` on any `random.choice()` calls (where randomness is intentional, non-crypto)
- `# nosec B608` on hardcoded table-name SQL (provably safe, table names from Python tuple literals)

### Naming

- Route functions: snake_case verbs (`trigger_sos`, `identify`, `get_risk`)
- Private helpers: leading underscore (`_load_incident`, `_identify_via_grok_vision`)
- Constants: `SCREAMING_SNAKE_CASE` (`CATALOGUE`, `DISCLAIMER`, `ADVISORIES`)
- Pydantic models: PascalCase (`SosRequest`, `StockUpdate`)

---

## Git / CI Conventions

- **Commit format**: `type: short description\n\n- bullet detail` (conventional commits lite)
- **Pre-commit**: Prettier (format) + ESLint --fix run via lint-staged
- **Commit triggers**: After every CI pass, phase completion, or debug session resolution
- **CI gates**: Both `frontend` and `backend` jobs must pass; `gatekeeper` job blocks merge if either fails
- **No direct main commits**: All changes via PRs (enforced by branch protection)
