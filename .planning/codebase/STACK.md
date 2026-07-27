# STACK.md — Technology Stack

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## Overview

NagRaksha is a full-stack monorepo: a **Next.js 16 PWA frontend** (TypeScript, React 19) and a **Python FastAPI backend** (port 8000), connected through a Caddy gateway using `?XTransformPort=8000` query-parameter routing.

---

## Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | ^16.1.1 |
| Language | TypeScript | ^5 |
| UI Runtime | React + React DOM | ^19.0.0 |
| Styling | Tailwind CSS v4 | ^4 |
| Component library | Radix UI (full suite) | ^1–2.x |
| Animation | Framer Motion | ^12.23.2 |
| Icons | Lucide React | ^0.525.0 |
| Notifications | Sonner | ^2.0.6 |
| Forms | react-hook-form + @hookform/resolvers | ^5.1.1 |
| Date utilities | date-fns | ^4.1.0 |
| Class utilities | clsx + tailwind-merge | latest |
| Command palette | cmdk | ^1.1.1 |
| DB client (unused at runtime) | Prisma + @prisma/client | ^6.11.1 |

### Frontend Dev Tools
- **ESLint** (eslint-config-next + eslint-plugin-security)
- **Vitest** (^4.1.10) + jsdom + @testing-library/react
- **Prettier** (via husky pre-commit)
- **TypeScript** strict mode

### Key Custom Hooks
| Hook | Purpose |
|------|---------|
| `useGeolocation` | Browser GPS with fallback to Bannerghatta default coords |
| `useInView` | Intersection Observer for lazy-load gating |
| `useScroll` | Scroll-position tracking |
| `useToast` | Sonner toast bridge |
| `useMobile` | Responsive breakpoint detection |

---

## Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | 0.128.0 |
| ASGI server | Uvicorn | 0.44.0 |
| Language | Python | 3.11+ |
| Database | SQLite (via stdlib sqlite3) | — |
| ML / RAG | scikit-learn (TF-IDF) | 1.5.2 |
| ML / RAG | NumPy | >=1.26 |
| HTTP client | httpx | >=0.27 |
| Env management | python-dotenv | >=1.0 |
| Local LLM (optional) | llama-cpp-python | >=0.3 |
| Validation | Pydantic v2 | >=2.0 |
| Security audit | Bandit | >=1.8.0 |

### LLM Fallback Chain
1. **Local GGUF model** (auto-detected from `model/*.gguf`) via llama-cpp-python
2. **Grok API** (`grok-2-latest`, `grok-2-vision-latest`) — key in `.env`
3. **Gemini API** (`gemini-2.0-flash`) — key in `.env`
4. **Retrieval-only** — returns raw top-k TF-IDF chunk if no LLM available

---

## Infrastructure & Tooling

| Tool | Purpose |
|------|---------|
| Caddy (via AntiGravity IDE gateway) | Proxies frontend :3000 → port routing via XTransformPort |
| GitHub Actions | CI: lint + tsc + vitest (frontend) + bandit + pytest (backend) |
| Husky + lint-staged | Pre-commit: Prettier + ESLint auto-fix |
| SQLite `nagraksha.db` | Single-file embedded DB for all tables |
| Service Worker (PWA) | Disabled on localhost; active on prod |

---

## Database Schema Tables

`Incident`, `DispatchAttempt`, `Hospital`, `AntivenomStock`, `SymptomObservation`, `SnakeObservation`, `RiskReport`, `MythThread`, `KnowledgeChunk`, `OutboxEvent`, `AuditEvent`

All tables use 24-character hex UUIDs as primary keys. ISO 8601 UTC timestamps. Foreign keys enabled with `PRAGMA foreign_keys = ON`.
