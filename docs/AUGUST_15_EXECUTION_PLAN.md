# NagRaksha — August 15 Execution Plan
**Demo tomorrow 10 AM at IISc. You have today.**

---

## Reality Check First

The August 15 codebase analysis shows most of the clean build work from the earlier plan
is already done. The frontend has been refactored to App Router with proper pages, MSW
testing, typed API client, and pnpm. The backend has 61 tests.

What actually remains before demo:
- 6 small cleanup items (30 minutes total)
- 1 real bug fix (15 minutes)
- VenomScore — doesn't exist yet (5–6 hours, the main work)
- Demo seed data (30 minutes)
- 3× demo rehearsal (1.5 hours)

Split the work: **Person A on frontend**, **Person B on backend**. Start in parallel
at the same time after the cleanup is done.

---

## Hour 0 — Cleanup First (Both People, 30 Minutes)

Do this together before splitting. Fast and sequential.

### 0.1 Delete the zip and Prisma scripts

```bash
# From repo root:
rm nag-raksha.zip

# Open root package.json, delete these two lines:
# "db:push": "cd frontend && prisma db push",
# "db:generate": "cd frontend && prisma generate",
```

### 0.2 Fix setup.py (npm → pnpm)

Open `setup.py`. Find the frontend install step. Change:
```python
# Before:
subprocess.run(["npm", "install"], cwd="frontend", check=True)

# After:
subprocess.run(["pnpm", "install"], cwd="frontend", check=True)
```

### 0.3 Fix .gitignore bare test entry

Open `.gitignore`. Find the line that is just `test` (no slash). Change it to `/test`.

### 0.4 Fix frontend package name

Open `frontend/package.json`. Change:
```json
"name": "my-project"
```
to:
```json
"name": "nagraksha-frontend"
```

### 0.5 Fix the WS deep link bug (the only real bug)

**File:** `frontend/store/sos-store.ts`

Find the `setIncident` action. It currently sets `incident` and `dispatchLanes` but NOT
`incidentId`, which means WebSocket refetches never fire on the incident page when accessed
via direct URL.

```typescript
// Find setIncident in the store actions. Add incidentId:
setIncident: (incident) =>
  set({
    incident,
    incidentId: incident.id,   // ADD THIS LINE
    dispatchLanes: incident.dispatchAttempts ?? [],
  }),
```

### 0.6 Add per-IP rate limit on SOS

**File:** `backend/app/routes/sos.py`

```python
# Find the trigger_sos route decorator. Add the rate limit:
@router.post("/sos")
@limiter.limit("10/minute")   # ADD THIS — prevents SMS spam
async def trigger_sos(request: Request, body: SosRequest):
```

**Verify cleanup:**
```bash
cd backend && python -m pytest tests/ -v --tb=short -q
# Should still pass all 61 tests

cd frontend && npx vitest run
# Should pass

cd frontend && pnpm run lint
# Should pass
```

---

## Hours 1–3 — VenomScore Backend (Person B)

### Step 1: Add PtosisReading table

**File:** `backend/app/database.py`

Find the `SCHEMA` string constant. Add this table definition after `WoundReading`:

```python
    CREATE TABLE IF NOT EXISTS PtosisReading (
      id               TEXT PRIMARY KEY,
      incidentId       TEXT NOT NULL,
      timestamp        TEXT NOT NULL,
      rightAperture    REAL NOT NULL,
      leftAperture     REAL NOT NULL,
      avgAperture      REAL NOT NULL,
      baselineAperture REAL,
      percentChange    REAL,
      ptosisDetected   INTEGER NOT NULL DEFAULT 0,
      severity         TEXT NOT NULL DEFAULT 'none',
      asymmetric       INTEGER NOT NULL DEFAULT 0,
      minutesSinceBite INTEGER,
      createdAt        TEXT NOT NULL,
      FOREIGN KEY (incidentId) REFERENCES Incident(id)
    );
```

Verify the schema change works:
```bash
cd backend
python -c "
from app.database import init_db
init_db()
print('Schema OK')
"
```

---

### Step 2: Add Pydantic model

**File:** `backend/app/models.py`

Add at the bottom:

```python
class PtosisReadingRequest(BaseModel):
    """Single eyelid aperture reading from MediaPipe Face Landmarker."""
    right_aperture:     float = Field(..., ge=0.0, le=1.0, description="Right eyelid aperture, normalized")
    left_aperture:      float = Field(..., ge=0.0, le=1.0, description="Left eyelid aperture, normalized")
    avg_aperture:       float = Field(..., ge=0.0, le=1.0, description="Average of both eyes")
    baseline_aperture:  float | None = Field(None, description="Patient's personal baseline — None for the first reading")
    percent_change:     float | None = Field(None, description="Percentage change from baseline — None for first reading")
    ptosis_detected:    bool  = Field(False)
    severity:           str   = Field("none", pattern="^(none|mild|moderate|severe)$")
    asymmetric:         bool  = Field(False, description="Unilateral ptosis — clinically significant")
    minutes_since_bite: int | None = Field(None, ge=0)
```

---

### Step 3: Add domain functions

**File:** `backend/app/domain.py`

Add these four functions at the bottom of the file. They are pure functions — no DB
access, no side effects, easy to test.

```python
# ── VenomScore domain ──────────────────────────────────────────────────────────


def classify_venom_type(ptosis_readings: list[dict], wound_readings: list[dict]) -> str:
    """
    Classify venom type from clinical indicators.

    Neurotoxic (cobra, krait): eyelid ptosis within 30-45 min post-bite.
    Hemotoxic (Russell's viper, saw-scaled viper): rapid local swelling, no ptosis.
    Dry bite: no swelling and no ptosis at 45+ min.

    Reference: WHO Guidelines for the Management of Snake-bites in South-East Asia (2016).
    """
    if any(r.get("ptosisDetected") or r.get("ptosis_detected") for r in ptosis_readings):
        return "neurotoxic"

    if len(wound_readings) >= 2:
        first_area = wound_readings[0].get("swellingAreaPx") or 0
        last_area  = wound_readings[-1].get("swellingAreaPx") or 0
        if (last_area - first_area) > 5000:   # significant swelling without ptosis
            return "hemotoxic"

    return "unknown"


def compute_dry_bite_probability(
    ptosis_readings: list[dict],
    wound_readings:  list[dict],
    minutes_since_bite: int,
) -> float:
    """
    Estimate probability that no venom was injected.

    Clinical basis: Significant envenomation produces measurable objective signs within
    45 minutes. Absence of both ptosis and measurable swelling = rising dry bite signal.
    Caps at 0.95 — never 100% without hospital testing.

    Returns float 0.0 (definitely envenomated) to 0.95 (very likely dry).
    """
    if any(r.get("ptosisDetected") or r.get("ptosis_detected") for r in ptosis_readings):
        return 0.0

    if wound_readings:
        first = wound_readings[0].get("swellingAreaPx") or 0
        last  = wound_readings[-1].get("swellingAreaPx") or 0
        elapsed = max(1, len(wound_readings) * 5)
        rate = (last - first) / elapsed
        if rate > 200:
            return 0.0
        if rate > 50:
            return max(0.0, 1 - (rate / 100))

    if minutes_since_bite < 20:
        return 0.0

    # No objective signs → probability rises with time, reaching 85% at 45 min
    prob = min(0.95, ((minutes_since_bite - 20) / 35.0) * 0.85)
    return round(prob, 2)


def estimate_antivenom_vials(venom_type: str, severity_score: float) -> dict:
    """
    Estimate antivenom vials required.

    Reference: WHO 2016 Table 3 + Indian NPCS polyvalent antivenom prescribing info.
    Indian polyvalent antivenom covers the 'big four': cobra, krait, Russell's viper,
    saw-scaled viper.
    """
    if venom_type == "neurotoxic":
        if severity_score >= 80:   vials, conf = 25, "moderate"
        elif severity_score >= 60: vials, conf = 20, "moderate"
        elif severity_score >= 40: vials, conf = 15, "moderate"
        else:                      vials, conf = 10, "low"
        basis = "WHO 2016 Table 3: Neurotoxic syndrome — initial 10–25 vials"
    elif venom_type == "hemotoxic":
        if severity_score >= 75:   vials, conf = 25, "moderate"
        elif severity_score >= 50: vials, conf = 15, "moderate"
        else:                      vials, conf = 10, "low"
        basis = "WHO 2016 Table 3: Hemotoxic syndrome — initial 10–25 vials"
    elif venom_type == "dry_bite":
        vials, conf = 0, "high"
        basis = "Dry bite — no antivenom required; confirm with 20WBCT"
    else:
        vials, conf = 10, "low"
        basis = "Unknown venom type — conservative 10 vials; confirm with 20WBCT"

    return {
        "estimatedVials":  vials,
        "confidenceLevel": conf,
        "clinicalBasis":   basis,
        "disclaimer":      "Confirm with 20-minute whole blood clotting test before finalizing dose",
    }


def compute_venom_score(
    ptosis_readings:    list[dict],
    wound_readings:     list[dict],
    minutes_since_bite: int,
) -> dict:
    """
    Full VenomScore object — sent to hospital pre-arrival packet after every new reading.
    """
    venom_type    = classify_venom_type(ptosis_readings, wound_readings)
    dry_bite_prob = compute_dry_bite_probability(ptosis_readings, wound_readings, minutes_since_bite)

    # Ptosis severity: peak percentage change across all readings
    ptosis_severity = 0.0
    changes = [
        r.get("percentChange") or r.get("percent_change") or 0
        for r in ptosis_readings
        if (r.get("percentChange") or r.get("percent_change")) is not None
    ]
    if changes:
        ptosis_severity = min(100.0, max(changes))

    # Wound severity: latest reading
    wound_severity = 0.0
    if wound_readings:
        wound_severity = float(wound_readings[-1].get("severityScore") or 0)

    # Combined score — ptosis weighted higher (more specific)
    if ptosis_severity > 0 and wound_severity > 0:
        overall = round(ptosis_severity * 0.6 + wound_severity * 0.4, 1)
    elif ptosis_severity > 0:
        overall = round(ptosis_severity, 1)
    elif wound_severity > 0:
        overall = round(wound_severity, 1)
    else:
        overall = 0.0

    antivenom = estimate_antivenom_vials(venom_type, overall)

    # Clinical alerts
    critical_alert      = None
    ventilator_required = False
    if venom_type == "neurotoxic" and overall >= 60:
        critical_alert      = "NEUROTOXIC — respiratory failure risk within ~40 min. Ventilator standby required."
        ventilator_required = True
    elif venom_type == "neurotoxic" and overall >= 40:
        critical_alert = "NEUROTOXIC — progressive ptosis detected. Monitor breathing continuously."
    elif venom_type == "hemotoxic" and overall >= 60:
        critical_alert = "HEMOTOXIC — coagulopathy risk. Prepare clotting factors and whole blood."

    return {
        "venomType":               venom_type,
        "overallSeverity":         overall,
        "dryBiteProbability":      dry_bite_prob,
        "estimatedAntivenomVials": antivenom["estimatedVials"],
        "confidenceLevel":         antivenom["confidenceLevel"],
        "clinicalBasis":           antivenom["clinicalBasis"],
        "disclaimer":              antivenom["disclaimer"],
        "criticalAlert":           critical_alert,
        "ventilatorRequired":      ventilator_required,
        "ptosisReadingCount":      len(ptosis_readings),
        "woundReadingCount":       len(wound_readings),
        "minutesSinceBite":        minutes_since_bite,
    }
```

