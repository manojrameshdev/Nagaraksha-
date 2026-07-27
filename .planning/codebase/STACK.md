# Technology Stack

**Analysis Date:** 2026-07-27

## Languages

**Primary:**
- **TypeScript 5.x** — Frontend (Next.js, React, Tailwind CSS), all source code under `frontend/src/`
- **Python 3.12/3.13** — Backend (FastAPI, scikit-learn, llama-cpp-python, SQLite), all source under `backend/app/`

**Secondary:**
- **JavaScript (ES2022+)** — Service worker (`frontend/public/sw.js`), seed script helpers (`frontend/scripts/gen-icons.cjs`)
- **GLSL / WebGL Fragment Shaders** — Organic slithering snake background animation (`frontend/src/components/shader-background.tsx`)

## Runtime & Setup Scripts

**Environment:**

| Layer | Runtime | Version | Notes |
|-------|---------|---------|-------|
| Frontend | Node.js | ^20 / ^22 | Next.js App Router dev server on port 3000 |
| Backend | CPython | 3.12 / 3.13 | Uvicorn ASGI server on port 8000 |
| Installer | Python Script | 3.10+ | Root `setup.py` (5-step automated environment configuration) |
| Launcher | Python Script | 3.10+ | Root `start.py` (orchestrates processes, health checks & status) |

**Package Managers:**
- **Frontend:** npm (`frontend/package.json`, `package-lock.json`)
- **Backend:** pip (`backend/requirements.txt`)

## Frameworks and Libraries

### Core System Stack

| Framework | Version | Layer | Purpose |
|-----------|---------|-------|---------|
| Next.js | 16.1.1 | Frontend | React framework (App Router, relative `/api` rewrite proxy) |
| React | 19.0.0 | Frontend | Client UI components & hooks |
| FastAPI | 0.128.0 | Backend | Python ASGI web framework with Pydantic validation & lifespan handlers |
| uvicorn | 0.44.0 | Backend | ASGI server running FastAPI app |
| SQLite | 3.x | Backend DB | File-backed durable database with WAL mode (`backend/db/nagraksha.db`) |

### UI / Styling & Aesthetics (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | 4.x | Utility-first CSS framework |
| @tailwindcss/postcss | 4.x | PostCSS plugin for Tailwind v4 |
| tailwindcss-animate | 1.0.7 | Tailwind plugin for custom keyframe animations |
| tailwind-merge | 3.3.1 | Utility for merging conflicting Tailwind classes |
| clsx | 2.1.1 | Utility for conditional class name construction |
| lucide-react | 0.525.0 | Iconography system |
| sonner | 2.0.6 | Toast notification system |
| Google Fonts | API | `Lexend` typography & `Material Symbols Outlined` icons |
| WebGL2 | Web API | Organic scale fragment shader background canvas |

### Backend / AI / ML / RAG

| Package | Version | Purpose |
|---------|---------|---------|
| scikit-learn | 1.5.2 | TF-IDF vectorizer + cosine similarity for medical RAG search |
| numpy | >=1.26 | Matrix math operations |
| pydantic | >=2.0 | Request/response validation schemas |
| llama-cpp-python | >=0.3 | Local GGUF model CPU inference (optional fallback) |
| httpx | >=0.27 | Async HTTP client |
| python-dotenv | >=1.0 | `.env` variable loader |

### Testing & Code Quality

| Tool | Layer | Purpose |
|------|-------|---------|
| Vitest | Frontend | Unit testing runner (`vitest run`, 16 tests passing) |
| Pytest | Backend | Unit & integration test framework (`pytest backend/tests`, 33 tests passing) |
| TypeScript | Frontend | Static type checker (`npx tsc --noEmit`) |
| ESLint | Frontend | Flat config linting (`frontend/eslint.config.mjs`) |
| Prettier | Root | Code formatting (`.prettierrc`) |
| Husky | Root | Git pre-commit hooks (`.husky/pre-commit` running lint-staged) |

## Configuration

### Environment Setup (`.env` / `setup.py`)

Run `python setup.py` to automate creation of `.env` from `.env.example`:

```ini
DATABASE_URL=sqlite:///backend/db/nagraksha.db
LOG_LEVEL=INFO
# Optional LLM keys
GROK_API_KEY=
GEMINI_API_KEY=
LOCAL_GGUF_PATH=model/nagraksha-q4.gguf
```

### Build & Dev Commands

| Command | Purpose |
|---------|---------|
| `python setup.py` | Automated 5-step project setup & DB seed |
| `python start.py` | Launches FastAPI (8000) & Next.js (3000) with live health checks |
| `python start.py --status` | Checks running backend & frontend status |
| `python start.py --stop` | Terminates active background processes |
| `cd frontend && npm test` | Runs 16 frontend Vitest unit tests |
| `pytest backend/tests` | Runs 33 backend Pytest unit tests |
| `cd frontend && npx tsc --noEmit` | Runs TypeScript static type checking |

---

*Updated: 2026-07-27*
