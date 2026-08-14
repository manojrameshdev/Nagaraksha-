# Phase 7 Research: Frontend-Backend Integration

## Summary

Phase 7 wires a **new Next.js 14 App Router frontend** to the **existing NagRaksha FastAPI backend**.
The backend is fully operational at http://localhost:8000 with:
- REST routes for SOS, incidents, hospitals, risk, snake ID, myth-buster, stats, architecture, ops, audit, stakeholders, wound, Twilio webhook
- A **WebSocket channel** at /ws/incidents/{id} for real-time dispatch updates
- A **legacy SSE stream** at /api/incidents/{id}/stream (kept for backward compatibility)
- JWT role-based auth (ictim, hospital_admin, system_admin) via POST /api/auth/token
- CORS pre-configured for http://localhost:3000 (and FRONTEND_URL env var in production)

The old frontend's deleted files reveal the integration patterns that must be reproduced:
src/lib/api.ts, src/lib/realtime.ts, src/lib/nagraksha.ts, src/store/sos-store.ts.

---

## Research Findings

### 1. API Client Setup

**Pattern:** A typed fetch wrapper reading NEXT_PUBLIC_BACKEND_URL and attaching JWT tokens.

Key points:
- NEXT_PUBLIC_BACKEND_URL is already in .env.example — no changes needed to the backend
- The backend expects Authorization: Bearer <jwt> — the client must store and forward the token
- All mutation routes use equire_role_if_enforced() which is **off by default** in development

### 2. Authentication Flow

**Backend:** POST /api/auth/token accepts { role, secret } and returns { token, role }.

| Role | Secret env var | Default demo secret |
|------|----------------|---------------------|
| ictim | ROLE_SECRET_VICTIM | ictim-demo |
| hospital_admin | ROLE_SECRET_HOSPITAL | hospital-demo |
| system_admin | ROLE_SECRET_ADMIN | dmin-demo |

Token expires after **24 hours**. For the public SOS page, no auth is required.

### 3. SOS Trigger Flow

The core user journey: **one-tap SOS → backend creates incident + dispatches three parallel lanes**.

```
POST /api/sos  { lat, lng, address?, snake_description? }
→ Returns { incidentId, lanes: [...], hospitals: [...] }
```

Frontend must: get geolocation → POST /api/sos → store incidentId → navigate to /incidents/{id} → open WebSocket.

### 4. WebSocket Integration

**Backend endpoint:** ws://localhost:8000/ws/incidents/{incident_id}

The backend **pushes** events; the client **listens only** (sends pings to keep alive).

Message format: { "event": "dispatch_attempted|dispatch_accepted|incident_state", "data": {...} }

Reconnecting WS pattern: On close, setTimeout(connect, 2000). Derive ws:// from NEXT_PUBLIC_BACKEND_URL by replacing http with ws.

### 5. All Backend Routes to Wire

| Route | Method | Frontend Usage |
|-------|--------|----------------|
| /api/health | GET | Health check / status page |
| /api/sos | POST | One-tap SOS trigger |
| /api/incidents | GET | Responder dashboard |
| /api/incidents/{id} | GET | Incident detail page |
| /api/incidents/{id}/symptoms | POST | Patient symptom logger |
| /api/incidents/{id}/accept | PATCH | Responder accepts dispatch |
| /api/incidents/{id}/decline | PATCH | Responder declines dispatch |
| /api/incidents/{id}/audit | GET | Audit trail page |
| /api/incidents/{id}/stream | GET | Legacy SSE fallback |
| /api/hospitals | GET | Hospital list (ranked by proximity) |
| /api/hospitals/{id}/stock | PATCH | Update antivenom stock (admin) |
| /api/risk | GET | Risk assessment map |
| /api/stats | GET | Dashboard statistics |
| /api/audit | GET | System audit log |
| /api/outbox | GET | Outbox status (ops panel) |
| /api/knowledge-base?q= | GET | RAG myth-buster search |
| /api/auth/token | POST | Login / get JWT |
| /ws/incidents/{id} | WS | Real-time dispatch updates |

### 6. State Management

**Recommended: Zustand** for SOS/incident state, **TanStack Query (React Query v5)** for server-state caching.

### 7. CORS — No Changes Needed

Backend already allows http://localhost:3000. Production requires setting FRONTEND_URL env var.

### 8. CI Pipeline

Existing ci.yml expects: package-lock.json, 
pm ci, 
px vitest run, 
pm run lint, 
pm run build.
If new frontend uses bun/pnpm, the CI workflow must be updated accordingly.

### 9. TypeScript Types

Backend exposes GET /openapi.json. Use openapi-typescript to auto-generate:
```
npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/api-types.ts
```

---

## Validation Architecture

### Integration Tests
- GET /api/health returns 200 (API connectivity)
- Mock POST /api/sos → verify incidentId stored in Zustand and navigation fires
- Mock WebSocket → verify incoming events update React state
- Mock GET /api/hospitals → verify ranked list renders
- Mock POST /api/auth/token → verify token attached to subsequent requests

### Manual Verification
- [ ] SOS button: geolocation → loading → backend call → navigate to /incidents/{id}
- [ ] Incident page: real-time dispatch lane updates via WebSocket
- [ ] Hospital list loads ranked by proximity
- [ ] Symptom logger posts and appears in incident detail
- [ ] Responder accept/decline works with JWT
- [ ] Stats dashboard shows counts
- [ ] Myth-buster search works
- [ ] 
pm run build succeeds with NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
- [ ] 
px vitest run passes all tests

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| New frontend uses different package manager than CI expects (npm) | Medium | Update ci.yml lockfile path and install command |
| WebSocket blocked in some environments | Low-Medium | SSE fallback at /api/incidents/{id}/stream |
| Geolocation permission denied | Medium | Manual lat/lng input fallback |
| JWT 401 after 24h expiry | Low | 401 interceptor to clear token and prompt re-login |
| TypeScript type drift from Pydantic models | Medium | Use openapi-typescript auto-generation |
| package-lock.json missing in new frontend (bun.lock instead) | High | Update CI cache-dependency-path |

---

## Recommended Approach — 4 Plans

**Plan 07-01: API Client & Auth Layer**
- src/lib/api.ts — typed fetch wrapper
- src/lib/nagraksha.ts — all API functions + TypeScript types
- src/hooks/use-auth.ts — login, token storage, role management
- rontend/.env.local, rontend/.env.example

**Plan 07-02: SOS Flow & Real-Time WebSocket**
- src/store/sos-store.ts — Zustand store
- src/lib/realtime.ts — reconnecting WebSocket client
- src/hooks/use-geolocation.ts
- src/hooks/use-incident-socket.ts
- Wire SOS button → incident page with live WebSocket

**Plan 07-03: Remaining Feature Pages**
- Hospitals, Responder dashboard, Stats, Myth-buster, Symptom logger, Audit trail
- All data-fetching hooks for each backend route

**Plan 07-04: CI Pipeline Sync & Test Coverage**
- Update ci.yml to match new frontend
- Vitest integration tests (MSW mocks)
- Ensure CI passes end-to-end