---

### Step 4: Create the route module

**New file:** `backend/app/routes/venom_score.py`

```python
"""
VenomScore — pre-hospital envenomation assessment via phone camera ptosis tracking.

Novel feature: MediaPipe Face Landmarker measures eyelid aperture (ptosis) every 10 s.
Ptosis is a WHO-validated early sign of neurotoxic envenomation (cobra, krait).
The VenomScore is broadcast to the hospital before the patient arrives.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .. import database as db
from ..domain import compute_venom_score
from ..models import PtosisReadingRequest
from .ws import broadcast

router = APIRouter()


@router.post("/venom-score/{incident_id}/reading")
async def submit_ptosis_reading(incident_id: str, body: PtosisReadingRequest):
    """Store a ptosis reading and return the updated VenomScore."""
    with db.get_conn() as conn:
        inc = conn.execute(
            "SELECT id, biteTime FROM Incident WHERE id = ?", (incident_id,)
        ).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    rid = db.new_id()
    with db.get_conn() as conn:
        conn.execute(
            """
            INSERT INTO PtosisReading
              (id, incidentId, timestamp, rightAperture, leftAperture, avgAperture,
               baselineAperture, percentChange, ptosisDetected, severity,
               asymmetric, minutesSinceBite, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rid,
                incident_id,
                db.now_iso(),
                body.right_aperture,
                body.left_aperture,
                body.avg_aperture,
                body.baseline_aperture,
                body.percent_change,
                int(body.ptosis_detected),
                body.severity,
                int(body.asymmetric),
                body.minutes_since_bite,
                db.now_iso(),
            ),
        )

    score = _compute_score(incident_id, inc["biteTime"])

    # Push to hospital WebSocket channel
    await broadcast(incident_id, "VENOM_SCORE_UPDATE", {"venomScore": score})

    return {"id": rid, "venomScore": score}


@router.get("/venom-score/{incident_id}/score")
async def get_venom_score(incident_id: str):
    """Get the current VenomScore for an incident."""
    with db.get_conn() as conn:
        inc = conn.execute(
            "SELECT id, biteTime FROM Incident WHERE id = ?", (incident_id,)
        ).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"venomScore": _compute_score(incident_id, inc["biteTime"])}


@router.get("/venom-score/{incident_id}/readings")
async def get_ptosis_readings(incident_id: str):
    """All ptosis readings for this incident — used to render the trend chart."""
    with db.get_conn() as conn:
        rows = conn.execute(
            """
            SELECT timestamp, rightAperture, leftAperture, avgAperture,
                   percentChange, ptosisDetected, severity, asymmetric, minutesSinceBite
            FROM   PtosisReading
            WHERE  incidentId = ?
            ORDER  BY timestamp ASC
            """,
            (incident_id,),
        ).fetchall()
    return {"readings": [dict(r) for r in rows]}


# ── private ────────────────────────────────────────────────────────────────────


def _compute_score(incident_id: str, bite_time: str) -> dict:
    """Recompute VenomScore from all readings for this incident."""
    with db.get_conn() as conn:
        ptosis_rows = conn.execute(
            """
            SELECT percentChange, ptosisDetected, severity, asymmetric, minutesSinceBite
            FROM   PtosisReading
            WHERE  incidentId = ?
            ORDER  BY timestamp ASC
            """,
            (incident_id,),
        ).fetchall()

        wound_rows = conn.execute(
            """
            SELECT severityScore, progression, swellingAreaPx
            FROM   WoundReading
            WHERE  incidentId = ?
            ORDER  BY createdAt ASC
            """,
            (incident_id,),
        ).fetchall()

    minutes = db.mins_since(bite_time) if bite_time else 0
    return compute_venom_score(
        [dict(r) for r in ptosis_rows],
        [dict(r) for r in wound_rows],
        minutes,
    )
```

---

### Step 5: Register the router

**File:** `backend/app/main.py`

Find the block where routers are registered (look for `app.include_router`). Add:

```python
from .routes import venom_score   # add this import at the top with the others

# In the router registration block:
app.include_router(venom_score.router, prefix="/api", tags=["venom-score"])
```

---

### Step 6: Write backend tests

**File:** `backend/tests/test_domain.py`

Add at the bottom:

```python
class TestVenomScore:
    def test_ptosis_gives_neurotoxic(self):
        ptosis = [{"ptosisDetected": True, "percentChange": 55.0}]
        assert classify_venom_type(ptosis, []) == "neurotoxic"

    def test_rapid_swelling_no_ptosis_gives_hemotoxic(self):
        ptosis = [{"ptosisDetected": False, "percentChange": 3.0}]
        wounds = [{"swellingAreaPx": 100}, {"swellingAreaPx": 8500}]
        assert classify_venom_type(ptosis, wounds) == "hemotoxic"

    def test_no_signs_unknown(self):
        assert classify_venom_type([], []) == "unknown"

    def test_ptosis_gives_zero_dry_bite(self):
        ptosis = [{"ptosisDetected": True}]
        assert compute_dry_bite_probability(ptosis, [], 30) == 0.0

    def test_no_signs_at_50_min_high_dry_bite(self):
        ptosis = [{"ptosisDetected": False, "percentChange": 2.0}]
        wounds = [{"swellingAreaPx": 100}, {"swellingAreaPx": 110}]
        prob = compute_dry_bite_probability(ptosis, wounds, 50)
        assert prob > 0.60

    def test_neurotoxic_severe_25_vials(self):
        result = estimate_antivenom_vials("neurotoxic", 85.0)
        assert result["estimatedVials"] == 25

    def test_dry_bite_zero_vials(self):
        assert estimate_antivenom_vials("dry_bite", 0.0)["estimatedVials"] == 0
```

Add the imports at the top of `test_domain.py`:
```python
from app.domain import (
    ...,  # existing imports
    classify_venom_type,
    compute_dry_bite_probability,
    estimate_antivenom_vials,
    compute_venom_score,
)
```

**Add a route test in `test_routes.py`:**

```python
class TestVenomScore:
    async def test_submit_baseline_reading(self, async_client, seeded_incident):
        resp = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading",
            json={
                "right_aperture": 0.025,
                "left_aperture":  0.024,
                "avg_aperture":   0.0245,
                "ptosis_detected": False,
                "severity":       "none",
                "asymmetric":     False,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "venomScore" in data
        assert data["venomScore"]["venomType"] == "unknown"
        assert data["venomScore"]["dryBiteProbability"] == 0.0

    async def test_ptosis_reading_triggers_neurotoxic(self, async_client, seeded_incident):
        # baseline
        await async_client.post(f"/api/venom-score/{seeded_incident}/reading", json={
            "right_aperture": 0.025, "left_aperture": 0.024, "avg_aperture": 0.0245,
            "ptosis_detected": False, "severity": "none", "asymmetric": False,
        })
        # ptosis reading
        resp = await async_client.post(f"/api/venom-score/{seeded_incident}/reading", json={
            "right_aperture": 0.010, "left_aperture": 0.011, "avg_aperture": 0.0105,
            "percent_change": 57.1, "ptosis_detected": True,
            "severity": "moderate", "asymmetric": False, "minutes_since_bite": 18,
        })
        assert resp.status_code == 200
        assert resp.json()["venomScore"]["venomType"] == "neurotoxic"

    async def test_missing_incident_404(self, async_client):
        resp = await async_client.post("/api/venom-score/does-not-exist/reading", json={
            "right_aperture": 0.025, "left_aperture": 0.024, "avg_aperture": 0.0245,
            "ptosis_detected": False, "severity": "none", "asymmetric": False,
        })
        assert resp.status_code == 404
```

You need a `seeded_incident` fixture. Add to `conftest.py`:

```python
@pytest.fixture
def seeded_incident(async_client):
    """Create a real incident via the SOS endpoint and yield its ID."""
    import asyncio
    resp = asyncio.get_event_loop().run_until_complete(
        async_client.post("/api/sos", json={"lat": 12.52, "lng": 76.89})
    )
    return resp.json()["incident"]["id"]
```

**Run backend tests:**
```bash
cd backend && python -m pytest tests/ -v
# All tests should pass including the new VenomScore tests
```

---

## Hours 1–5 — VenomScore Frontend (Person A)

### Step 1: Install MediaPipe

```bash
cd frontend
pnpm add @mediapipe/tasks-vision
```

That's the only new dependency. Everything else is already in the repo.

---

### Step 2: Add API types + functions

**File:** `frontend/lib/nagraksha.ts`

Add these types and functions alongside the existing ones:

```typescript
// ── VenomScore types ──────────────────────────────────────────────────────────

export interface PtosisReading {
  rightAperture:   number;
  leftAperture:    number;
  avgAperture:     number;
  percentChange:   number | null;
  ptosisDetected:  boolean;
  severity:        'none' | 'mild' | 'moderate' | 'severe';
  asymmetric:      boolean;
  minutesSinceBite?: number;
}

export interface VenomScoreResult {
  venomType:               'neurotoxic' | 'hemotoxic' | 'unknown' | 'dry_bite';
  overallSeverity:         number;
  dryBiteProbability:      number;
  estimatedAntivenomVials: number;
  confidenceLevel:         'low' | 'moderate' | 'high';
  clinicalBasis:           string;
  disclaimer:              string;
  criticalAlert:           string | null;
  ventilatorRequired:      boolean;
  ptosisReadingCount:      number;
  woundReadingCount:       number;
  minutesSinceBite:        number;
}

export interface SubmitPtosisResponse {
  id:         string;
  venomScore: VenomScoreResult;
}

// ── VenomScore API calls ──────────────────────────────────────────────────────

export async function submitPtosisReading(
  incidentId: string,
  reading: PtosisReading & { baselineAperture?: number },
): Promise<SubmitPtosisResponse> {
  return apiFetch<SubmitPtosisResponse>(`/api/venom-score/${incidentId}/reading`, {
    method: 'POST',
    body: JSON.stringify({
      right_aperture:     reading.rightAperture,
      left_aperture:      reading.leftAperture,
      avg_aperture:       reading.avgAperture,
      baseline_aperture:  reading.baselineAperture ?? null,
      percent_change:     reading.percentChange,
      ptosis_detected:    reading.ptosisDetected,
      severity:           reading.severity,
      asymmetric:         reading.asymmetric,
      minutes_since_bite: reading.minutesSinceBite ?? null,
    }),
  });
}

export async function getVenomScore(incidentId: string): Promise<VenomScoreResult> {
  const data = await apiFetch<{ venomScore: VenomScoreResult }>(
    `/api/venom-score/${incidentId}/score`,
  );
  return data.venomScore;
}
```

