# Phase 08: VenomScore & August 15 Demo Execution — Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 23 (10 modified/config, 6 new, 7 tests)
**Analogs found:** 21 / 23 (2 partial — chart + MediaPipe component have no exact analog)
**Replan driver:** 08-REVIEWS.md (Codex + orchestrator verification). All HIGH/MEDIUM review findings verified against live code and encoded below.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` (root) | config | — | itself (remove `db:push`/`db:generate` lines 12-13) | exact |
| `setup.py` | config/utility | — | itself (npm check 34-41, install 88-90) | exact |
| `.gitignore` | config | — | itself (bare `test` at line 50 → `/test`) | exact |
| `frontend/package.json` | config | — | itself (add `recharts` + `@mediapipe/tasks-vision` to deps) | exact |
| `backend/app/limiter.py` | config/utility | — | `main.py:47` (limiter extraction) | role-match |
| `backend/app/routes/sos.py` | controller | request-response | `main.py:94-103` rate-limited route + itself | role-match |
| `frontend/store/sos-store.ts` | store | event-driven | itself | exact |
| `backend/app/database.py` | model | CRUD | itself (`WoundReading` schema 163-176 as template) | exact |
| `backend/app/models.py` | model | — | itself (`SosRequest`/`SymptomRequest`) | exact |
| `backend/app/domain.py` | service | transform | itself (pure functions, threshold classification) | exact |
| `backend/app/routes/venom_score.py` | controller | request-response + event-driven | `wound.py` (entire file) | **exact** |
| `backend/app/main.py` | config | — | itself (imports 30-34, "New in v2" 118-123) | exact |
| `backend/tests/test_domain.py` | test | transform | itself (TestX classes) | exact |
| `backend/tests/test_routes.py` | test | request-response | itself (TestSOS + `async_client`) | exact |
| `backend/tests/conftest.py` | test | — | itself (`seeded_hospital` fixture 37-56) | exact |
| `frontend/lib/nagraksha.ts` | utility | request-response | itself (interfaces + `apiFetch` helpers) | exact |
| `frontend/lib/realtime.ts` | utility | event-driven | itself (closed `IncidentSocketEvent` union line 4) | exact |
| `frontend/components/venom-score-chart.tsx` | component | transform | `health-indicator.tsx` (presentational) | partial |
| `frontend/components/venom-score.tsx` | component | event-driven + streaming | `symptom-logger.tsx` + `use-incident-socket.ts` | role-match |
| `frontend/app/incidents/[id]/page.tsx` | component | request-response + event-driven | itself | exact |
| `frontend/test/handlers.ts` | test | request-response | itself (MSW handlers) | exact |
| `backend/seed_demo.py` | utility/script | batch | `app/seed.py` (upsert pattern) | **exact** |

**Scope additions required by 08-REVIEWS.md (not in plans' `files_modified`):**
- `backend/app/limiter.py` — NEW (Review HIGH #1; research §"Rate Limiter Injection" already specifies it)
- `frontend/lib/realtime.ts` — must be modified for `VENOM_SCORE_UPDATE` (Review HIGH #2; without it the store won't typecheck)
- Hospital live-packet surface — does NOT exist (Review HIGH #3): `workspaces.tsx:276-319` is a static presentation ("No clinical decision is calculated", line 311). Planner must either add a real surface (role-gated view on `incidents/[id]`) or explicitly decide the demo shows the static workspace.

---

## Pattern Assignments

### `backend/app/routes/venom_score.py` (controller, request-response + event-driven) — NEW

**Analog: `backend/app/routes/wound.py`** (identical shape: validate incident → compute → persist → `await broadcast` → return)

**Imports pattern** (wound.py:6-17):
```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import database as db
from ..auth import require_role_if_enforced
from ..routes.ws import broadcast

router = APIRouter()
```

**Auth pattern** (wound.py:20-25) — Review HIGH #4: venom endpoints MUST carry this:
```python
@router.post("/api/venom-score/{incident_id}/reading")
async def submit_ptosis_reading(
    incident_id: str,
    req: PtosisReadingRequest,
    _role: str = Depends(require_role_if_enforced("victim", "hospital_admin", "system_admin")),
):
```

**Incident validation + 404** (wound.py:31-34):
```python
    with db.get_conn() as conn:
        inc = conn.execute("SELECT id FROM Incident WHERE id=?", (incident_id,)).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
