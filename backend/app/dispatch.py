"""Real SMS dispatch via Twilio — replaces simulate_dispatch() fake data.

Falls back to simulate_dispatch() if TWILIO_ACCOUNT_SID is not set,
so the demo works without Twilio credentials.
"""
from __future__ import annotations

import os
from typing import Optional

from . import database as db
from .domain import simulate_dispatch


def _twilio_client():
    """Lazy-load Twilio client only when credentials are available."""
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not sid or not token:
        return None
    from twilio.rest import Client
    return Client(sid, token)


TWILIO_FROM = os.environ.get("TWILIO_PHONE_NUMBER", "")


def _load_incident(incident: dict) -> dict:
    """Enrich the outbox payload with the persisted Incident row (for SMS context)."""
    inc_id = incident.get("incidentId")
    if inc_id:
        with db.get_conn() as conn:
            row = conn.execute("SELECT * FROM Incident WHERE id=?", (inc_id,)).fetchone()
            if row:
                return {**incident, **dict(row)}
    return incident


def _build_message(lane: str, incident: dict, responder: dict) -> str:
    templates = {
        "first_aider": (
            f"🚨 NagRaksha SOS — {incident.get('ref', 'NR-???')}\n"
            f"Snakebite at {incident.get('lat', 0):.4f},{incident.get('lng', 0):.4f}\n"
            f"Bite time: {incident.get('biteTime', 'unknown')}\n"
            f"You are the nearest first-aider ({responder.get('distanceKm', '?')} km).\n"
            f"Reply ACCEPT to confirm dispatch."
        ),
        "snake_rescue": (
            f"🐍 NagRaksha — Snake Rescue Request {incident.get('ref', 'NR-???')}\n"
            f"Location: {incident.get('lat', 0):.4f},{incident.get('lng', 0):.4f}\n"
            f"Reply ACCEPT to dispatch."
        ),
        "hospital_coordinator": (
            f"🏥 NagRaksha Pre-Alert — {incident.get('ref', 'NR-???')}\n"
            f"Snakebite patient en route. ETA: ~{incident.get('etaMin', '?')} min.\n"
            f"Prepare antivenom. Severity: {incident.get('severityScore', '?')}/100.\n"
            f"Reply READY to confirm."
        ),
    }
    return templates.get(lane, f"NagRaksha SOS dispatch — {incident.get('ref', '')}")


def dispatch_sms(to_phone: str, message: str) -> Optional[str]:
    """Send an SMS via Twilio. Returns message SID or None if unavailable."""
    client = _twilio_client()
    if not client or not TWILIO_FROM:
        return None
    try:
        msg = client.messages.create(body=message, from_=TWILIO_FROM, to=to_phone)
        return msg.sid
    except (RuntimeError, ValueError, OSError, KeyError) as e:
        print(f"[Dispatch] Twilio SMS failed to {to_phone}: {e}")
        return None



def get_nearest_responders(lat: float, lng: float, role: str, limit: int = 2) -> list[dict]:
    """Fetch the nearest verified responders for a role from the Responder table."""
    from .domain import haversine_km, road_km, eta_min
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM Responder WHERE role=? AND verified=1 AND activeIncidentId IS NULL",
            (role,),
        ).fetchall()
    candidates = []
    for r in [dict(r) for r in rows]:
        straight = haversine_km(lat, lng, r["lat"], r["lng"])
        dist = road_km(straight)
        r["distanceKm"] = round(dist, 1)
        r["etaMin"] = eta_min(dist)
        candidates.append(r)
    return sorted(candidates, key=lambda x: x["distanceKm"])[:limit]


def do_dispatch(incident: dict) -> dict:
    """
    Main dispatch function. Uses real registered responders (Twilio SMS when
    credentials exist), else falls back to simulate_dispatch().

    Returns the same lane structure as simulate_dispatch() so callers are
    agnostic; real-responder entries additionally carry `responderId`, `phone`
    and `smsSid` so the outbox worker can persist them in DispatchAttempt.
    """
    incident = _load_incident(incident)
    lat, lng = incident.get("lat", 12.8), incident.get("lng", 77.6)
    inc_id = incident.get("incidentId")

    # Check if real responders exist
    first_aiders = get_nearest_responders(lat, lng, "first_aider")
    rescuers = get_nearest_responders(lat, lng, "snake_rescue")
    coordinators = get_nearest_responders(lat, lng, "hospital_coordinator")

    use_twilio = bool(_twilio_client() and TWILIO_FROM)

    if first_aiders or rescuers or coordinators:
        # Bind the incident to the responders we are actually dispatching to,
        # so their SMS reply (accept/decline) resolves to this incident.
        if inc_id:
            selected = first_aiders + rescuers + coordinators
            with db.get_conn() as conn:
                for r in selected:
                    conn.execute(
                        "UPDATE Responder SET activeIncidentId=? WHERE id=?",
                        (inc_id, r["id"]),
                    )

        def _lane(role_lane: str, responders: list[dict]) -> list[dict]:
            out = []
            for r in responders:
                msg = _build_message(role_lane, incident, r)
                sid = dispatch_sms(r["phone"], msg) if use_twilio else None
                # ASCII-only prints: non-ASCII arrows crash workers on
                # Windows consoles (cp1252 cannot encode '→').
                print(f"[Dispatch] {'SMS sent' if sid else 'Simulated'} -> {r['name']} ({r['phone']})")
                out.append({
                    "name": r["name"], "role": r["role"],
                    "distanceKm": r["distanceKm"], "etaMin": r["etaMin"],
                    "phone": r["phone"], "responderId": r["id"],
                    "smsSid": sid,
                })
            return out

        return {
            "trained": _lane("first_aider", first_aiders),
            "rescue": _lane("snake_rescue", rescuers),
            "ambulance": _lane("hospital_coordinator", coordinators),
        }

    # No real responders registered — fall back to simulated data
    print("[Dispatch] No real responders found, using simulate_dispatch()")
    return simulate_dispatch({"lat": lat, "lng": lng})