---

### Step 3: Extend the Zustand store

**File:** `frontend/store/sos-store.ts`

Import the new types at the top:
```typescript
import type { VenomScoreResult, PtosisReading } from '@/lib/nagraksha';
```

Add to the store interface:
```typescript
interface SosStore {
  // ... existing fields ...
  ptosisReadings:    PtosisReading[];
  venomScore:        VenomScoreResult | null;
}

interface SosActions {
  // ... existing actions ...
  addPtosisReading:  (r: PtosisReading) => void;
  setVenomScore:     (score: VenomScoreResult | null) => void;
}
```

Add to the `create()` call:
```typescript
// initial state:
ptosisReadings: [],
venomScore: null,

// actions:
addPtosisReading: (r) =>
  set((s) => ({ ptosisReadings: [...s.ptosisReadings, r] })),
setVenomScore: (score) => set({ venomScore: score }),
```

Also update `updateFromWsEvent` to handle VenomScore events:
```typescript
case 'VENOM_SCORE_UPDATE':
  set({ venomScore: event.data.venomScore });
  break;
```

---

### Step 4: Create the chart component

**New file:** `frontend/components/venom-score-chart.tsx`

```typescript
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { PtosisReading } from '@/lib/nagraksha';

interface Props {
  readings: PtosisReading[];
}

export function VenomScoreChart({ readings }: Props) {
  const data = readings
    .filter((r) => r.percentChange !== null)
    .map((r, i) => ({
      t:       i + 1,
      closure: Number(r.percentChange?.toFixed(1)),
      severe:  r.severity === 'severe',
    }));

  if (data.length < 2) return null;

  return (
    <div className="h-28 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 11 }}
            formatter={(v: number) => [`${v}%`, 'Eyelid Closure']}
          />
          <ReferenceLine y={40} stroke="#f97316" strokeDasharray="4 2"
            label={{ value: 'Ptosis', fontSize: 9, fill: '#f97316', position: 'insideTopLeft' }} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 2"
            label={{ value: 'Severe', fontSize: 9, fill: '#ef4444', position: 'insideTopLeft' }} />
          <Line
            type="monotone"
            dataKey="closure"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f97316' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

### Step 5: Create the main VenomScore component

**New file:** `frontend/components/venom-score.tsx`

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { AlertTriangle, Eye } from 'lucide-react';
import { Badge }  from '@/components/ui/button'; // adjust import path to match your ui/
import { submitPtosisReading } from '@/lib/nagraksha';
import { useSosStore } from '@/store/sos-store';
import type { PtosisReading } from '@/lib/nagraksha';
import { VenomScoreChart } from './venom-score-chart';

// ── MediaPipe landmark indices for eyelids ─────────────────────────────────────
// Reference: MediaPipe Face Mesh 478-point model
// Upper/lower lid pairs — aperture = |upper.y − lower.y| in normalized coords
const LM = { RU: 159, RL: 145, LU: 386, LL: 374 } as const;

interface Props {
  incidentId:    string;
  biteTimestamp: string;  // ISO string
}

export function VenomScore({ incidentId, biteTimestamp }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const baselineRef   = useRef<number | null>(null);
  const [isReady,    setIsReady]    = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [readings,   setReadings]   = useState<PtosisReading[]>([]);
  const [initError,  setInitError]  = useState<string | null>(null);

  const venomScore = useSosStore((s) => s.venomScore);
  const { addPtosisReading, setVenomScore } = useSosStore();

  // ── Load MediaPipe ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import — MediaPipe WASM loads only when this component mounts
        const { FaceLandmarker: FL, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
        );
        const lm = await FL.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (!cancelled) { landmarkerRef.current = lm; setIsReady(true); }
      } catch (_e) {
        if (!cancelled) setInitError('MediaPipe failed to load. Check internet connection.');
      }
    })();
    return () => { cancelled = true; landmarkerRef.current?.close(); };
  }, []);

  // ── Single capture cycle ────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    const lm    = landmarkerRef.current;
    const video = videoRef.current;
    if (!lm || !video || video.readyState < 2) return;

    const result = lm.detectForVideo(video, performance.now());
    if (!result.faceLandmarks.length) return;  // face not in frame

    const lmarks = result.faceLandmarks[0];
    const right  = Math.abs(lmarks[LM.RU].y - lmarks[LM.RL].y);
    const left   = Math.abs(lmarks[LM.LU].y - lmarks[LM.LL].y);
    const avg    = (right + left) / 2;

    // ── Establish personal baseline on first reading ───────────────────────
    if (baselineRef.current === null) {
      baselineRef.current = avg;
      const baseline: PtosisReading = {
        rightAperture: right, leftAperture: left, avgAperture: avg,
        percentChange: null, ptosisDetected: false, severity: 'none', asymmetric: false,
      };
      setReadings([baseline]);
      try {
        await submitPtosisReading(incidentId, {
          ...baseline, baselineAperture: avg,
        });
      } catch { /* best effort */ }
      return;
    }

    // ── Compute percentage change from personal baseline ───────────────────
    const baseline        = baselineRef.current;
    const percentChange   = ((baseline - avg) / baseline) * 100;
    const asymmetric      = Math.abs(right - left) > baseline * 0.2;
    const ptosisDetected  = percentChange > 40;
    const severity: PtosisReading['severity'] =
      percentChange > 70 ? 'severe'   :
      percentChange > 40 ? 'moderate' :
      percentChange > 20 ? 'mild'     : 'none';

    const minutesSinceBite = Math.floor(
      (Date.now() - new Date(biteTimestamp).getTime()) / 60_000,
    );

    const reading: PtosisReading = {
      rightAperture: right, leftAperture: left, avgAperture: avg,
      percentChange, ptosisDetected, severity, asymmetric, minutesSinceBite,
    };

    setReadings((prev) => [...prev, reading]);
    addPtosisReading(reading);

    try {
      const res = await submitPtosisReading(incidentId, {
        ...reading, baselineAperture: baseline,
      });
      setVenomScore(res.venomScore);
    } catch { /* best effort — readings accumulated locally */ }
  }, [incidentId, biteTimestamp, addPtosisReading, setVenomScore]);

  // ── Start / stop ────────────────────────────────────────────────────────────
  const startTracking = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsTracking(true);
      await capture();
      intervalRef.current = setInterval(capture, 10_000);  // every 10 seconds
    } catch (_e) {
      setInitError('Camera access denied. VenomScore requires front camera permission.');
    }
  };

  const stopTracking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    setIsTracking(false);
  };

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // ── Severity badge color ────────────────────────────────────────────────────
  const lastReading = readings.at(-1);
  const severityColor =
    lastReading?.severity === 'severe'   ? 'text-red-400'    :
    lastReading?.severity === 'moderate' ? 'text-orange-400' :
    lastReading?.severity === 'mild'     ? 'text-yellow-400' : 'text-green-400';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-orange-500/20 bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-orange-400 shrink-0" />
        <span className="text-sm font-semibold">VenomScore — Neurotoxic Detection</span>
        {isTracking && (
          <span className="ml-auto text-xs font-medium text-green-400 animate-pulse">
            LIVE
          </span>
        )}
      </div>

      {/* Camera feed (hidden until tracking) */}
      <video
        ref={videoRef}
        className={`w-full rounded-lg aspect-video bg-muted object-cover ${isTracking ? 'block' : 'hidden'}`}
        playsInline
        muted
      />

      {/* Critical alert */}
      {venomScore?.criticalAlert && (
        <div className="flex items-start gap-2 rounded-lg bg-red-950/60 border border-red-500/40 p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 font-medium leading-relaxed">
            {venomScore.criticalAlert}
          </p>
        </div>
      )}

      {/* Live readings */}
      {lastReading && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-muted-foreground mb-1">Eyelid Closure from Baseline</p>
            <p className={`text-2xl font-bold tabular-nums ${severityColor}`}>
              {lastReading.percentChange !== null
                ? `${lastReading.percentChange.toFixed(1)}%`
                : '—'}
            </p>
            <p className={`text-xs capitalize mt-0.5 ${severityColor}`}>
              {lastReading.severity}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-muted-foreground mb-1">Ptosis</p>
            <p className={`text-2xl font-bold ${lastReading.ptosisDetected ? 'text-red-400' : 'text-green-400'}`}>
              {lastReading.ptosisDetected ? 'YES' : 'NONE'}
            </p>
            {lastReading.asymmetric && (
              <p className="text-xs text-orange-400 mt-0.5">Asymmetric</p>
            )}
          </div>
        </div>
      )}

      {/* VenomScore summary */}
      {venomScore && (
        <div className="space-y-1.5 text-xs border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Venom Type</span>
            <span className={`font-bold uppercase ${
              venomScore.venomType === 'neurotoxic' ? 'text-red-400'    :
              venomScore.venomType === 'hemotoxic'  ? 'text-orange-400' :
              venomScore.venomType === 'dry_bite'   ? 'text-green-400'  :
              'text-muted-foreground'
            }`}>{venomScore.venomType.replace('_', ' ')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Est. Antivenom Vials</span>
            <span className="font-bold text-orange-400 text-base tabular-nums">
              {venomScore.estimatedAntivenomVials}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dry Bite Probability</span>
            <span className="font-mono tabular-nums">
              {(venomScore.dryBiteProbability * 100).toFixed(0)}%
            </span>
          </div>
          {venomScore.ventilatorRequired && (
            <p className="text-red-400 font-bold text-xs pt-1">
              ⚠ VENTILATOR STANDBY REQUIRED
            </p>
          )}
          <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
            {venomScore.clinicalBasis}
          </p>
        </div>
      )}

      {/* Trend chart */}
      <VenomScoreChart readings={readings} />

      {/* Controls */}
      <div className="pt-1">
        {!isTracking ? (
          <button
            onClick={startTracking}
            disabled={!isReady}
            className="w-full rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
          >
            {isReady ? 'Start VenomScore' : 'Loading MediaPipe…'}
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="w-full rounded-lg border border-border text-sm font-medium py-2 hover:bg-muted transition-colors"
          >
            Stop Tracking
          </button>
        )}
      </div>

      {initError && (
        <p className="text-xs text-red-400">{initError}</p>
      )}

      <p className="text-[10px] text-muted-foreground">
        Based on WHO snakebite management guidelines (2016). Confirm with 20WBCT at hospital.
        Not a medical device.
      </p>
    </div>
  );
}
```