```

**Persist + broadcast** (wound.py:42-79):
```python
    reading_id = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO PtosisReading (id, incidentId, timestamp, rightAperture, leftAperture, "
            "baselineRight, baselineLeft, closurePct, asymmetry, severity) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (...),
        )
    # Push live update to hospital view and victim
    await broadcast(incident_id, "VENOM_SCORE_UPDATE", {
        "venomScore": score, "reading": reading,
    })
    return {"reading": reading, "venomScore": score}
```

**GET trend pattern** (wound.py:84-97) — copy for `GET /api/venom-score/{incident_id}/readings`:
```python
@router.get("/api/venom-score/{incident_id}/readings")
def get_ptosis_readings(incident_id: str):
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, timestamp, rightAperture, leftAperture, closurePct, asymmetry, severity "
            "FROM PtosisReading WHERE incidentId=? ORDER BY timestamp ASC",
            (incident_id,),
        ).fetchall()
    return {"incidentId": incident_id, "readings": [dict(r) for r in rows]}
```

**minutes_since_bite — do NOT call `db.mins_since`** (Review verified finding: it doesn't exist). Copy wound.py:144-146:
```python
    minutes_since_bite = 0
    if inc.get("biteTime"):
        minutes_since_bite = round(db.days_since(inc["biteTime"]) * 1440)
```

**Data contract note (Review MEDIUM):** Research schema (`closurePct`, `baselineRight`, `baselineLeft`, `asymmetry`) vs reference doc (`percentChange`, `baselineAperture`, `asymmetric`) conflict. Pin ONE contract in the Pydantic model + DB schema + domain + TS types; the frontend reference reads `percentChange`, so use the reference-doc contract as canonical and keep dual-key handling inside domain functions.

**Vocabulary note (Review MEDIUM):** domain returns `neurotoxic`/`hemotoxic`/`unknown` (never `"dry_bite"`); `estimate_antivenom_vials` must not branch on an unreachable string. Align: `NEUROTOXIC`/`HEMOTOXIC`/`DRY_BITE`/`UNKNOWN` across domain, frontend type union, tests.

---

### `backend/app/limiter.py` (config/utility) — NEW

**Analog: `main.py:22-24, 47`** (the limiter being extracted). Circular-import proof: `main.py:30-34` imports `sos` BEFORE `limiter` is defined at line 47, so `sos.py` can never `from ..main import limiter` (Review HIGH #1).

**Copy exactly (research §"Rate Limiter Injection"):**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
```

**Then wire into `main.py`** (replace lines 22-24 + 47):
```python
from .limiter import limiter
...
app.state.limiter = limiter              # main.py:64
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # main.py:65
```
Keep the `RateLimitExceeded` / `_rate_limit_exceeded_handler` imports (main.py:22-24) in `main.py` — they are used for the exception handler.

---

### `backend/app/routes/sos.py` (controller, request-response) — MODIFY

