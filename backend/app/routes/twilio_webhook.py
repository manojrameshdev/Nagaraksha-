"""Twilio SMS webhook — handles ACCEPT/READY replies from responders.

Twilio calls POST /webhook/twilio when a responder texts back.
Updates the DispatchAttempt and broadcasts via WebSocket.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import Response

from .. import database as db
from ..auth import require_role_if_enforced
from ..routes.ws import broadcast

router = APIRouter()


@router.post("/webhook/twilio")
async def twilio_sms_reply(request: Request):
    """Handles ACCEPT/READY/DECLINE replies from responders via Twilio."""
    form = await request.form()

    # Validate the Twilio signature when credentials are configured, so a
    # spoofed sender can't accept/decline dispatches.
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if token:
        from twilio.request_validator import RequestValidator

        signature = request.headers.get("X-Twilio-Signature", "")
        if not RequestValidator(token).validate(str(request.url), form, signature):
            return Response(status_code=403, content="Invalid Twilio signature")

    body = str(form.get("Body", "") or "")
    sender = str(form.get("From", "") or "")
    reply = body.strip().upper()

    # Find the responder by phone number
    with db.get_conn() as conn:
        responder = conn.execute(
            "SELECT * FROM Responder WHERE phone=?", (sender,)
        ).fetchone()

    if not responder:
        # Unknown sender — ignore silently (return valid Twilio XML)
        return _twiml_response("")

    responder = dict(responder)
    incident_id = responder.get("activeIncidentId")

    if not incident_id:
        return _twiml_response("No active incident found for your number.")

    if reply in ("ACCEPT", "READY"):
        with db.get_conn() as conn:
            # Accept this responder's own pending attempt (scoped by responderId), so
            # a first-aider ACCEPT never flips the ambulance lane's attempt.
            attempt = conn.execute(
                "SELECT id, category FROM DispatchAttempt "
                "WHERE incidentId=? AND responderId=? AND outcome='PENDING' "
                "ORDER BY sequence ASC LIMIT 1",
                (incident_id, responder["id"]),
            ).fetchone()
            if attempt:
                conn.execute(
                    "UPDATE DispatchAttempt SET outcome='ACCEPTED', acceptedAt=? WHERE id=?",
                    (db.now_iso(), attempt["id"]),
                )

        await broadcast(incident_id, "dispatch_accepted", {
            "attemptId": attempt["id"] if attempt else None,
            "responderName": responder["name"],
            "responderPhone": sender,
            "response": reply,
            "acceptedAt": db.now_iso(),
        })
        return _twiml_response(f"✅ Confirmed. You are dispatched to incident {incident_id[:8]}.")

    if reply in ("DECLINE", "BUSY", "NO"):
        with db.get_conn() as conn:
            attempt = conn.execute(
                "SELECT id FROM DispatchAttempt "
                "WHERE incidentId=? AND responderId=? AND outcome='PENDING' "
                "ORDER BY sequence ASC LIMIT 1",
                (incident_id, responder["id"]),
            ).fetchone()
            if attempt:
                conn.execute(
                    "UPDATE DispatchAttempt SET outcome='DECLINED' WHERE id=?",
                    (attempt["id"],),
                )

        await broadcast(incident_id, "dispatch_declined", {
            "responderPhone": sender,
            "response": reply,
        })
        return _twiml_response("Understood. We will contact the next available responder.")

    return _twiml_response("")


def _twiml_response(message: str) -> Response:
    """Return a minimal Twilio TwiML XML response."""
    body = f"<Message>{message}</Message>" if message else ""
    xml = f'<?xml version="1.0" encoding="UTF-8"?><Response>{body}</Response>'
    return Response(content=xml, media_type="text/xml")


@router.post("/api/responders")
def register_responder(
    name: str = Form(...),
    phone: str = Form(...),
    role: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    skills: str = Form(default=""),
    _role: str = Depends(require_role_if_enforced("system_admin")),
):
    """Register a real responder in the database (system_admin when enforced)."""
    rid = db.new_id()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Responder (id, name, phone, role, lat, lng, verified, skills, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (rid, name, phone, role, lat, lng, skills, db.now_iso()),
        )
    return {"id": rid, "name": name, "phone": phone, "role": role}


@router.get("/api/responders")
def list_responders():
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, role, lat, lng, verified, skills, activeIncidentId, createdAt "
            "FROM Responder ORDER BY createdAt DESC"
        ).fetchall()
    return {"responders": [dict(r) for r in rows]}