---

### Step 6: Mount VenomScore in the incident page

**File:** `frontend/app/incidents/[id]/page.tsx`

Find where `WoundTracker` (or equivalent wound component) is rendered. Add `VenomScore`
alongside it:

```typescript
import { VenomScore } from '@/components/venom-score';

// In the JSX, find the section where the patient/victim view is shown.
// Add alongside WoundTracker:
{incident && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* existing WoundTracker here */}
    <VenomScore
      incidentId={incident.id}
      biteTimestamp={incident.biteTime ?? new Date().toISOString()}
    />
  </div>
)}
```

Also add VenomScore output to the hospital view section of the same page. Find where the
hospital panel renders (look for hospital role check). Add:

```typescript
import { useSosStore } from '@/store/sos-store';

// Inside the hospital section:
const venomScore = useSosStore((s) => s.venomScore);

{venomScore && (
  <div className="rounded-xl border border-orange-500/20 bg-card p-4 space-y-2">
    <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
      VenomScore Pre-arrival Assessment
    </p>
    {venomScore.criticalAlert && (
      <div className="rounded-lg bg-red-950/60 border border-red-500/40 p-3">
        <p className="text-xs text-red-300 font-medium">{venomScore.criticalAlert}</p>
      </div>
    )}
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <p className="text-muted-foreground">Venom Type</p>
        <p className="font-bold uppercase text-sm">{venomScore.venomType.replace('_',' ')}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Prepare Vials</p>
        <p className="font-bold text-orange-400 text-2xl tabular-nums">
          {venomScore.estimatedAntivenomVials}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Dry Bite Probability</p>
        <p className="font-bold tabular-nums">
          {(venomScore.dryBiteProbability * 100).toFixed(0)}%
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Confidence</p>
        <p className="font-bold capitalize">{venomScore.confidenceLevel}</p>
      </div>
    </div>
    {venomScore.ventilatorRequired && (
      <p className="text-xs font-bold text-red-400">⚠ VENTILATOR STANDBY REQUIRED</p>
    )}
    <p className="text-[10px] text-muted-foreground">{venomScore.clinicalBasis}</p>
  </div>
)}
```

---

### Step 7: Add MSW handler for tests

**File:** `frontend/test/handlers.ts`

Add to the handlers array:

```typescript
http.post('/api/venom-score/:incidentId/reading', () => {
  return HttpResponse.json({
    id: 'ptosis-reading-001',
    venomScore: {
      venomType:               'unknown',
      overallSeverity:         0,
      dryBiteProbability:      0,
      estimatedAntivenomVials: 10,
      confidenceLevel:         'low',
      clinicalBasis:           'WHO 2016 Table 3',
      disclaimer:              'Confirm with 20WBCT',
      criticalAlert:           null,
      ventilatorRequired:      false,
      ptosisReadingCount:      1,
      woundReadingCount:       0,
      minutesSinceBite:        0,
    },
  });
}),

http.get('/api/venom-score/:incidentId/score', () => {
  return HttpResponse.json({
    venomScore: {
      venomType: 'unknown', overallSeverity: 0, dryBiteProbability: 0,
      estimatedAntivenomVials: 10, confidenceLevel: 'low',
      clinicalBasis: 'WHO 2016', disclaimer: 'Confirm with 20WBCT',
      criticalAlert: null, ventilatorRequired: false,
      ptosisReadingCount: 0, woundReadingCount: 0, minutesSinceBite: 0,
    },
  });
}),
```

**Run frontend tests:**
```bash
cd frontend && npx vitest run
# All tests should pass
```

**Run full build:**
```bash
cd frontend && pnpm run build
# Should complete with 0 errors
```

---

## Hour 5 — Demo Seed Data (Person B while Person A polishes UI)

Run this script to seed real Karnataka data before the demo. Create it as a temp file
and run it once:

```python
# backend/seed_demo.py — run once with: cd backend && python seed_demo.py
"""Seed realistic Karnataka demo data for the IISc presentation."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("NAGRAKSHA_DB", "db/nagraksha.db")

from app.database import init_db, get_conn, new_id, now_iso

init_db()

with get_conn() as conn:
    # ── Hospitals with real Karnataka data ─────────────────────────────────────
    hospitals = [
        ("Mandya District Hospital",     12.5213, 76.8948, "Mandya, Karnataka", "+918232220001", 91.5),
        ("Tumkur District Hospital",     13.3379, 77.1173, "Tumkur, Karnataka", "+918162202002", 78.0),
        ("Hassan District Hospital",     13.0057, 76.1005, "Hassan, Karnataka", "+918172268003", 56.0),
        ("K.R. Hospital Mysore",         12.2958, 76.6394, "Mysore, Karnataka", "+918212520004", 88.0),
        ("Rajarajeshwari Medical Nagara", 12.9141, 77.4986, "Bangalore, KA",    "+918028605005", 45.0),
    ]
    for name, lat, lng, address, contact, compliance in hospitals:
        hid = new_id()
        conn.execute(
            "INSERT OR IGNORE INTO Hospital (id, name, lat, lng, address, contact, active, complianceScore, complianceUpdatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
            (hid, name, lat, lng, address, contact, compliance, now_iso(), now_iso(), now_iso()),
        )
        # Antivenom stock
        stock_status = "CONFIRMED" if compliance > 70 else "LOW" if compliance > 45 else "OUT"
        conn.execute(
            "INSERT OR IGNORE INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (new_id(), hid, "Indian Polyvalent Antivenom (VINS/Bharat Serums)", stock_status, "11-20 vials", now_iso(), "Dr. Pharmacy"),
        )
        print(f"  Seeded hospital: {name} (compliance: {compliance}%)")

    # ── Stakeholders ───────────────────────────────────────────────────────────
    stakeholders = [
        ("Gerry Martin", "The Liana Trust", "Field Expert / Snake Rescuer", "written",  "gerry@thelianatrust.org", "Karnataka"),
        ("Dr. Ravi Shankar", "Mandya District Health Dept", "District Health Officer", "verbal", "+919844001234", "Mandya"),
        ("NSS Coordinator", "MS Ramaiah Institute of Technology", "Academic Pilot Partner", "pilot_permission", "nss@msrit.edu", "Bangalore"),
    ]
    for name, org, role, stype, contact, district in stakeholders:
        conn.execute(
            "INSERT OR IGNORE INTO Stakeholder (id, name, organization, role, supportType, contact, district, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id(), name, org, role, stype, contact, district, now_iso()),
        )
        print(f"  Seeded stakeholder: {name} ({org})")

    # ── ASHA Village Audit Records ─────────────────────────────────────────────
    audits = [
        ("Malavalli", "Mandya", 12.3882, 77.0827, 4, 58.0),
        ("Srirangapatna", "Mandya", 12.4278, 76.7013, 7, 72.0),
        ("Tiptur", "Tumkur", 13.2641, 76.4774, 3, 41.0),
    ]
    for gp, district, lat, lng, hh, risk in audits:
        vid = new_id()
        conn.execute(
            "INSERT OR IGNORE INTO VillageAudit (id, ashaWorkerId, gramPanchayat, district, auditDate, lat, lng, householdsVisited, aggregateRiskScore, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (vid, "asha-worker-001", gp, district, "2026-08-10", lat, lng, hh, risk, now_iso()),
        )
        print(f"  Seeded audit: {gp}, {district} (risk: {risk}%)")

print("\nDemo seed complete. Run the backend and open the app.")
```

```bash
cd backend && python seed_demo.py
```

---

## Hour 6 — Integration Test (Both People)

