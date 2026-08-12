"""SOS route — POST /api/sos. Creates an incident + appends IncidentCreated
to the outbox in the same transaction; the worker fans out 3 lanes."""
from __future__ import annotations

import json
from fastapi import APIRouter
from ..models import SosRequest
from .. import database as db
from ..eventbus import append_outbox, audit, start_worker, get_ranked_hospitals
from ..domain import gen_incident_ref

router = APIRouter()


@router.post("/api/sos")
def trigger_sos(req: SosRequest):
    start_worker()
    inc_id = db.new_id()
    token = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Incident (id, token, lat, lng, address, biteTime, bodyPart, snakeType, state, createdAt, updatedAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCHING', ?, ?)",
            (inc_id, token, req.lat, req.lng, req.address, req.biteTime, req.bodyPart,
             req.snakeType, now, now),
        )
        # outbox event in the same transaction (System Design step 3+4)
        conn.execute(
            "INSERT INTO OutboxEvent (id, type, aggregateId, payload, state, attempts, createdAt) "
            "VALUES (?, 'IncidentCreated', ?, ?, 'PENDING', 0, ?)",
            (db.new_id(), inc_id, json.dumps({"lat": req.lat, "lng": req.lng, "incidentId": inc_id}), now),
        )
    audit(incident_id=inc_id, actor="victim", action="SOS_TRIGGERED",
          entity="Incident", metadata={"lat": req.lat, "lng": req.lng, "address": req.address})

    ranked = get_ranked_hospitals(req.lat, req.lng)
    incident = _load_incident(inc_id)
    return {
        "incident": incident,
        "ref": gen_incident_ref(),
        "rankedHospitals": ranked,
        "dispatchedAt": now,
        "streamUrl": f"/api/incidents/{inc_id}/stream",
        "wsUrl": f"/ws/incidents/{inc_id}",
        "auditUrl": f"/api/incidents/{inc_id}/audit",
    }


def _load_incident(inc_id):
    with db.get_conn() as conn:
        inc = conn.execute("SELECT * FROM Incident WHERE id=?", (inc_id,)).fetchone()
        if not inc:
            return None
        inc = dict(inc)
        attempts = conn.execute(
            "SELECT * FROM DispatchAttempt WHERE incidentId=? ORDER BY category ASC, sequence ASC",
            (inc_id,),
        ).fetchall()
        inc["dispatchAttempts"] = [dict(a) for a in attempts]
        inc["symptomObservations"] = [
            dict(r) for r in conn.execute(
                "SELECT * FROM SymptomObservation WHERE incidentId=? ORDER BY observedAt ASC", (inc_id,)
            ).fetchall()
        ]
        inc["snakeObservations"] = [
            dict(r) for r in conn.execute(
                "SELECT * FROM SnakeObservation WHERE incidentId=? ORDER BY createdAt ASC", (inc_id,)
            ).fetchall()
        ]
    return inc
