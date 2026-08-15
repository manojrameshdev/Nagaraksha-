"""VenomScore ptosis tracker — eyelid aperture readings, scoring, and advisory antivenom estimation.

POST /api/venom-score/{incident_id}/reading — submit a ptosis reading, persist, score, broadcast
GET  /api/venom-score/{incident_id}/score     — recompute the composite VenomScoreResult
GET  /api/venom-score/{incident_id}/readings  — all persisted readings (timestamp ASC)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from .. import database as db
from ..auth import require_role_if_enforced
from ..domain import compute_venom_score
from ..models import PtosisReadingRequest
from ..routes.ws import broadcast

router = APIRouter()

_ROLE_DEP = require_role_if_enforced("victim", "hospital_admin", "system_admin")


def _score_rows(conn, incident_id: str):
    """Fetch all PtosisReading + WoundReading rows needed for scoring, timestamp ASC."""
    ptosis = [dict(r) for r in conn.execute(
        "SELECT * FROM PtosisReading WHERE incidentId=? ORDER BY timestamp ASC",
        (incident_id,),
    ).fetchall()]
    wounds = [dict(r) for r in conn.execute(
        "SELECT severityScore, swellingAreaPx FROM WoundReading "
        "WHERE incidentId=? ORDER BY timestamp ASC",
        (incident_id,),
    ).fetchall()]
    return ptosis, wounds


def _minutes_since_bite(inc: dict) -> int:
    """Compute minutes since bite from Incident.biteTime (no db helper exists — days_since * 1440)."""
    if not inc.get("biteTime"):
        return 0
    return round(db.days_since(inc["biteTime"]) * 1440)


@router.post("/api/venom-score/{incident_id}/reading")
async def submit_ptosis_reading(
    incident_id: str,
    req: PtosisReadingRequest,
    _role: str = Depends(_ROLE_DEP),
):
    """Persist a ptosis reading, recompute the score, and push VENOM_SCORE_UPDATE."""
    with db.get_conn() as conn:
        inc = conn.execute(
            "SELECT id, biteTime FROM Incident WHERE id=?", (incident_id,)
        ).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    reading_id = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO PtosisReading "
            "(id, incidentId, timestamp, rightAperture, leftAperture, avgAperture, "
            "baselineAperture, percentChange, ptosisDetected, severity, asymmetric, "
            "minutesSinceBite, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                reading_id, incident_id, now,
                req.right_aperture, req.left_aperture, req.avg_aperture,
                req.baseline_aperture, req.percent_change,
                int(req.ptosis_detected), req.severity, int(req.asymmetric),
                req.minutes_since_bite, now,
            ),
        )

    with db.get_conn() as conn:
        ptosis_rows, wound_rows = _score_rows(conn, incident_id)

    minutes_since_bite = _minutes_since_bite(dict(inc))
    score = compute_venom_score(ptosis_rows, wound_rows, minutes_since_bite)

    # Real-time push to all incident subscribers (hospital view + victim)
    await broadcast(incident_id, "VENOM_SCORE_UPDATE", {"venomScore": score})

    return {"id": reading_id, "venomScore": score}


@router.get("/api/venom-score/{incident_id}/score")
async def get_venom_score(
    incident_id: str,
    _role: str = Depends(_ROLE_DEP),
):
    """Recompute the composite VenomScoreResult from all persisted rows."""
    with db.get_conn() as conn:
        inc = conn.execute(
            "SELECT id, biteTime FROM Incident WHERE id=?", (incident_id,)
        ).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    with db.get_conn() as conn:
        ptosis_rows, wound_rows = _score_rows(conn, incident_id)

    minutes_since_bite = _minutes_since_bite(dict(inc))
    score = compute_venom_score(ptosis_rows, wound_rows, minutes_since_bite)
    return {"venomScore": score}


@router.get("/api/venom-score/{incident_id}/readings")
async def get_ptosis_readings(
    incident_id: str,
    _role: str = Depends(_ROLE_DEP),
):
    """Return all ptosis readings for an incident, ordered by timestamp ASC."""
    with db.get_conn() as conn:
        inc = conn.execute(
            "SELECT id FROM Incident WHERE id=?", (incident_id,)
        ).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    with db.get_conn() as conn:
        rows = [dict(r) for r in conn.execute(
            "SELECT timestamp, rightAperture, leftAperture, avgAperture, baselineAperture, "
            "percentChange, ptosisDetected, severity, asymmetric, minutesSinceBite "
            "FROM PtosisReading WHERE incidentId=? ORDER BY timestamp ASC",
            (incident_id,),
        ).fetchall()]
    return {"incidentId": incident_id, "readings": rows}