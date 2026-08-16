# Coding Conventions & Development Standards

**Analysis Date:** 2026-08-16

## 1. Code Style & Formatting

- **Prettier:** Enforced repository-wide on JavaScript, TypeScript, JSON, CSS, and Markdown.
- **ESLint:** Strict configuration with `typescript-eslint` and `eslint-plugin-security` enabled at error level. Zero warnings permitted (`--max-warnings 0`).
- **Python Linting:** `ruff` for ultra-fast PEP 8 compliance and `bandit` for static security vulnerability scanning.
- **Git Hooks:** `husky` and `lint-staged` run Prettier and ESLint automatically before every commit.

## 2. Python Backend Patterns

- **Type Hints:** Mandatory type annotations across all function signatures (`from __future__ import annotations`).
- **Database Context Manager:** Always access SQLite via `with db.get_conn() as conn:`. Never hold long-lived connection handles across request cycles.
- **Data Validation:** All incoming payloads must be strictly typed using Pydantic `BaseModel` schemas in `backend/app/models.py`.
- **Pure Domain Logic:** Clinical algorithms, distance metrics, and score computations reside in `backend/app/domain.py` as pure, deterministic functions free from database I/O.
- **Rate Limiting:** Critical public endpoints (such as `POST /api/sos` and `POST /api/auth/token`) are protected using `@limiter.limit(...)`.

## 3. Frontend TypeScript & React Patterns

- **Next.js App Router:** Components default to Server Components unless client-side state, browser APIs, or React hooks are required (`use client;`).
- **MediaPipe Dynamic Loading:** Components requiring browser-only WebAssembly models (like `venom-score.tsx`) MUST be loaded dynamically with `next/dynamic` and `{ ssr: false }`.
- **Zustand State:** Centralized state in `frontend/store/sos-store.ts`. Components select discrete slices rather than subscribing to the entire store.
- **API Typing:** All HTTP endpoints and WebSocket events are declared as TypeScript interfaces in `frontend/lib/nagraksha.ts` and `frontend/lib/realtime.ts`. Explicit `any` types are prohibited.
- **Tailwind Styling:** Styles leverage utility classes with standard color tokens and `cn()` utility (`clsx` + `tailwind-merge`).

## 4. Error Handling & Resilience

- **Fail-Safe Fallbacks:**
  - If Twilio credentials are absent, the system falls back seamlessly to `domain.simulate_dispatch`.
  - If ChromaDB is unavailable, RAG falls back to TF-IDF retrieval.
  - If the camera is denied or unavailable, the UI provides clear explanatory feedback.
- **Telemetry:** Exceptions in production are captured via Sentry with request context.
