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
- **Data Validation:** All incoming payloads must be strictly typed using Pydantic `BaseModel` schemas in `backend/app/models.py` (incl. `ReferralCreateRequest`, `ReferralAcceptRequest`, `ReferralDeclineRequest`).
- **Pure Domain Logic:** Clinical algorithms, distance metrics, score computations, and capability-gap rules reside in `backend/app/domain.py` as pure, deterministic functions free from database I/O (e.g. `evaluate_capability_gap`, `rank_capable_hospitals`, VenomScore classification).
- **Rate Limiting:** Critical public endpoints (such as `POST /api/sos` and `POST /api/auth/token`) are protected using `@limiter.limit(...)`.
- **Referral State Machine:** All referral transitions are guarded — load the row, verify the current status (`PENDING` → `ACCEPTED`/`DECLINED`, `ACCEPTED` → `IN_TRANSIT`, `IN_TRANSIT` → `ARRIVED`), issue an atomic `UPDATE … WHERE status='<expected>'` and return 409 on rowcount 0. Every transition enqueues an outbox event in the same transaction and appends an `AuditEvent`.
- **Transactional Side-Effects:** Any new domain event that must fan out (dispatch lane, referral lifecycle, telemetry broadcast) is written via `append_outbox_tx(conn, …)` inside the same DB transaction as the state change — never after commit.

## 3. Frontend TypeScript & React Patterns

- **Next.js App Router:** Components default to Server Components unless client-side state, browser APIs, or React hooks are required (`use client;`).
- **MediaPipe Dynamic Loading:** Components requiring browser-only WebAssembly models (like `venom-score.tsx`) MUST be loaded dynamically with `next/dynamic` and `{ ssr: false }`.
- **Zustand State:** Centralized state in `frontend/store/sos-store.ts`. Components select discrete slices rather than subscribing to the entire store.
- **API Typing:** All HTTP endpoints and WebSocket events are declared as TypeScript interfaces in `frontend/lib/nagraksha.ts` and `frontend/lib/realtime.ts`. Explicit `any` types are prohibited.
- **WebSocket Event Naming:** Legacy dispatch events broadcast lowercase (`dispatch_attempted`, `dispatch_accepted`, `incident_state`); Phase 08/09 telemetry & referral events broadcast uppercase (`VENOM_SCORE_UPDATE`, `REFERRAL_CREATED`, `REFERRAL_ACCEPTED`, `REFERRAL_DECLINED`, `TRANSPORT_STARTED`, `PATIENT_ARRIVED`). Keep both in the `IncidentSocketEvent` union.
- **Tailwind Styling:** Styles leverage utility classes with standard color tokens and `cn()` utility (`clsx` + `tailwind-merge`).

## 4. Error Handling & Resilience

- **Fail-Safe Fallbacks:**
  - If Twilio credentials are absent, the system falls back seamlessly to `domain.simulate_dispatch`.
  - If ChromaDB is unavailable, RAG falls back to TF-IDF retrieval.
  - If the camera is denied or unavailable, the UI provides clear explanatory feedback.
- **Guarded Transitions:** Referral accept/decline/transport/arrive endpoints return 409 (not silent overwrite) on invalid state transitions, with a descriptive `detail` message.
- **Telemetry:** Exceptions in production are captured via Sentry with request context.
