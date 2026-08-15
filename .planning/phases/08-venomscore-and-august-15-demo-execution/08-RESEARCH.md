# Phase 08 Research — VenomScore & August 15 Demo Execution

**Mode:** Implementation (concrete codebase analysis, not ecosystem survey)
**Date:** 2026-08-15
**Status:** RESEARCH COMPLETE

---

## Summary

Phase 8 is an implementation-only phase — all four plans are pre-written and well-specified.
The primary goal of research is to **pre-verify every integration point** so execution can
be zero-surprise. No new technology choices needed; the stack is locked.

---

## Standard Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Backend API | FastAPI + uvicorn | Already running in `backend/app/main.py` |
| DB | SQLite + raw SQL | `database.py`, WAL mode, `get_conn()` ctx manager |
| WebSocket broadcast | `ws.broadcast` / `ws.broadcast_sync` | `routes/ws.py` — two entry points |
| Rate limiting | slowapi `Limiter` | Already wired in `main.py`; `limiter` is module-level |
| Frontend framework | Next.js App Router | `frontend/app/` |
| State management | Zustand | `frontend/store/sos-store.ts` |
| Charts | Recharts | Already used (WoundTracker pattern) |
| CV | `@mediapipe/tasks-vision` | Not yet installed; needed for VenomScore |
| Testing (BE) | pytest + httpx ASGI | `conftest.py`, `seeded_hospital` fixture pattern |
| Testing (FE) | Vitest + MSW | `test/handlers.ts` |

---

## Architecture Patterns

### Backend Route Pattern (copy from `wound.py`)

```python
from .. import database as db
from ..auth import require_role_if_enforced
from ..routes.ws import broadcast          # async — use inside async route
# OR
from ..routes.ws import broadcast_sync     # thread-safe — from sync or worker thread

router = APIRouter()

@router.post("/api/venom-score/{incident_id}/reading")
async def submit_ptosis_reading(incident_id: str, req: PtosisReadingRequest, ...):
    # 1. Validate incident exists
    # 2. Compute domain logic (pure functions in domain.py)
    # 3. INSERT into PtosisReading
    # 4. await broadcast(incident_id, "VENOM_SCORE_UPDATE", {...})
    # 5. return payload
```

- Use `async def` + `await broadcast()` (not `broadcast_sync`) inside FastAPI routes.
- `broadcast_sync` is only for the background outbox worker thread.

### Registration in `main.py`

Add import + `app.include_router(venom_score.router)` in the "New in v2" block.

### Rate Limiter Injection (08-01 task)

The `limiter` object lives in `main.py`. To avoid circular imports, extract it:

**Recommended:** Create `backend/app/limiter.py`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
```

Then import in both `main.py` and `sos.py`:
```python
from .limiter import limiter
```

**Critical:** `request: Request` parameter MUST be present in the route when slowapi is used.

### DB Schema — PtosisReading table

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

### Domain Logic (`domain.py`)

All pure functions — no DB, no I/O. Severity thresholds:
- 0–20% closure ? NORMAL
- 20–40% ? MILD (ptosis onset)
- 40–70% ? MODERATE
- >70% ? SEVERE

WHO antivenom guideline: 10 vials initial, up to 20 for severe neurotoxic.

```python
def classify_venom_type(ptosis_readings, wound_readings) -> str:
    # closurePct > 30 in any reading ? NEUROTOXIC
    # wound swelling growing without ptosis ? HEMOTOXIC
    # neither ? DRY_BITE

def compute_dry_bite_probability(ptosis_readings, wound_readings, minutes_since_bite) -> float:
    # High prob if >60 min elapsed, no ptosis, no swelling

def estimate_antivenom_vials(venom_type, severity_score) -> dict:
    # {"initial": int, "max": int, "protocol": str}

def compute_venom_score(ptosis_readings, wound_readings, minutes_since_bite) -> dict:
    # composite result: venom_type, dry_bite_prob, vials, severity
```

### MediaPipe Landmark Indices

- Right upper lid: **159**, lower lid: **145**
- Left upper lid: **386**, lower lid: **374**
- Aperture = sqrt((upper.x-lower.x)^2 + (upper.y-lower.y)^2) in normalized coords

### Frontend Store Extension

```typescript
} else if (event === 'VENOM_SCORE_UPDATE') {
  set({ venomScore: data as VenomScoreResult });
}
```

Note: backend broadcasts `"VENOM_SCORE_UPDATE"` (uppercase), dispatch events are lowercase.

---

## Don't Hand-Roll

| Capability | Use Instead |
|---|---|
| Haversine / ETA | `domain.haversine_km`, `domain.eta_min` (already exist) |
| WebSocket broadcast | `ws.broadcast` (already exists) |
| Auth / JWT | `auth.require_role_if_enforced` (already exists) |
| Rate limiting | `slowapi` (already wired) |
| DB connection | `db.get_conn()` context manager |
| Face landmark geometry | MediaPipe normalized coords — no OpenCV |
| Chart rendering | Recharts (already a dep) |

---

## Common Pitfalls

1. **`broadcast` vs `broadcast_sync`** — `broadcast` must be `await`ed in `async def`. Silent data loss if not.
2. **MediaPipe + Next.js SSR** — use `ssr: false` in `next/dynamic`. WASM is browser-only.
3. **slowapi `request` param** — `Request` must be a route parameter when using `@limiter.limit()`.
4. **Aperture normalization** — use MediaPipe normalized coords (0–1), not raw pixels.
5. **Model load time** — Face Landmarker takes 1–3 s. Show "Calibrating…" state or demo looks broken.
6. **`SCHEMA` + `executescript`** — adds an implicit COMMIT; do not nest `get_conn()` inside `init_db()`.
7. **pnpm on Windows** — ensure pnpm is on PATH before running `setup.py`.

---

## Verification Plan

```bash
# 08-01
cd backend && python -m pytest tests/ -q   # still 61 tests green
cd frontend && pnpm run lint               # 0 errors

# 08-02
cd backend && python -m pytest tests/ -v   # new TestVenomScore class passes

# 08-03
cd frontend && npx vitest run              # new VenomScore handler tests green
cd frontend && pnpm run build              # no TS errors

# 08-04
cd backend && python seed_demo.py          # exits 0
cd backend && python -m pytest tests/ -q   # all green
```

---

## RESEARCH COMPLETE

All integration points verified from live code. No unknowns remain.
Recommended execution order: **08-01 ? (08-02 ? 08-03) ? 08-04**
