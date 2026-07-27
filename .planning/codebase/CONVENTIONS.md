# Coding Conventions & Code Quality Gates

**Analysis Date:** 2026-07-27

## Quality Gates & Git Hooks

The repository enforces clean code standards via **Husky** pre-commit hooks and **lint-staged**.

### Pre-Commit Pipeline (`.husky/pre-commit`)
1. **Formatting:** Runs `prettier --write` across modified `.json`, `.css`, and `.md` files.
2. **Linting & Fixing:** Runs `eslint --fix --max-warnings 0` via `frontend/eslint.config.mjs` on modified `.ts` and `.tsx` files.
3. **Type Safety & React Hooks:** Prevents state-in-effect anti-patterns (`react-hooks/set-state-in-effect`), unused variables (unless prefixed with `_`), and missing dependencies.

## Cross-Platform Terminal Compatibility (Windows UTF-8 / CP1252)

When printing status messages in root Python scripts (`setup.py`, `start.py`), **always use safe ASCII status indicators** to prevent `UnicodeEncodeError` crashes on Windows command line environments:

- **Correct:** `[OK]`, `[!]`, `[i]`, `[ERROR]`, `[WARN]`
- **Incorrect:** `✓`, `✖`, `🐍`, `⚡`

## Design System & Styling Conventions

### Color Tokens & Glassmorphism
- **Background:** `#051710` (Dark Midnight) with WebGL organic snake scale canvas.
- **Surface Panels:** `bg-[rgba(8,20,15,0.65)] backdrop-blur-md border border-[rgba(234,243,237,0.1)]`.
- **Primary Action / Success:** `#2BB673` (Forest Green).
- **Accents & Metrics:** `#D69E2E` (Antivenom Gold) and `#7fd6ad` (Mint).
- **Emergency SOS Actions:** `#FF4D4D` / `#B42318` (Pulsing Urgent Red).

### Typography & Icons
- **Headlines / Display:** `Lexend` font via Google Fonts CSS import.
- **Body & Data:** `Inter` font via Next.js `next/font/google`.
- **Iconography:** `Material Symbols Outlined` (Google Fonts) and `Lucide React` icons.

## TypeScript & React Conventions

1. **Unused Arguments & Variables:** Unused function parameters or imports must be prefixed with `_` (e.g., `_role: string`) to satisfy ESLint rule `/^_/u`.
2. **React Hooks:** Async data fetching inside `useEffect` must handle cleanup flags (`let isMounted = true;`) and avoid direct synchronous `setState()` calls that trigger cascading renders.
3. **Relative `/api` Client Calls:** All client components fetch API endpoints relative to the root (`fetch(apiUrl('/api/...'))`), relying on the Next.js `rewrites()` proxy configuration.

---

*Updated: 2026-07-27*