**Analog for the decorator + request param: `main.py:94-103`** (the only working slowapi route):
```python
@app.post("/api/auth/token")
@limiter.limit("10/minute")
def get_token(request: Request, body: TokenRequest):
```
Key facts: decorator sits directly above the route; **`request: Request` MUST be a parameter** (slowapi requirement — Review HIGH #1). Keep `trigger_sos` as a sync `def` (its body is sync DB calls; Review "Divergent Views" — no `async` needed).

**Modified signature** (replace sos.py:15-16):
```python
from fastapi import APIRouter, Request      # add Request
from ..limiter import limiter               # new import — NOT from ..main

@router.post("/api/sos")
@limiter.limit("10/minute")
def trigger_sos(request: Request, req: SosRequest):
```

**Test note (Review Suggestion):** add a rate-limit test in `test_routes.py` — allowed request passes, then a 429 after the threshold (slowapi counts against the shared `Limiter`; use `monkeypatch`/fresh client or a distinct limit if flaky).

---

### `backend/app/database.py` (model, CRUD) — MODIFY

**Analog: itself.** `WoundReading` (lines 163-176) is the exact template for `PtosisReading`:

**Schema addition** (append inside `SCHEMA`, after line 235):
```sql
CREATE TABLE IF NOT EXISTS PtosisReading (
    id TEXT PRIMARY KEY,
    incidentId TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    rightAperture REAL NOT NULL,
    leftAperture REAL NOT NULL,
    baselineRight REAL,
    baselineLeft REAL,
    closurePct REAL,
    asymmetry REAL,
    severity TEXT NOT NULL,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ptosis_incident ON PtosisReading(incidentId);
```
(Schema from 08-RESEARCH.md lines 86-100; adapt columns if the pinned contract uses `percentChange`/`baselineAperture`.)

**Migration decision (Review MEDIUM):** `CREATE TABLE IF NOT EXISTS` inside `SCHEMA` covers new DBs; `migrate_db()` (lines 244-261) only does `ALTER TABLE`. A brand-new table needs **no migration** — `init_db()` runs `executescript(SCHEMA)` (line 268) then `migrate_db()` (line 271). No `mins_since` helper to add — reuse `days_since` (295-302) × 1440 per wound.py:146.

---

### `backend/app/models.py` (model) — MODIFY

**Analog: itself.** `SosRequest` (8-14) / `SymptomRequest` (33-38) show the loose-optional style; `MythRequest` (24-25) shows `Field(..., min_length=1)`. Add:

```python
class PtosisReadingRequest(BaseModel):
    rightAperture: float = Field(..., ge=0.0, le=1.0)   # normalized MediaPipe coords
    leftAperture: float = Field(..., ge=0.0, le=1.0)
    severity: str = "NORMAL"   # NORMAL | MILD | MODERATE | SEVERE
    baselineRight: Optional[float] = None
    baselineLeft: Optional[float] = None
    # if reference-doc contract pinned: percentChange, baselineAperture, asymmetric instead
```
Validate apertures are normalized (0-1) per Review — `ge/le` bounds give free 422s.

---

### `backend/app/domain.py` (service, transform) — MODIFY

**Analog: itself** — pure functions, no DB/I-O (imports: `math`, `random`, `time`, `datetime` only; lines 1-7). Threshold-classification style to copy: `stock_freshness` (41-58) returns 0-100 score by banding — same shape as severity thresholds:
- 0-20% closure → NORMAL; 20-40% → MILD; 40-70% → MODERATE; >70% → SEVERE (research 108).
- `classify_venom_type`: closurePct > 30 → NEUROTOXIC; swelling without ptosis → HEMOTOXIC; else UNKNOWN (NOT "dry_bite" — Review MEDIUM).
- WHO guideline: 10 vials initial, up to 20 severe neurotoxic (research 109).

Add functions: `classify_venom_type`, `compute_dry_bite_probability`, `estimate_antivenom_vials`, `compute_venom_score`. Return dicts (like `stock_freshness` line 61) — keep the advisory disclaimer note (Review: `knowledge_base_data.py:58` says dosage is doctor-decided; outputs must be advisory).

---

### `backend/app/main.py` (config) — MODIFY

**Analog: itself.** Three edits:
1. Swap `limiter` import (lines 22-24, 47) → `from .limiter import limiter` (keep slowapi error-handler imports).
2. Add `venom_score` to route imports (lines 30-34 block).
3. Register in "New in v2" block (lines 118-123):
```python
app.include_router(venom_score.router)   # tag="venom-score", prefix /api
```
(RESEARCH.md: routes already carry `/api` in their decorators — wound.py:20 — so no extra `prefix` needed in `include_router`.)

---

### `backend/seed_demo.py` (utility/script, batch) — NEW

**Analog: `backend/app/seed.py`** (lines 28-52 — idempotent upsert by `name`; Review HIGH #6: bare `INSERT OR IGNORE` duplicates rows because `Hospital.name` is not unique).

**Copy the upsert pattern** (seed.py:28-52) for hospitals + compliance + `AntivenomStock`; extend to `Stakeholder` and `VillageAudit`:
```python
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from app import database as db          # <- requires PYTHONPATH or sys.path (see below)

def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")

def run():
    db.init_db()
    with db.get_conn() as conn:
        for h in hospitals:
            existing = conn.execute("SELECT id FROM Hospital WHERE name=?", (h[0],)).fetchone()
            if existing:
                conn.execute("UPDATE Hospital SET lat=?, lng=?, ..., updatedAt=? WHERE id=?", (..., existing["id"]))
            else:
                hid = db.new_id()
                conn.execute("INSERT INTO Hospital (id, name, ...) VALUES (?, ?, ...)", (hid, ...))
            conn.execute("INSERT INTO AntivenomStock (id, hospitalId, ...) VALUES (?, ?, ...)", (db.new_id(), hid, ...))
```
- **Run contract (Review MEDIUM):** `app/seed.py` uses package-relative `from . import database` — that breaks when run as `python seed_demo.py`. Copy `setup.py:99` instead: `sys.path.insert(0, os.path.join(ROOT, "backend"))` then `from app import database as db`. Keep the file at `backend/seed_demo.py` (per plan) so `sys.path.insert` points at `backend/`.
- **Idempotency:** deterministic ids or upsert-by-name for every table; delete only its own demo rows on re-run.
- **Stakeholder consent note (Review MEDIUM):** `routes/stakeholders.py:1` frames entries as documented community support — mark demo records transparently (e.g. supportType `pilot_permission`, not real consent claims).

---

### `frontend/store/sos-store.ts` (store, event-driven) — MODIFY

**Analog: itself.** Three edits:

**1. Deep-link fix (08-01, line 51)** — REVIEW confirms `setIncident` omits `incidentId` while `updateFromWsEvent` line 83-84 depends on it:
```typescript
setIncident: (incident) =>
  set({
    incident,
    incidentId: incident.id,             // was missing — fixes WS refresh deep link
    dispatchLanes: incident.dispatchAttempts ?? [],
  }),
```

**2. VenomScore state (08-03):** add `ptosisReadings: PtosisReading[]` + `venomScore: VenomScoreResult | null` to `SosState` (lines 6-13) and `initialState` (23-30); add `addPtosisReading`/`setVenomScore` to `SosActions` (15-21).

**3. WS event branch (08-03)** — extend `updateFromWsEvent` (53-91). NOTE: backend broadcasts `"VENOM_SCORE_UPDATE"` (uppercase) while existing events are lowercase (research 142); the type union change in `realtime.ts` is required for typecheck (Review HIGH #2):
```typescript
} else if (event === 'VENOM_SCORE_UPDATE') {
  set({ venomScore: data as VenomScoreResult });
}
```

---

### `frontend/lib/realtime.ts` (utility, event-driven) — MODIFY

**Analog: itself.** Line 4 is a closed union — adding the event without editing this file fails `tsc` (Review HIGH #2, verified):

```typescript
export interface IncidentSocketEvent {
  event: 'dispatch_attempted' | 'dispatch_accepted' | 'incident_state' | 'VENOM_SCORE_UPDATE';
  data: Record<string, unknown>;
}
```

---

### `frontend/lib/nagraksha.ts` (utility, request-response) — MODIFY

**Analog: itself.** Add interfaces near `StockUpdate` (121-126) and API helpers near `logSymptom` (148-152):

```typescript
export interface PtosisReading {
  id: string; incidentId: string; timestamp: string;
  rightAperture: number; leftAperture: number;
  baselineRight?: number | null; baselineLeft?: number | null;
  closurePct?: number; asymmetry?: number;
  severity: 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
}
export interface VenomScoreResult {
  venomType: 'NEUROTOXIC' | 'HEMOTOXIC' | 'DRY_BITE' | 'UNKNOWN';
  severity: string; dryBiteProbability?: number;
  vials?: { initial: number; max: number; protocol: string };
  minutesSinceBite?: number; timestamp?: string;
}

export const submitPtosisReading = (id: string, body: Record<string, unknown>) =>
  apiFetch<{ reading: PtosisReading; venomScore: VenomScoreResult }>(
    `/api/venom-score/${id}/reading`, { method: 'POST', body: JSON.stringify(body) });
export const getVenomScore = (id: string) =>
  apiFetch<{ venomScore: VenomScoreResult }>(`/api/venom-score/${id}/score`);
```
`apiFetch` (api.ts:13-27) already injects `Authorization: Bearer` from localStorage — the auth wiring is free.

---

### `frontend/components/venom-score.tsx` (component, event-driven + streaming) — NEW

**Analog: `symptom-logger.tsx` (11-29)** for the submit/loading/error cycle; **`use-incident-socket.ts` (11-19)** for the unmount-cleanup pattern. No MediaPipe analog exists.

**Copy from symptom-logger.tsx (11-29):**
```typescript
'use client';
import { useState } from 'react';
import { submitPtosisReading } from '@/lib/nagraksha';

export function VenomScore({ incidentId }: { incidentId: string }) {
  const [status, setStatus] = useState<'idle' | 'calibrating' | 'tracking' | 'no-face' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (reading: {...}) => {
    try {
      await submitPtosisReading(incidentId, reading);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  };
  ...
}
```

**Cleanup pattern (copy use-incident-socket.ts:11-19):**
```typescript
useEffect(() => {
  // load FaceLandmarker, start getUserMedia, interval every 10s
  return () => {
    // stop video tracks, clearInterval, cancelAnimationFrame, abort in-flight submit
  };
}, [incidentId]);
```

**Review-required robustness (MEDIUMs):** camera-permission denial, no-face detection, model/WASM load failure, stale async callbacks (cancelled flag — copy page.tsx:24-40), stream/interval cleanup on unmount, single-flight submissions, status UI ("Calibrating…" — research pitfall 5, model takes 1-3s). Load MediaPipe client-only via `next/dynamic({ ssr: false })` (research pitfall 2). Landmark indices: RU 159 / RL 145 / LU 386 / LL 374, aperture = `sqrt((upper.x-lower.x)² + (upper.y-lower.y)²)` in normalized 0-1 coords (research 130-132).

---

### `frontend/components/venom-score-chart.tsx` (component, transform) — NEW

**Analog: `health-indicator.tsx` (1-24)** for presentational client-component shape. NO chart analog exists — `recharts` is NOT in `frontend/package.json` (verified; Review HIGH #3) and must be added. Layout pattern:
```typescript
'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
// 'use client' + presentational div/span styling from health-indicator.tsx / symptom-logger.tsx
```
ReferenceLines at 40% (ptosis onset) and 70% (severe) per plan 08-03 must-have.

---

### `frontend/app/incidents/[id]/page.tsx` (component, request-response + event-driven) — MODIFY

**Analog: itself.** Keep: `useIncidentSocket(id)` (line 21), the `getIncident` fetch with `cancelled` guard (23-40), `refreshIncident` (42-49). Add `<VenomScore incidentId={id} />` + `<VenomScoreChart />` to the victim view. **No hospital/role surface exists here** (Review HIGH #3) — page.tsx:70-123 has dispatch lanes only; the "hospital view" must be a deliberate new surface or the demo shows the static `HospitalWorkspace` (`workspaces.tsx:276-319`, which states "No clinical decision is calculated" at line 311).

---

### `frontend/test/handlers.ts` (test, request-response) — MODIFY

**Analog: itself.** Add MSW handlers in the existing style (1-9, 21-79):
```typescript
http.post(`${BASE}/api/venom-score/:incidentId/reading`, async ({ request, params }) =>
  HttpResponse.json({
    reading: { id: 'ptosis-1', incidentId: params.incidentId, timestamp: new Date().toISOString(),
      rightAperture: 0.42, leftAperture: 0.31, closurePct: 26.2, asymmetry: 0.11, severity: 'MILD' },
    venomScore: { venomType: 'NEUROTOXIC', severity: 'MILD', vials: { initial: 10, max: 20, protocol: 'WHO' } },
  })),
http.get(`${BASE}/api/venom-score/:incidentId/score`, () =>
  HttpResponse.json({ venomScore: { venomType: 'NEUROTOXIC', severity: 'MILD' } })),
```
Add unit tests in `lib/__tests__/nagraksha.test.ts` (style: describe/it/expect, lines 1-42) for submit + get; component tests for VenomScore must mock MediaPipe + `getUserMedia` (Review MEDIUM).

---

### Backend tests (MODIFY)

**`backend/tests/conftest.py`** — copy `seeded_hospital` (37-56) to add `seeded_incident` (Review: plan assumes it; current fixtures don't have it — create via POST /api/sos or direct INSERT + yield + DELETE). Note Review "Divergent Views" LOW: avoid `asyncio.get_event_loop().run_until_complete()` inside sync fixtures; create the incident directly via `db.get_conn()`.

**`backend/tests/test_routes.py`** — copy `TestSOS` (7-17) class shape. **Broadcast testing (Review HIGH #5):** httpx ASGI cannot observe WS pushes; patch the module's `broadcast` with `AsyncMock`:
```python
async def test_posting_reading_broadcasts(self, async_client, monkeypatch):
    from app.routes import venom_score
    sent = {}
    async def fake_broadcast(incident_id, event, payload):
        sent["event"] = event; sent["payload"] = payload
    monkeypatch.setattr(venom_score, "broadcast", fake_broadcast)
    ... # POST reading; assert sent["event"] == "VENOM_SCORE_UPDATE"
```
(Monkeypatching pattern precedent: `conftest.py:18-27` patches `start_worker`/`ensure_kb_seeded`.) Also add: 404 on unknown incident (GET + POST), 422 invalid apertures, ordering by timestamp, persistence.

**`backend/tests/test_domain.py`** — copy `TestStockFreshness` (65-87) threshold-class style for a `TestVenomScore` class covering neurotoxic/hemotoxic/unknown (NOT "dry_bite" — Review MEDIUM), vial estimation, empty-readings edge.

---

## Shared Patterns

### WebSocket broadcast (async route)
**Source:** `backend/app/routes/ws.py:62-72`
**Apply to:** `venom_score.py` POST handler
```python
async def broadcast(incident_id: str, event: str, payload: dict) -> None:
    """Push an event to all WebSocket clients subscribed to an incident."""
    message = json.dumps({"event": event, "data": payload})
```
- `await broadcast(...)` inside `async def` routes (wound.py:74). `broadcast_sync` (ws.py:29-37) is ONLY for the outbox worker thread — silent data loss if misused (research pitfall 1).

### Rate limiting (slowapi)
**Source:** `main.py:94-103` + new `limiter.py`
**Apply to:** `sos.py` (10/minute)
```python
@limiter.limit("10/minute")
def get_token(request: Request, body: TokenRequest):
```
**Critical:** `request: Request` must be a route parameter (research pitfall 3).

### Auth (off by default)
**Source:** `backend/app/auth.py:115-130`
**Apply to:** all venom_score mutating + read endpoints
```python
def require_role_if_enforced(*allowed_roles: str):
    """Dependency factory: enforce role checks only when AUTH_ENFORCED is set."""
    def _check(role: str = Depends(get_role)) -> str:
        if not AUTH_ENFORCED:
            return role
        if role not in allowed_roles:
            raise HTTPException(status_code=403, ...)
        return role
    return _check
```
Gate is off in demo (`AUTH_ENFORCED` false) — but the dependency must be declared (Review HIGH #4).

### DB access
**Source:** `backend/app/database.py:274-288` (`get_conn`), `308-309` (`new_id`), `291-292` (`now_iso`)
**Apply to:** venom_score.py, seed_demo.py
```python
with db.get_conn() as conn:          # commits on success, rolls back on exception
    conn.execute(...)
reading_id = db.new_id()
now = db.now_iso()
```

### Error handling (routes)
**Source:** `wound.py:33-34` (HTTPException 404 for unknown incident); Pydantic 422 free via `Field(ge/le)` (models.py:25). No custom AppError class exists — this codebase uses FastAPI `HTTPException` throughout.

### Frontend component skeleton
**Source:** `symptom-logger.tsx:1-29` / `dispatch-actions.tsx:1-28` / `health-indicator.tsx:1-12`
**Apply to:** venom-score.tsx, venom-score-chart.tsx
```typescript
'use client';
import { useState } from 'react';
// state + try/catch/finally around apiFetch; status UI; disabled while submitting
```

### MSW handler shape
**Source:** `frontend/test/handlers.ts:1-9`
**Apply to:** new VenomScore handlers
```typescript
import { http, HttpResponse } from 'msw';
const BASE = 'http://localhost:8000';
export const handlers = [ http.post(`${BASE}/api/...`, () => HttpResponse.json({...})) ];
```

---

## No Analog Found / Partial

| File | Role | Data Flow | Reason / Guidance |
|------|------|-----------|-------------------|
| `frontend/components/venom-score-chart.tsx` | component | transform | **No Recharts usage anywhere** (verified: `recharts` absent from package.json). Planner: add dep; use `health-indicator.tsx` for presentational skeleton + RESEARCH.md chart spec (ReferenceLine 40%/70%). |
| `frontend/components/venom-score.tsx` | component | event-driven + streaming | **No MediaPipe/webcam component exists.** Use `symptom-logger.tsx` (submit cycle) + `use-incident-socket.ts` (cleanup) + research landmark spec (159/145/386/374). Planner must specify `next/dynamic({ ssr: false })` and status-state machine. |
| Hospital live-packet surface | component | event-driven | **Does not exist.** `workspaces.tsx:276-319` is static ("No clinical decision is calculated"). Planner must decide: build role-gated live surface on `incidents/[id]` OR demo static workspace (Review HIGH #3). |

## Metadata

**Analog search scope:** `backend/app/**` (routes, auth, database, domain, models, seed, main, tests), `frontend/**` (store, lib, components, app/incidents/[id], test, hooks), root configs
**Files scanned:** ~20 analog reads (wound, sos, ws, main, database, models, domain, auth, seed, conftest, test_routes, test_domain, sos-store, realtime, nagraksha, api, page, handlers, setup, symptom-logger, dispatch-actions, health-indicator, use-incident-socket, workspaces, package.json, .gitignore)
**Pattern extraction date:** 2026-08-15