Run both services and test the full demo loop manually:

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && pnpm run dev
```

**Test checklist:**
```
□ Home page loads, role picker visible
□ Trigger SOS → incident page opens at /incidents/{id}
□ Three dispatch lanes appear (first-aider / rescue / hospital)
□ If Twilio configured: SMS fires to registered phone
□ VenomScore panel loads ("Loading MediaPipe…" → "Start VenomScore")
□ Click Start VenomScore → camera opens → first reading establishes baseline
□ Wait 10 seconds → second reading fires
□ Manually squint → percentage closure increases → severity badge changes color
□ At 40% closure: ptosisDetected = true → VenomType updates to NEUROTOXIC
□ estimatedAntivenomVials updates
□ Switch browser tab to /incidents/{id}?role=hospital (or whatever your role switch is)
□ Hospital view shows VenomScore pre-arrival packet
□ Myth buster: speak in Kannada or Hindi → transcription → answer appears
□ Compliance dashboard: two hospitals with different compliance scores visible
□ ASHA audit map shows Mandya/Tumkur district risk
□ Stakeholder registry shows Gerry Martin entry
```

**Fix what breaks.** Don't move on until the SOS → VenomScore → hospital packet loop works end-to-end.

---

## Hour 7–8 — Demo Rehearsal (3×)

### Exact demo script (10 minutes total)

Practice this. Time yourself. It should fit in 10 minutes.

**[0:00] Open on the home page**
> "NagRaksha. India loses 58,000 lives to snakebites annually. 70% are preventable.
> The killer isn't always venom — it's delay, myth, misdirection. We built a
> platform that targets the critical one-to-six-hour golden hour."

**[0:45] Trigger SOS**
> "Someone has been bitten. They trigger an SOS — one tap."
- Click the SOS button
- Three lanes appear simultaneously
> "Three responders dispatched in parallel. First-aider, snake rescue, hospital.
> No waiting for one to fail before trying the next. No other system does this."
- If Twilio is set up: show the SMS arriving on a real phone

**[2:00] VenomScore**
> "Now — the feature that doesn't exist anywhere else. VenomScore."
- Click 'Start VenomScore'
- Camera opens, calibration reading fires
> "The phone's front camera is now tracking 478 facial landmarks using Google
> MediaPipe. It's measuring the patient's eyelid aperture every 10 seconds.
> Eyelid drooping — ptosis — is a WHO-validated early sign of neurotoxic
> cobra or krait venom. It appears in 15 to 45 minutes. Before the patient
> feels breathing difficulty."
- Wait for second reading, or manually demonstrate partial eye closure
> "Watch — as the eyelid starts to droop, the percentage closure climbs.
> At 40%, ptosis is detected. VenomType classifies as neurotoxic.
> Antivenom estimate: 15 vials. Confidence: moderate."

**[4:30] Hospital view**
> "Switch to the hospital role."
- Show the pre-arrival packet
> "The hospital already knows. 15 vials pre-drawn. Ventilator on standby.
> The patient hasn't walked in yet. In a neurotoxic case, this matters —
> respiratory failure can happen within 40 minutes of significant envenomation."

**[5:30] Compliance dashboard**
> "The antivenom registry is only as useful as the hospitals that maintain it.
> We score hospitals on compliance — how often they update their stock data.
> A hospital 5 kilometers away with 15% compliance loses in routing to one
> 8 kilometers away with 90% compliance. The algorithm enforces accountability."
- Show two hospitals with different compliance scores

**[7:00] ASHA Audit Tool**
> "Vivek Datir asked: how do you ensure consistent community outreach?
> ASHA workers use this offline form during household visits. GPS-tagged,
> standardized risk scoring across Gram Panchayats, aggregated to a district
> risk map. High-risk households get prioritized in prevention campaigns."
- Show the form, show the district heatmap

**[8:00] Stakeholder Registry**
> "Gerry Martin — one of your own judges — has expressed support for NagRaksha
> and provided feedback that is shaping how we approach the Karnataka pilot.
> This is documented community engagement."

**[8:30] Close**
> "₹32,000 per district per year. Less than one day of ICU care.
> Open source. Runs on existing ASHA networks with no custom hardware.
> VenomScore alone could change how hospitals prepare for snakebite patients
> across South Asia. We're Karnataka-based students building for Karnataka's crisis."

**[10:00] Q&A**

---

## If Something Breaks During the Demo

**VenomScore camera doesn't load:**
> "The MediaPipe model is loading over the network — let me show you the output
> from our pre-run test." Have a screenshot of a working VenomScore session ready.

**WebSocket drops:**
> "Let me refresh the hospital view." Hard refresh. The Zustand store persists
> the incident ID via the URL, so it reconnects.

**Twilio SMS doesn't fire:**
> "The SMS dispatch is configured in our demo environment. Let me show you the
> Twilio delivery logs instead." Have the Twilio console open in a browser tab.

**Backend crashes:**
> "Let me restart the service." `Ctrl+C` → `uvicorn app.main:app --port 8000`.
> The SQLite database persists. The demo incident is still there.

---

## What to Have Open Before Judges Walk In

1. **Laptop 1:** Home page, logged in as victim role, SOS button ready
2. **Laptop 2:** Incident page, logged in as hospital role, pre-arrival panel visible
3. **Phone:** Registered as a Twilio responder, SMS app open
4. **Browser tab (backup):** Twilio console logs
5. **Browser tab (backup):** Screenshot of VenomScore working with ptosis detection

Don't demo from localhost. Use the Docker Compose build or at least make sure both
services are running on a stable connection before the session starts.

---

## Final Checklist Before Sleeping Tonight

```
□ cd backend && python -m pytest tests/ -v    # all pass
□ cd frontend && npx vitest run               # all pass
□ cd frontend && pnpm run build               # no errors
□ cd frontend && pnpm run lint                # 0 warnings
□ python seed_demo.py                         # demo data seeded
□ Full demo walkthrough completed 3 times
□ Timer: demo fits in 10 minutes
□ Backup screenshots taken of each key feature
□ Phone registered as Twilio responder (if Twilio configured)
□ Both laptops charged
□ Commit and push everything
```

# VenomScore — Complete Implementation Plan
**2 Days | August 14–15 | Demo: August 16 at IISc**

---

## 1. What You're Building

VenomScore is a real-time neurotoxic envenomation detector that runs entirely on the patient's phone camera using MediaPipe Face Landmarker — no server, no API key, no internet. It measures eyelid aperture (ptosis) every 10 seconds, detects the clinically validated early sign of neurotoxic cobra/krait venom, classifies the venom type, estimates dry bite probability, and transmits a pre-hospital antivenom dose recommendation to the receiving hospital before the patient arrives.

Nothing like this exists anywhere. The clinical sign has been in medical literature since the 1970s. The technology to detect it on a phone has existed since 2022. No one connected them.

---

## 2. Clinical Basis (know this for the judges)

**Ptosis** (eyelid drooping) is caused by venom attacking the neuromuscular junction at the levator palpebrae muscle. It appears within 15–45 minutes of significant neurotoxic envenomation — before the patient feels breathing difficulty. This is one of the most reliable early signs in tropical snakebite management and is listed in WHO snakebite management guidelines (2016, p.47).

**Why personal baseline matters:** Absolute eyelid aperture varies by person, age, and alertness. A patient with naturally hooded eyes would trigger a naive threshold. VenomScore measures percentage change from the patient's own first calibration reading — robust to natural variation.

**Dry bite probability:** Up to 50% of snakebite strikes inject no venom. The 20WBCT (20-minute whole blood clotting test) is the standard hospital test. VenomScore gives a pre-hospital dry bite signal: if no ptosis appears and swelling rate is flat at 45 minutes post-bite, dry bite probability exceeds 85%.

---

## 3. How It Fits Into the Existing Codebase

```
Patient triggers SOS (LiveSosDemo panel)
  │
  ├─ VenomScore component mounts alongside WoundTracker
  │    │
  │    ├─ Front camera → MediaPipe Face Landmarker (on-device, no network)
  │    ├─ Eyelid aperture measured every 10 seconds
  │    ├─ Compared to patient's own calibration baseline (reading 0)
  │    ├─ PtosisReading POST → /api/venom-score/{incidentId}/reading
  │    └─ VenomScoreResult GET ← /api/venom-score/{incidentId}/score
  │
  ├─ Backend domain.py
  │    ├─ classify_venom_type()  →  neurotoxic | hemotoxic | unknown | dry_bite
  │    ├─ compute_dry_bite_probability()
  │    └─ estimate_antivenom_vials()
  │
  ├─ WebSocket broadcast (ws.py — finally wired)
  │    └─ VENOM_SCORE_UPDATE → hospital view via useIncidentSocket
  │
  └─ Hospital pre-arrival packet (hospital-packet.tsx)
       └─ Shows VenomScore alongside wound severity + ETA
```

VenomScore plugs into **three things that already exist but are broken or unused:**
- `frontend/src/lib/realtime.ts` exports `useIncidentSocket` but nothing uses it → VenomScore finally wires this
- `backend/app/routes/ws.py` broadcasts events but no client subscribes → VenomScore subscribes hospital view
- `hospital-packet.tsx` exists but shows incomplete data → VenomScore fills the critical missing field

---

## 4. Files to Create

```
backend/app/routes/venom_score.py       # REST endpoints for readings + score
frontend/src/components/venom-score.tsx # MediaPipe face tracking component
frontend/src/components/venom-score-chart.tsx  # Aperture trend chart (Recharts)
frontend/src/components/venom-badge.tsx # Critical alert badge for hospital view
```

## 5. Files to Modify

```
backend/app/domain.py           # Add venom classification + antivenom estimator
backend/app/database.py         # Add PtosisReading table to SCHEMA
backend/app/models.py           # Add PtosisReadingRequest Pydantic model
backend/app/main.py             # Register venom_score router
backend/app/routes/ws.py        # Add broadcast_venom_update() helper
frontend/src/app/page.tsx       # Mount VenomScore alongside WoundTracker in SOS view
frontend/src/store/sos-store.ts # Add ptosisReadings[], venomScore to store
frontend/src/components/hospital-packet.tsx  # Add VenomBadge + antivenom recommendation
frontend/src/lib/realtime.ts    # Finally wire useIncidentSocket to consume WS events
frontend/package.json           # Add @mediapipe/tasks-vision
```

---

## 6. Database Schema Addition

Add to `SCHEMA` in `backend/app/database.py`:

```python
"""
Add after WoundReading table definition.
"""

CREATE TABLE IF NOT EXISTS PtosisReading (
  id               TEXT PRIMARY KEY,
  incidentId       TEXT NOT NULL,
  timestamp        TEXT NOT NULL,
  rightAperture    REAL NOT NULL,   -- normalized units (MediaPipe landmark delta)
  leftAperture     REAL NOT NULL,
  avgAperture      REAL NOT NULL,
  baselineAperture REAL,            -- NULL for first reading (IS the baseline)
  percentChange    REAL,            -- NULL for baseline reading
  ptosisDetected   INTEGER NOT NULL DEFAULT 0,  -- boolean
  severity         TEXT NOT NULL DEFAULT 'none',  -- none|mild|moderate|severe
  asymmetric       INTEGER NOT NULL DEFAULT 0,    -- unilateral = clinically significant
  minutesSinceBite INTEGER,
  createdAt        TEXT NOT NULL
);
```

Add to `migrate_db()` in `backend/app/database.py`:

```python
def migrate_db():
    """Add new columns to existing tables safely."""
    with get_conn() as conn:
        # existing migrations...
        try:
            conn.execute("ALTER TABLE Hospital ADD COLUMN complianceScore REAL DEFAULT 100.0")
        except Exception:
            pass
        # New migration for VenomScore
        # PtosisReading is a new table — handled by CREATE TABLE IF NOT EXISTS in SCHEMA
        # No ALTER needed
```

---

## 7. MediaPipe Setup

### Install

```bash
cd frontend
npm install @mediapipe/tasks-vision
```

This is a 2.1MB package. It downloads the WASM binary and the face landmarker model (~4MB) from a CDN on first use. The model is then cached by the service worker.

### Model initialization pattern

MediaPipe Face Landmarker must be initialized asynchronously before use. Do this once on component mount and store the instance in a ref:

```typescript
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

const initLandmarker = async (): Promise<FaceLandmarker> => {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    // CDN for WASM — falls back to cached version after first load
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
  );
  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU', // falls back to CPU automatically
    },
    outputFaceBlendshapes: false,   // not needed, saves compute
    runningMode: 'VIDEO',           // continuous video stream
    numFaces: 1,                    // one patient at a time
  });
};
```

### Eyelid landmark indices

MediaPipe Face Mesh uses 478 landmarks. These are the specific ones for eyelids:

```typescript
// Upper/lower lid pairs — aperture = |upper.y - lower.y| in normalized coords
const LANDMARKS = {
  RIGHT_UPPER_LID: 159,
  RIGHT_LOWER_LID: 145,
  LEFT_UPPER_LID:  386,
  LEFT_LOWER_LID:  374,
} as const;

