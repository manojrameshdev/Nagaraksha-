"""Wound Progression Tracker — novel envenomation severity measurement.

POST /api/wound/{incident_id}/reading — submit camera frame + pixel measurement
GET  /api/wound/{incident_id}/trend  — fetch all readings for Recharts chart
"""
from __future__ import annotations

import base64

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from .. import database as db
from ..auth import require_role_if_enforced
from ..llm import analyze_wound_image
from ..routes.ws import broadcast

router = APIRouter()


@router.post("/api/wound/{incident_id}/reading")
async def submit_wound_reading(
    incident_id: str,
    image: UploadFile = File(...),
    swelling_area_px: int = Form(0),
    _role: str = Depends(require_role_if_enforced("victim", "hospital_admin", "system_admin")),
):
    """
    Receive a wound photo + pixel measurement, call Gemini Vision for severity score,
    store the reading, and push a real-time update via WebSocket.
    """
    with db.get_conn() as conn:
        inc = conn.execute("SELECT id FROM Incident WHERE id=?", (incident_id,)).fetchone()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    img_bytes = await image.read()
    img_b64 = base64.b64encode(img_bytes).decode()

    # Gemini Vision analysis (with pixel-based fallback)
    analysis = await analyze_wound_image(img_b64, swelling_area_px)

    reading_id = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        # The photo is analyzed in-memory but deliberately NOT persisted:
        # storing full base64 wound photos bloats the SQLite file and keeps
        # sensitive imagery at rest without encryption.
        conn.execute(
            "INSERT INTO WoundReading "
            "(id, incidentId, timestamp, swellingAreaPx, severityScore, progression, "
            "estimatedVenomSpreadCm, recommendedAntivenomVials, aiNotes, imageB64) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
            (
                reading_id, incident_id, now, swelling_area_px,
                analysis["severity_score"], analysis["progression"],
                analysis.get("estimated_venom_spread_cm"),
                analysis.get("recommended_antivenom_vials"),
                analysis.get("notes"),
            ),
        )

    reading = {
        "id": reading_id,
        "timestamp": now,
        "swellingAreaPx": swelling_area_px,
        "severityScore": analysis["severity_score"],
        "progression": analysis["progression"],
        "estimatedVenomSpreadCm": analysis.get("estimated_venom_spread_cm"),
        "recommendedAntivenomVials": analysis.get("recommended_antivenom_vials"),
        "notes": analysis.get("notes"),
    }

    # Push live update to hospital view and victim
    await broadcast(incident_id, "WOUND_UPDATE", {
        "reading": reading,
        "currentSeverityScore": analysis["severity_score"],
        "severityTrend": analysis["progression"],
        "recommendedAntivenomVials": analysis.get("recommended_antivenom_vials"),
    })

    return {"reading": reading}


@router.get("/api/wound/{incident_id}/trend")
def get_wound_trend(incident_id: str):
    """Return all wound readings for an incident (used by Recharts severity chart)."""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, timestamp, swellingAreaPx, severityScore, progression, "
            "estimatedVenomSpreadCm, recommendedAntivenomVials, aiNotes "
            "FROM WoundReading WHERE incidentId=? ORDER BY timestamp ASC",
            (incident_id,),
        ).fetchall()
    return {
        "incidentId": incident_id,
        "readings": [dict(r) for r in rows],
    }


@router.get("/api/wound/{incident_id}/packet")
def get_pre_arrival_packet(incident_id: str):
    """
    Pre-arrival hospital intelligence packet.
    Sent when a hospital is selected as dispatch target.
    """
    with db.get_conn() as conn:
        inc = conn.execute("SELECT * FROM Incident WHERE id=?", (incident_id,)).fetchone()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        inc = dict(inc)
        readings = [dict(r) for r in conn.execute(
            "SELECT timestamp, severityScore, progression FROM WoundReading "
            "WHERE incidentId=? ORDER BY timestamp ASC",
            (incident_id,),
        ).fetchall()]
        dispatch_attempts = [dict(a) for a in conn.execute(
            "SELECT * FROM DispatchAttempt WHERE incidentId=? AND outcome='ACCEPTED'",
            (incident_id,),
        ).fetchall()]
        symptoms = [dict(s) for s in conn.execute(
            "SELECT code, label, severity FROM SymptomObservation WHERE incidentId=?",
            (incident_id,),
        ).fetchall()]

    # Compute ETA from nearest accepted ambulance
    hospital_attempt = next(
        (a for a in dispatch_attempts if a["category"] == "AMBULANCE"), None
    )
    eta_min = hospital_attempt["etaMin"] if hospital_attempt else None

    current_severity = readings[-1]["severityScore"] if readings else None
    current_trend = readings[-1]["progression"] if readings else "insufficient_data"
    recommended_vials = None
    if readings:
        with db.get_conn() as conn:
            last = conn.execute(
                "SELECT recommendedAntivenomVials FROM WoundReading "
                "WHERE incidentId=? ORDER BY timestamp DESC LIMIT 1",
                (incident_id,),
            ).fetchone()
            if last:
                recommended_vials = last["recommendedAntivenomVials"]

    minutes_since_bite = 0
    if inc.get("biteTime"):
        minutes_since_bite = round(db.days_since(inc["biteTime"]) * 1440)

    return {
        "incidentId": incident_id,
        "patientGps": {"lat": inc["lat"], "lng": inc["lng"]},
        "biteTime": inc.get("biteTime"),
        "minutesSinceBite": minutes_since_bite,
        "etaMinutes": eta_min,
        "currentSeverityScore": current_severity,
        "severityTrend": current_trend,
        "recommendedAntivenomVials": recommended_vials,
        "symptomsObserved": symptoms,
        "woundReadings": readings,
    }
