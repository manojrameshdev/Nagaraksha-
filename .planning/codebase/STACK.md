# Technology Stack

**Analysis Date:** 2026-07-25

## Languages

**Primary:**
- TypeScript 5.x — Frontend (Next.js, React, Prisma), all source code under `frontend/src/`
- Python 3.12+ — Backend (FastAPI, scikit-learn, llama-cpp-python), all source under `backend/app/`

**Secondary:**
- JavaScript (ES2022+) — Service worker (`frontend/public/sw.js`), seed script helpers (`frontend/scripts/gen-icons.cjs`)

## Runtime

**Environment:**

| Layer | Runtime | Version | Notes |
|-------|---------|---------|-------|
| Frontend | Node.js (via Bun) | ^22? | Bun is used as package manager + runtime in production (`bun .next/standalone/server.js`) |
| Backend | CPython | 3.12+ | Managed via `uvicorn` ASGI server |
| Gateway | Caddy | v2 | Reverse proxy on port 81, routes to frontend (3000) or backend (8000) via `?XTransformPort=` query param |

**Package Managers:**
- Frontend: **Bun** — lockfile: `frontend/bun.lock`
- Backend: **pip** — requirements file: `backend/requirements.txt`
- Root: **npm** (used for workspace scripts like `dev:frontend`, `dev:backend`)

## Frameworks and Libraries

### Critical / Core

| Framework | Version | Layer | Purpose |
|-----------|---------|-------|---------|
| Next.js | 16.1.1 | Frontend | React framework (App Router, RSC, standalone output for production) |
| React | 19.0.0 | Frontend | UI library (client components, hooks) |
| FastAPI | 0.128.0 | Backend | Python ASGI web framework with Pydantic validation |
| Prisma | 6.11.1 | Frontend | TypeScript ORM + schema management (`frontend/prisma/schema.prisma`) |
| @prisma/client | 6.11.1 | Frontend | Generated Prisma client for database access |
| uvicorn | 0.44.0 | Backend | ASGI server for FastAPI |

### UI / Styling (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | 4.x | Utility-first CSS framework |
| @tailwindcss/postcss | 4.x | PostCSS plugin for Tailwind v4 |
| tailwindcss-animate | 1.0.7 | Tailwind plugin for animate utilities |
| tailwind-merge | 3.3.1 | Merge conflicting Tailwind classes |
| clsx | 2.1.1 | Conditional class names |
| class-variance-authority | 0.7.1 | Component variant system |
| framer-motion | 12.23.2 | Animation library |
| lucide-react | 0.525.0 | Icon library |
| sonner | 2.0.6 | Toast notifications |
| next-themes | 0.4.6 | Dark/light mode (forced `dark` class) |
| cmdk | 1.1.1 | Command menu / palette |

### Radix UI (primitive components)

~27 `@radix-ui/react-*` packages covering: Accordion, AlertDialog, Avatar, Checkbox, Collapsible, ContextMenu, Dialog, DropdownMenu, HoverCard, Label, Menubar, NavigationMenu, Popover, Progress, RadioGroup, ScrollArea, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, ToggleGroup, Tooltip, Slot, AspectRatio.

### Backend / AI / ML

| Package | Version | Purpose |
|---------|---------|---------|
| scikit-learn | 1.5.2 | TF-IDF vectorizer + cosine similarity for RAG retrieval |
| numpy | >=1.26 | Numerical operations |
| pydantic | >=2.0 | Request/response validation models |
| llama-cpp-python | >=0.3 | Local GGUF model inference (CPU-based LLM) |
| httpx | >=0.27 | Async HTTP client for Grok/Gemini API calls |
| python-dotenv | >=1.0 | `.env` loading |

### Dev / Build

| Package | Version | Purpose |
|---------|---------|---------|
| TypeScript | ^5 | Type checking |
| ESLint | ^9 | Linting (flat config) |
| eslint-config-next | 16.1.1 | Next.js ESLint config |
| date-fns | 4.1.0 | Date utilities |
| react-dom | 19.0.0 | React DOM renderer |

## Configuration

### Environment Configuration (`.env.example`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | No (defaults to SQLite) | Database connection string (for Postgres in production) |
| `GROK_API_KEY` | No | xAI API key for Grok LLM fallback |
| `GEMINI_API_KEY` | No | Google AI API key for Gemini LLM fallback |
| `PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE` | No | Postgres connection details (optional) |

### Build Configuration

| File | Purpose |
|------|---------|
| `frontend/next.config.ts` | Next.js config — `output: "standalone"`, `reactStrictMode: false`, TS errors ignored at build |
| `frontend/tsconfig.json` | TypeScript — ES2017 target, bundler module resolution, `@/*` path alias to `./src/*` |
| `frontend/tailwind.config.ts` | Tailwind v4 — `darkMode: "class"`, CSS variables for colors, shadcn/ui theme |
| `frontend/postcss.config.mjs` | PostCSS — `@tailwindcss/postcss` plugin only |
| `eslint.config.mjs` | ESLint flat config — extends Next.js core-web-vitals + TypeScript, most rules disabled |
| `frontend/components.json` | shadcn/ui configuration — New York style, `@/` aliases, lucide icons |
| `backend/requirements.txt` | Python dependencies pinned |
| `start.py` | Root-level dev launcher for both frontend + backend |

## Dependencies by Tier

**Production — Frontend (`frontend/package.json`):**
- 56 dependencies (50 regular + 6 dev)
- 27 Radix UI primitives
- 4 MB+ install footprint (Next.js standalone output is ~80MB)

**Production — Backend (`backend/requirements.txt`):**
- 8 dependencies total (lean stack)
- Key: `fastapi`, `uvicorn`, `scikit-learn`, `llama-cpp-python`, `httpx`, `pydantic`, `numpy`, `python-dotenv`

## Build and Deploy

**Build Commands:**

| Command | Layer | Action |
|---------|-------|--------|
| `npm run dev:backend` | Backend | Start uvicorn on port 8000 |
| `npm run dev:frontend` | Frontend | Start Next.js dev server on port 3000 |
| `npm run dev` | Both | Run `scripts/dev.sh` (both services) |
| `cd frontend && npm run build` | Frontend | `next build` + copy static assets to `.next/standalone/` |
| `npm run db:push` | DB | `prisma db push --accept-data-loss` |
| `npm run db:generate` | DB | `prisma generate` |
| `npm run backend:seed` | DB | Seed backend demo data |
| `python start.py` | Both | Dev launcher for both services |
| `python start.py --stop` | Both | Kill running dev processes |

**Production Deploy:**
- Frontend: Next.js standalone output (`.next/standalone/`) served with `bun server.js`
- Backend: uvicorn bound to `0.0.0.0:8000` via `backend/run.sh`
- Gateway: Caddy reverse proxy on port 81, routing via `?XTransformPort=` query parameter
- Default route (`:81`) → localhost:3000 (Next.js)
- Route with `?XTransformPort=8000` → localhost:8000 (FastAPI backend)

**CORS Configuration** (`backend/app/main.py`):
- Allow origins: `http://localhost:3000`, `http://127.0.0.1:3000`
- All methods and headers permitted

**ESLint Config** (`eslint.config.mjs`):
- Flat config using `eslint-config-next` core-web-vitals + TypeScript presets
- 30+ rules explicitly disabled (no-explicit-any, no-unused-vars, no-console, react-hooks/exhaustive-deps, prefer-const etc.)
- Ignores: `node_modules`, `.next`, `out`, `build`, `next-env.d.ts`, `examples`, `skills`

---

*Stack analysis: 2026-07-25*
