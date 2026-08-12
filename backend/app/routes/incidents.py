"""Incident routes — GET/PATCH /api/incidents/{id}, audit trail, SSE stream, symptoms."""
from __future__ import annotations

import asyncio
import json
import time
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from ..models import SymptomRequest
from .. import database as db
from ..eventbus import subscribe, unsubscribe, start_worker

router = APIRouter()


def _load_incident(inc_id):
    with db.get_conn() as conn:
        inc = conn.execute("SELECT * FROM Incident WHERE id=?", (inc_id,)).fetchone()
        if not inc:
            return None
        inc = dict(inc)
        inc["dispatchAttempts"] = [
            dict(a) for a in conn.execute(
                "SELECT * FROM DispatchAttempt WHERE incidentId=? ORDER BY category ASC, sequence ASC", (inc_id,)
            ).fetchall()
        ]
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


@router.get("/api/incidents/{inc_id}")
def get_incident(inc_id: str):
    return {"incident": _load_incident(inc_id)}


@router.get("/api/incidents/{inc_id}/audit")
def get_audit(inc_id: str):
    with db.get_conn() as conn:
        incident = _load_incident(inc_id)
        audit = [dict(r) for r in conn.execute(
            "SELECT * FROM AuditEvent WHERE incidentId=? ORDER BY timestamp ASC", (inc_id,)
        ).fetchall()]
        outbox = [dict(r) for r in conn.execute(
            "SELECT * FROM OutboxEvent WHERE aggregateId=? ORDER BY createdAt ASC", (inc_id,)
        ).fetchall()]
    return {
        "incident": incident,
        "audit": audit,
        "outbox": [{"id": o["id"], "type": o["type"], "aggregateId": o["aggregateId"],
                     "state": o["state"], "attempts": o["attempts"],
                     "createdAt": o["createdAt"], "processedAt": o["processedAt"]} for o in outbox],
    }


@router.post("/api/incidents/{inc_id}/symptoms")
def log_symptom(inc_id: str, body: SymptomRequest):
    """Log a symptom observation for an incident (was 404 before)."""
    with db.get_conn() as conn:
        inc = conn.execute("SELECT id FROM Incident WHERE id=?", (inc_id,)).fetchone()
        if not inc:
            return {"error": "Incident not found"}
        sid = db.new_id()
        conn.execute(
            "INSERT INTO SymptomObservation "
            "(id, incidentId, code, label, severity, value, observedAt, author) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, inc_id, body.code, body.label, body.severity,
             body.value, db.now_iso(), body.author or "patient"),
        )
    return {"id": sid, "incidentId": inc_id}


@router.patch("/api/incidents/{inc_id}/accept")
def accept_dispatch(inc_id: str):
    """Responder accepts dispatch — updates first PENDING attempt to ACCEPTED."""
    with db.get_conn() as conn:
        attempt = conn.execute(
            "SELECT id FROM DispatchAttempt WHERE incidentId=? AND outcome='PENDING' "
            "ORDER BY sequence ASC LIMIT 1",
            (inc_id,),
        ).fetchone()
        if not attempt:
            return {"error": "No pending dispatch attempt"}
        conn.execute(
            "UPDATE DispatchAttempt SET outcome='ACCEPTED', acceptedAt=? WHERE id=?",
            (db.now_iso(), attempt["id"]),
        )
    return {"acceptedAttemptId": attempt["id"]}


@router.patch("/api/incidents/{inc_id}/decline")
def decline_dispatch(inc_id: str):
    """Responder declines — marks first PENDING attempt DECLINED, escalates to next."""
    with db.get_conn() as conn:
        attempt = conn.execute(
            "SELECT id FROM DispatchAttempt WHERE incidentId=? AND outcome='PENDING' "
            "ORDER BY sequence ASC LIMIT 1",
            (inc_id,),
        ).fetchone()
        if not attempt:
            return {"error": "No pending dispatch attempt"}
        conn.execute(
            "UPDATE DispatchAttempt SET outcome='DECLINED' WHERE id=?",
            (attempt["id"],),
        )
    return {"declinedAttemptId": attempt["id"]}


@router.get("/api/incidents/{inc_id}/stream")
async def stream_incident(inc_id: str, request: Request):
    """SSE stream of live incident state (kept for backward compat; WebSocket preferred)."""
    incident = _load_incident(inc_id)
    if not incident:
        return {"error": "Not found"}

    start_worker()
    queue: asyncio.Queue = asyncio.Queue()

    def make_cb(event_name):
        def cb(iid, payload):
            try:
                queue.put_nowait((event_name, payload))
            except Exception:
                pass
        return cb

    cb_attempted = make_cb("dispatch_attempted")
    cb_accepted = make_cb("dispatch_accepted")
    cb_state = make_cb("incident_state")
    subscribe("DispatchAttempted", cb_attempted)
    subscribe("DispatchAccepted", cb_accepted)
    subscribe("IncidentStateChanged", cb_state)

    async def gen():
        closed = False
        try:
            # initial snapshot
            yield f"event: snapshot\ndata: {json.dumps({'incident': _load_incident(inc_id)})}\n\n"
            while not closed:
                if await request.is_disconnected():
                    break
                try:
                    event_name, payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
                    # Close SSE once incident is handed off — fixes reconnect loop bug
                    if event_name == "incident_state" and payload.get("state") == "HANDED_OFF":
                        closed = True
                except asyncio.TimeoutError:
                    # heartbeat
                    yield ": heartbeat\n\n"
        finally:
            unsubscribe("DispatchAttempted", cb_attempted)
            unsubscribe("DispatchAccepted", cb_accepted)
            unsubscribe("IncidentStateChanged", cb_state)

    return StreamingResponse(gen(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