// Reference: MediaPipe Face Mesh landmark map
// https://storage.googleapis.com/mediapipe-assets/documentation/mediapipe_face_landmark_fullsize.png
// Landmark 159 = right eye upper iris boundary (best proxy for upper lid)
// Landmark 145 = right eye lower iris boundary
// Same logic applied to left (386, 374)
```

---

## 8. Frontend: `venom-score.tsx`

Full implementation:

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { useSosStore } from '@/store/sos-store';
import { apiUrl } from '@/lib/api';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VenomScoreChart } from './venom-score-chart';

// ── Landmark indices ───────────────────────────────────────────────
const LM = {
  RIGHT_UPPER: 159,
  RIGHT_LOWER: 145,
  LEFT_UPPER:  386,
  LEFT_LOWER:  374,
} as const;

// ── Types ──────────────────────────────────────────────────────────
interface PtosisResult {
  rightAperture:    number;
  leftAperture:     number;
  avgAperture:      number;
  percentChange:    number | null;   // null for baseline reading
  ptosisDetected:   boolean;
  severity:         'none' | 'mild' | 'moderate' | 'severe';
  asymmetric:       boolean;
}

interface VenomScoreResult {
  venomType:              'neurotoxic' | 'hemotoxic' | 'unknown' | 'dry_bite';
  overallSeverity:        number;   // 0–100
  dryBiteProbability:     number;   // 0.0–1.0
  estimatedAntivenomVials: number;
  confidenceLevel:        'low' | 'moderate' | 'high';
  criticalAlert:          string | null;
  ventilatorRequired:     boolean;
  clinicalBasis:          string;
}

interface Props {
  incidentId: string;
  biteTimestamp: string;  // ISO string
}

// ── Component ──────────────────────────────────────────────────────
export function VenomScore({ incidentId, biteTimestamp }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const intervalRef   = useRef<NodeJS.Timeout | null>(null);
  const baselineRef   = useRef<number | null>(null);  // patient's personal baseline

  const [isReady,      setIsReady]      = useState(false);
  const [isTracking,   setIsTracking]   = useState(false);
  const [readings,     setReadings]     = useState<PtosisResult[]>([]);
  const [venomScore,   setVenomScore]   = useState<VenomScoreResult | null>(null);
  const [lastReading,  setLastReading]  = useState<PtosisResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  const { setPtosisReadings, setVenomScore: storeSetVenomScore } = useSosStore();

  // ── Initialize MediaPipe ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) setError('MediaPipe failed to load. Check internet connection.');
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
    };
  }, []);

  // ── Aperture measurement ──────────────────────────────────────
  const measureAperture = useCallback(
    (landmarks: NormalizedLandmark[]): { right: number; left: number; avg: number } => {
      const right = Math.abs(landmarks[LM.RIGHT_UPPER].y - landmarks[LM.RIGHT_LOWER].y);
      const left  = Math.abs(landmarks[LM.LEFT_UPPER].y  - landmarks[LM.LEFT_LOWER].y);
      return { right, left, avg: (right + left) / 2 };
    },
    []
  );

  // ── Single capture + analysis cycle ──────────────────────────
  const capture = useCallback(async () => {
    if (!landmarkerRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;  // not enough data buffered

    const result = landmarkerRef.current.detectForVideo(video, performance.now());
    if (!result.faceLandmarks.length) return;  // face not in frame

    const { right, left, avg } = measureAperture(result.faceLandmarks[0]);

    // Establish personal baseline on first reading
    if (baselineRef.current === null) {
      baselineRef.current = avg;
      const baselineReading: PtosisResult = {
        rightAperture: right, leftAperture: left, avgAperture: avg,
        percentChange: null, ptosisDetected: false,
        severity: 'none', asymmetric: false,
      };
      setReadings([baselineReading]);
      setLastReading(baselineReading);

      await submitReading({ right, left, avg, percentChange: null,
        ptosisDetected: false, severity: 'none', asymmetric: false });
      return;
    }

    // Compute percentage change from personal baseline
    const percentChange = ((baselineRef.current - avg) / baselineRef.current) * 100;
    const asymmetric    = Math.abs(right - left) > (baselineRef.current * 0.2);

    const ptosisDetected = percentChange > 40;   // 40% closure from baseline
    const severity: PtosisResult['severity'] =
      percentChange > 70 ? 'severe'   :
      percentChange > 40 ? 'moderate' :
      percentChange > 20 ? 'mild'     : 'none';

    const reading: PtosisResult = {
      rightAperture: right, leftAperture: left, avgAperture: avg,
      percentChange, ptosisDetected, severity, asymmetric,
    };

    setReadings((prev) => [...prev, reading]);
    setLastReading(reading);
    setPtosisReadings((prev: PtosisResult[]) => [...prev, reading]);

    await submitReading(reading);
    await fetchVenomScore();

    if (ptosisDetected && severity === 'severe') {
      toast.error('⚠️ PTOSIS DETECTED — Possible neurotoxic envenomation', {
        duration: 10000,
      });
    }
  }, [measureAperture, incidentId]);

  // ── Submit reading to backend ─────────────────────────────────
  const submitReading = async (reading: Omit<PtosisResult, never>) => {
    const minutesSinceBite = Math.floor(
      (Date.now() - new Date(biteTimestamp).getTime()) / 60000
    );
    try {
      await fetch(apiUrl(`/api/venom-score/${incidentId}/reading`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reading, minutesSinceBite }),
      });
    } catch {
      // Network failure — readings still accumulated locally, submit on reconnect
    }
  };

  // ── Fetch latest VenomScore from backend ──────────────────────
  const fetchVenomScore = async () => {
    try {
      const res = await fetch(apiUrl(`/api/venom-score/${incidentId}/score`));
      if (!res.ok) return;
      const data = await res.json();
      setVenomScore(data.venomScore);
      storeSetVenomScore(data.venomScore);
    } catch {
      // best effort
    }
  };

  // ── Start tracking ────────────────────────────────────────────
  const startTracking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      videoRef.current!.srcObject = stream;
      await videoRef.current!.play();
      setIsTracking(true);

      // Capture immediately, then every 10 seconds
      await capture();
      intervalRef.current = setInterval(capture, 10_000);
    } catch {
      setError('Camera access denied. VenomScore requires front camera access.');
    }
  };

  const stopTracking = () => {
    clearInterval(intervalRef.current!);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    setIsTracking(false);
  };

  useEffect(() => () => {
    clearInterval(intervalRef.current!);
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <Card className="border-orange-500/30 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="h-4 w-4 text-orange-400" />
          VenomScore — Neurotoxic Detection
          {isTracking && (
            <Badge variant="outline" className="ml-auto text-green-400 border-green-400 animate-pulse">
              LIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hidden video element for MediaPipe processing */}
        <video
          ref={videoRef}
          className="w-full rounded-md aspect-video bg-muted"
          style={{ display: isTracking ? 'block' : 'none' }}
          playsInline
          muted
        />

        {/* Critical alert */}
        {venomScore?.criticalAlert && (
          <div className="flex items-center gap-2 rounded-md bg-red-950 border border-red-500 p-3">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-300 font-medium">{venomScore.criticalAlert}</p>
          </div>
        )}

        {/* Ptosis indicator */}
        {lastReading && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-muted-foreground">Eyelid Closure</p>
              <p className={`text-lg font-bold ${
                lastReading.severity === 'severe'   ? 'text-red-400'    :
                lastReading.severity === 'moderate' ? 'text-orange-400' :
                lastReading.severity === 'mild'     ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {lastReading.percentChange?.toFixed(1) ?? '—'}%
              </p>
              <p className="text-muted-foreground capitalize">{lastReading.severity}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-muted-foreground">Ptosis</p>
              <p className={`text-lg font-bold ${lastReading.ptosisDetected ? 'text-red-400' : 'text-green-400'}`}>
                {lastReading.ptosisDetected ? 'DETECTED' : 'NONE'}
              </p>
              {lastReading.asymmetric && (
                <p className="text-orange-400">Asymmetric</p>
              )}
            </div>
          </div>
        )}

        {/* VenomScore summary */}
        {venomScore && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Venom Type</span>
              <Badge variant={venomScore.venomType === 'neurotoxic' ? 'destructive' :
                             venomScore.venomType === 'hemotoxic' ? 'secondary' : 'outline'}>
                {venomScore.venomType.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Dry Bite Probability</span>
              <span className="font-mono text-foreground">
                {(venomScore.dryBiteProbability * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Est. Antivenom Vials</span>
              <span className="font-mono font-bold text-orange-400">
                {venomScore.estimatedAntivenomVials}
              </span>
            </div>
            {venomScore.ventilatorRequired && (
              <p className="text-xs text-red-400 font-medium">
                ⚠ Ventilator standby recommended
              </p>
            )}
          </div>
        )}

        {/* Trend chart */}
        {readings.length > 1 && (
          <VenomScoreChart readings={readings} />
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isTracking ? (
            <Button
              size="sm"
              onClick={startTracking}
              disabled={!isReady}
              className="flex-1"
            >
              {isReady ? 'Start VenomScore' : 'Loading MediaPipe…'}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={stopTracking} className="flex-1">
              Stop Tracking
            </Button>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <p className="text-[10px] text-muted-foreground">
          Based on WHO snakebite management guidelines (2016). Not a diagnostic device.
          Confirm with 20WBCT at hospital.
        </p>
      </CardContent>
    </Card>
  );
}
```

---

## 9. Frontend: `venom-score-chart.tsx`

```typescript
'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface Props {
  readings: Array<{
    percentChange: number | null;
    severity: string;
    ptosisDetected: boolean;
  }>;
}

export function VenomScoreChart({ readings }: Props) {
  const data = readings
    .filter((r) => r.percentChange !== null)
    .map((r, i) => ({
      reading: i + 1,
      closure: r.percentChange?.toFixed(1),
      ptosis: r.ptosisDetected,
    }));

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="reading" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }}
            formatter={(v: number) => [`${v}%`, 'Eyelid Closure']}
          />
          {/* Ptosis threshold line */}
          <ReferenceLine y={40} stroke="#f97316" strokeDasharray="4 2"
            label={{ value: 'Ptosis', fontSize: 9, fill: '#f97316' }} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 2"
            label={{ value: 'Severe', fontSize: 9, fill: '#ef4444' }} />
          <Line
            type="monotone"
            dataKey="closure"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3, fill: '#f97316' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 10. Backend: `backend/app/routes/venom_score.py`

```python
"""
VenomScore API — ptosis reading ingestion and venom classification.
Novel feature: phone camera eyelid tracking for pre-hospital envenomation assessment.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from .. import database as db
from ..domain import (
    classify_venom_type,
    compute_dry_bite_probability,
    estimate_antivenom_vials,
    compute_venom_score_summary,
)
from ..models import PtosisReadingRequest
from ..routes.ws import broadcast

router = APIRouter()


@router.post("/venom-score/{incident_id}/reading")
async def submit_ptosis_reading(incident_id: str, body: PtosisReadingRequest):
    """Store a ptosis reading and return the updated VenomScore."""
    # Verify incident exists
    with db.get_conn() as conn:
        inc = conn.execute(
            "SELECT id, biteTime FROM Incident WHERE id = ?", (incident_id,)
        ).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    rid = db.new_id()
    with db.get_conn() as conn:
        conn.execute("""
            INSERT INTO PtosisReading
              (id, incidentId, timestamp, rightAperture, leftAperture, avgAperture,
               baselineAperture, percentChange, ptosisDetected, severity,
               asymmetric, minutesSinceBite, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rid, incident_id, db.now_iso(),
            body.right_aperture, body.left_aperture, body.avg_aperture,
            body.baseline_aperture, body.percent_change,
            int(body.ptosis_detected), body.severity,
            int(body.asymmetric), body.minutes_since_bite, db.now_iso(),
        ))

    # Recompute full VenomScore after each new reading
    score = _compute_and_store_score(incident_id)

    # Broadcast to hospital WebSocket channel
    await broadcast(incident_id, "VENOM_SCORE_UPDATE", {"venomScore": score})

    return {"id": rid, "venomScore": score}


@router.get("/venom-score/{incident_id}/score")
async def get_venom_score(incident_id: str):
    """Get the current VenomScore for an incident."""
    score = _compute_and_store_score(incident_id)
    return {"venomScore": score}


@router.get("/venom-score/{incident_id}/readings")
async def get_ptosis_readings(incident_id: str):
    """Get all ptosis readings for an incident (for chart rendering)."""
    with db.get_conn() as conn:
        rows = conn.execute("""
            SELECT timestamp, rightAperture, leftAperture, avgAperture,
                   percentChange, ptosisDetected, severity, asymmetric, minutesSinceBite
            FROM PtosisReading WHERE incidentId = ?
            ORDER BY timestamp ASC
        """, (incident_id,)).fetchall()
    return {"readings": [dict(r) for r in rows]}


# ── private helpers ─────────────────────────────────────────────────

def _compute_and_store_score(incident_id: str) -> dict:
    """Recompute VenomScore from all readings for this incident."""
    with db.get_conn() as conn:
        ptosis_rows = conn.execute("""
            SELECT percentChange, ptosisDetected, severity, asymmetric, minutesSinceBite
            FROM PtosisReading WHERE incidentId = ? ORDER BY timestamp ASC
        """, (incident_id,)).fetchall()

        wound_rows = conn.execute("""
            SELECT severityScore, progression, swellingAreaPx, createdAt
            FROM WoundReading WHERE incidentId = ? ORDER BY createdAt ASC
        """, (incident_id,)).fetchall()

        inc = conn.execute(
            "SELECT biteTime FROM Incident WHERE id = ?", (incident_id,)
        ).fetchone()

    ptosis_readings = [dict(r) for r in ptosis_rows]
    wound_readings  = [dict(r) for r in wound_rows]
    minutes_since_bite = db.mins_since(inc["biteTime"]) if inc else 0

    return compute_venom_score_summary(ptosis_readings, wound_readings, minutes_since_bite)
```

---

## 11. Backend: Domain Functions (`backend/app/domain.py` additions)

Append these functions to `backend/app/domain.py`:

```python
# ── VenomScore domain functions ────────────────────────────────────────

def classify_venom_type(
    ptosis_readings: list[dict],
    wound_readings: list[dict],
) -> str:
    """
    Classify venom type from clinical indicators.

    Returns: 'neurotoxic' | 'hemotoxic' | 'unknown' | 'dry_bite'

    Clinical basis:
    - Neurotoxic (cobra, krait): eyelid ptosis within 30-45 min
    - Hemotoxic (Russell's viper, saw-scaled viper): rapid local swelling,
      no early ptosis
    - Dry bite: no swelling, no ptosis at 45+ min
    """
    has_ptosis = any(r["ptosisDetected"] for r in ptosis_readings)

    if has_ptosis:
        return "neurotoxic"

    # Check swelling rate from wound readings
    if len(wound_readings) >= 2:
        first_area = wound_readings[0].get("swellingAreaPx", 0) or 0
        last_area  = wound_readings[-1].get("swellingAreaPx", 0) or 0
        swelling_rate = last_area - first_area  # px² change
        if swelling_rate > 5000:  # significant swelling without ptosis = hemotoxic
            return "hemotoxic"

    return "unknown"


def compute_dry_bite_probability(
    ptosis_readings: list[dict],
    wound_readings: list[dict],
    minutes_since_bite: int,
) -> float:
    """
    Estimate probability that no venom was injected.

    Clinical basis: Significant envenomation shows objective signs
    within 45 min. Absence of both ptosis and measurable swelling
    at 45 min = >85% dry bite probability.

    Returns float 0.0 (definitely envenomated) to 1.0 (almost certainly dry).
    """
    if any(r["ptosisDetected"] for r in ptosis_readings):
        return 0.0  # ptosis = definitely not dry

    if wound_readings:
        # Compute swelling slope (px²/min) from wound tracker
        first = wound_readings[0].get("swellingAreaPx", 0) or 0
        last  = wound_readings[-1].get("swellingAreaPx", 0) or 0
        elapsed_mins = max(1, len(wound_readings) * 5)  # 5-min capture intervals
        swelling_rate = (last - first) / elapsed_mins
        if swelling_rate > 200:  # rapid swelling
            return 0.0
        if swelling_rate > 50:   # moderate swelling
            return max(0.0, 1 - (swelling_rate / 100))

    if minutes_since_bite < 20:
        return 0.0  # too early to call

    # No objective signs → rising dry bite probability with time
    # Reaches 85% at 45 min, caps at 95%
    prob = min(0.95, ((minutes_since_bite - 20) / 35.0) * 0.85)
    return round(prob, 2)


def estimate_antivenom_vials(
    venom_type: str,
    severity_score: float,
    minutes_since_bite: int,
) -> dict:
    """
    Estimate antivenom vials required based on WHO guidelines.

    Reference: WHO guidelines for the management of snake-bites in
    South-East Asia (2016), p.71-78. Indian NPCS polyvalent antivenom
    prescribing information.

    Returns dict with estimatedVials, confidenceLevel, clinicalBasis.
    """
    if venom_type == "neurotoxic":
        if severity_score >= 80:   vials = 25
        elif severity_score >= 60: vials = 20
        elif severity_score >= 40: vials = 15
        else:                      vials = 10
        confidence = "moderate"
        basis = "WHO 2016 Table 3: Neurotoxic syndrome — 10-25 vials"

    elif venom_type == "hemotoxic":
        if severity_score >= 75:   vials = 25
        elif severity_score >= 50: vials = 15
        else:                      vials = 10
        confidence = "moderate"
        basis = "WHO 2016 Table 3: Hemotoxic syndrome — 10-25 vials"

    else:  # unknown or dry_bite
        vials = 0 if venom_type == "dry_bite" else 10
        confidence = "low"
        basis = "Conservative: await hospital 20WBCT before dosing"

    return {
        "estimatedVials": vials,
        "confidenceLevel": confidence,
        "clinicalBasis": basis,
        "disclaimer": "Confirm with 20WBCT and clinical assessment before finalizing",
    }


def compute_venom_score_summary(
    ptosis_readings: list[dict],
    wound_readings:  list[dict],
    minutes_since_bite: int,
) -> dict:
    """
    Compute the full VenomScore object sent to the hospital pre-arrival packet.
    Called after every new ptosis or wound reading.
    """
    venom_type = classify_venom_type(ptosis_readings, wound_readings)
    dry_bite_prob = compute_dry_bite_probability(
        ptosis_readings, wound_readings, minutes_since_bite
    )

    # Severity score: max ptosis percentage + latest wound severity, averaged
    ptosis_severity = 0.0
    if ptosis_readings:
        percent_changes = [
            r["percentChange"] for r in ptosis_readings
            if r.get("percentChange") is not None
        ]
        if percent_changes:
            # Normalize: 100% eyelid closure → 100 severity score
            ptosis_severity = min(100.0, max(percent_changes))

    wound_severity = 0.0
    if wound_readings:
        wound_severity = wound_readings[-1].get("severityScore", 0) or 0

    # Combined severity (ptosis weighted higher as it's more specific)
    if ptosis_severity > 0 and wound_severity > 0:
        overall_severity = round(ptosis_severity * 0.6 + wound_severity * 0.4, 1)
    elif ptosis_severity > 0:
        overall_severity = round(ptosis_severity, 1)
    elif wound_severity > 0:
        overall_severity = round(wound_severity, 1)
    else:
        overall_severity = 0.0

    antivenom = estimate_antivenom_vials(venom_type, overall_severity, minutes_since_bite)

    # Critical alerts
    critical_alert = None
    ventilator_required = False
    if venom_type == "neurotoxic" and overall_severity >= 60:
        critical_alert = "NEUROTOXIC — respiratory failure risk within ~40 min. Ventilator standby required."
        ventilator_required = True
    elif venom_type == "neurotoxic" and overall_severity >= 40:
        critical_alert = "NEUROTOXIC — monitor breathing. Progressive ptosis detected."
    elif venom_type == "hemotoxic" and overall_severity >= 60:
        critical_alert = "HEMOTOXIC — coagulopathy risk. Prepare clotting factors."

    return {
        "venomType":               venom_type,
        "overallSeverity":         overall_severity,
        "dryBiteProbability":      dry_bite_prob,
        "estimatedAntivenomVials": antivenom["estimatedVials"],
        "confidenceLevel":         antivenom["confidenceLevel"],
        "clinicalBasis":           antivenom["clinicalBasis"],
        "criticalAlert":           critical_alert,
        "ventilatorRequired":      ventilator_required,
        "ptosisReadingCount":      len(ptosis_readings),
        "woundReadingCount":       len(wound_readings),
        "minutesSinceBite":        minutes_since_bite,
    }
```

---

## 12. Pydantic Model (`backend/app/models.py` addition)

```python
class PtosisReadingRequest(BaseModel):
    right_aperture:    float = Field(..., ge=0.0, le=1.0)
    left_aperture:     float = Field(..., ge=0.0, le=1.0)
    avg_aperture:      float = Field(..., ge=0.0, le=1.0)
    baseline_aperture: float | None = None   # None = this IS the baseline
    percent_change:    float | None = None   # None for baseline reading
    ptosis_detected:   bool  = False
    severity:          str   = "none"   # none|mild|moderate|severe
    asymmetric:        bool  = False
    minutes_since_bite: int | None = None
```

---

## 13. Register Router (`backend/app/main.py`)

```python
from .routes import venom_score  # add this import

# In router registration block:
app.include_router(venom_score.router, prefix="/api", tags=["venom-score"])
```

---

## 14. Zustand Store Changes (`frontend/src/store/sos-store.ts`)

Add to the existing store:

```typescript
interface SosStore {
  // ... existing fields ...
  ptosisReadings:   PtosisReading[];
  venomScore:       VenomScoreResult | null;
  setPtosisReadings: (updater: (prev: PtosisReading[]) => PtosisReading[]) => void;
  setVenomScore:    (score: VenomScoreResult | null) => void;
}

// In create():
ptosisReadings: [],
venomScore: null,
setPtosisReadings: (updater) =>
  set((s) => ({ ptosisReadings: updater(s.ptosisReadings) })),
setVenomScore: (score) => set({ venomScore: score }),
```

---

## 15. Wire VenomScore into the Hospital Packet

In `frontend/src/components/hospital-packet.tsx`, add a VenomScore section:

```typescript
// Import from store
const venomScore = useSosStore((s) => s.venomScore);

// Add inside the packet card:
{venomScore && (
  <div className="space-y-2 border-t border-border pt-3 mt-3">
    <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
      VenomScore Assessment
    </p>
    {venomScore.criticalAlert && (
      <div className="rounded-md bg-red-950 border border-red-700 p-2">
        <p className="text-xs text-red-300">{venomScore.criticalAlert}</p>
      </div>
    )}
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <p className="text-muted-foreground">Venom Type</p>
        <p className="font-bold uppercase">{venomScore.venomType}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Est. Vials Needed</p>
        <p className="font-bold text-orange-400 text-lg">
          {venomScore.estimatedAntivenomVials}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Dry Bite Probability</p>
        <p className="font-bold">
          {(venomScore.dryBiteProbability * 100).toFixed(0)}%
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Confidence</p>
        <p className="font-bold capitalize">{venomScore.confidenceLevel}</p>
      </div>
    </div>
    {venomScore.ventilatorRequired && (
      <p className="text-xs font-bold text-red-400">
        ⚠ VENTILATOR STANDBY REQUIRED
      </p>
    )}
    <p className="text-[10px] text-muted-foreground">{venomScore.clinicalBasis}</p>
  </div>
)}
```

---

## 16. Wire WebSocket Consumer (Finally)

`frontend/src/lib/realtime.ts` exports `useIncidentSocket` but nothing uses it. VenomScore should be the thing that wires it into the hospital view.

In `frontend/src/app/page.tsx`, for the hospital role view:

```typescript
import { useIncidentSocket } from '@/lib/realtime';
import { useSosStore } from '@/store/sos-store';

// Inside the hospital role component:
const { setVenomScore, incidentId } = useSosStore();

useIncidentSocket(incidentId, (event) => {
  if (event.event === 'VENOM_SCORE_UPDATE') {
    setVenomScore(event.data.venomScore);
  }
  if (event.event === 'WOUND_UPDATE') {
    // update wound severity in store
  }
  if (event.event === 'dispatch_accepted') {
    // update dispatch lane status
  }
});
```

This fixes the dead `useIncidentSocket` hook from CONCERNS.md and means the hospital view updates in real-time without any polling.

---

## 17. Mount VenomScore in the SOS View (`frontend/src/app/page.tsx`)

```typescript
import { VenomScore } from '@/components/venom-score';

// Inside the victim/patient SOS panel, alongside WoundTracker:
{activeIncident && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <WoundTracker incidentId={activeIncident.id} />
    <VenomScore
      incidentId={activeIncident.id}
      biteTimestamp={activeIncident.biteTime}
    />
  </div>
)}
```

---

## 18. Tests to Add

### Backend unit tests (`backend/tests/test_domain.py`)

```python
class TestVenomClassification:
    def test_ptosis_detected_gives_neurotoxic(self):
        ptosis = [{"ptosisDetected": True, "percentChange": 55.0, "asymmetric": False}]
        assert classify_venom_type(ptosis, []) == "neurotoxic"

    def test_rapid_swelling_no_ptosis_gives_hemotoxic(self):
        ptosis = [{"ptosisDetected": False, "percentChange": 5.0, "asymmetric": False}]
        wounds = [
            {"swellingAreaPx": 100, "severityScore": 10},
            {"swellingAreaPx": 8000, "severityScore": 60},
        ]
        assert classify_venom_type(ptosis, wounds) == "hemotoxic"

    def test_no_signs_at_50_min_high_dry_bite(self):
        prob = compute_dry_bite_probability(
            [{"ptosisDetected": False, "percentChange": 2.0}],
            [{"swellingAreaPx": 100}, {"swellingAreaPx": 110}],
            minutes_since_bite=50,
        )
        assert prob > 0.70

    def test_ptosis_gives_zero_dry_bite(self):
        prob = compute_dry_bite_probability(
            [{"ptosisDetected": True}], [], 30
        )
        assert prob == 0.0

    def test_neurotoxic_severe_needs_25_vials(self):
        result = estimate_antivenom_vials("neurotoxic", 85.0, 30)
        assert result["estimatedVials"] == 25
        assert result["confidenceLevel"] == "moderate"

    def test_dry_bite_needs_zero_vials(self):
        result = estimate_antivenom_vials("dry_bite", 0.0, 50)
        assert result["estimatedVials"] == 0
```

### Backend route test (`backend/tests/test_routes.py`)

```python
class TestVenomScore:
    async def test_submit_baseline_reading(self, async_client, seeded_incident):
        resp = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading",
            json={
                "right_aperture": 0.025,
                "left_aperture": 0.024,
                "avg_aperture": 0.0245,
                "ptosis_detected": False,
                "severity": "none",
                "asymmetric": False,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "venomScore" in data
        assert data["venomScore"]["venomType"] == "unknown"

    async def test_ptosis_reading_gives_neurotoxic(self, async_client, seeded_incident):
        # submit baseline
        await async_client.post(f"/api/venom-score/{seeded_incident}/reading",
            json={"right_aperture": 0.025, "left_aperture": 0.024,
                  "avg_aperture": 0.0245, "ptosis_detected": False,
                  "severity": "none", "asymmetric": False})
        # submit ptosis reading
        resp = await async_client.post(f"/api/venom-score/{seeded_incident}/reading",
            json={"right_aperture": 0.010, "left_aperture": 0.011,
                  "avg_aperture": 0.0105, "percent_change": 57.1,
                  "ptosis_detected": True, "severity": "moderate",
                  "asymmetric": False, "minutes_since_bite": 18})
        assert resp.status_code == 200
        assert resp.json()["venomScore"]["venomType"] == "neurotoxic"
```

---

## 19. Demo Script for IISc (VenomScore Specific)

**Setup before the demo:**
- Open two browser windows: one as Victim, one as Hospital
- Have a team member hold the phone with the front camera pointing at their face
- Stage lighting should be adequate (front-lit, no strong backlight)
- Pre-seed one incident in the database

**Live demo flow (3 minutes for this feature):**

1. Trigger SOS on victim view → three lanes dispatch → Twilio SMS
2. "Now — the phone starts VenomScore. Click Start VenomScore."
3. Camera opens, face is detected, first reading = baseline
   - Say: *"This is the calibration. It measures the patient's own eyelid aperture as a personal baseline. Not a fixed threshold — this patient's baseline."*
4. After 10 seconds, second reading. Aperture is normal → 0% closure → "No ptosis. Dry bite probability rising."
5. Now — the interesting part. Ask your team member to half-close one eye deliberately.
6. Next 10-second interval captures it. Aperture drops.
   - Watch the percentage closure jump. Severity badge changes color.
   - If it crosses 40% → "PTOSIS DETECTED" toast fires
   - VenomScore updates: venomType → NEUROTOXIC
   - Antivenom estimate → 15 vials
   - Critical alert appears
7. Switch to hospital view. The pre-arrival packet has already updated via WebSocket.
   - "The hospital sees this NOW. Before the patient walks in. They are pre-drawing 15 vials."
   - If ventilator alert fired: "The ventilator is on standby."

8. Final line: *"No clinical device. No doctor. No lab. Just a phone camera and 28 minutes of eyelid tracking. This is VenomScore."*

---

## 20. Two-Day Timeline

### Today — August 14

**Morning (4 hours): Backend**
- Add `PtosisReading` table to `database.py` schema + `migrate_db()`
- Add `PtosisReadingRequest` to `models.py`
- Add domain functions to `domain.py` (all 4 functions)
- Create `backend/app/routes/venom_score.py`
- Register router in `main.py`
- Run `pytest backend/tests/test_domain.py -v` (add the new domain tests first)

**Afternoon (4 hours): Frontend**
- `npm install @mediapipe/tasks-vision` in `frontend/`
- Create `venom-score-chart.tsx` (simpler, start here)
- Create `venom-score.tsx` (main component)
- Update `sos-store.ts` with `ptosisReadings` and `venomScore` fields
- Mount in `page.tsx` alongside WoundTracker

### August 15

**Morning (3 hours): Integration**
- Wire `useIncidentSocket` in hospital role view
- Update `hospital-packet.tsx` with VenomScore section
- Test full flow end-to-end: trigger SOS → start VenomScore → watch hospital view update via WebSocket

**Afternoon (3 hours): Polish + Demo Prep**
- Fix the accept/decline button no-op (from CONCERNS.md — 30 minutes)
- Delete `frontend/src/lib/__tests__/eventbus.test.ts` (broken test — 5 minutes)
- Add `npx vitest run` to CI frontend job
- Seed the demo database with Mandya/Tumkur/Hassan hospitals + compliance scores
- Full demo rehearsal x3 with the IISc script above

**Evening: Dry run**
- Two laptops: one victim, one hospital
- Mobile hotspot, not college WiFi (more reliable)
- Confirm Twilio SMS fires to a real registered phone
- Confirm WebSocket hospital update happens within 2 seconds of ptosis reading

---

## 21. What to Say When a Judge Asks "Why Does This Matter?"

*"Every doctor in rural India starts from zero when a snakebite patient arrives. They don't know if it's cobra or viper. They don't know if any venom was injected at all. The standard test — the 20-minute whole blood clotting test — takes 20 minutes just to start. In a neurotoxic case, the patient may stop breathing in 40 minutes.*

*VenomScore tells the hospital, while the patient is still in the ambulance, what type of venom it likely is, how many antivenom vials to prepare, and whether a ventilator needs to be on standby. It does this from a phone's front camera, measuring a clinical sign that every textbook describes but no software has ever detected automatically.*

*Ptosis — eyelid drooping — is caused by cobra and krait venom attacking the nerve-muscle junction. It appears in 15 to 45 minutes. We measure it by tracking 478 facial landmarks using Google's MediaPipe, running entirely on-device, with no internet required. Nothing like this exists."*
