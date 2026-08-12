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
    except Exception as e:
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
    Main dispatch function. Uses Twilio if available, else simulate_dispatch().
    Returns the same structure as simulate_dispatch() for compatibility.
    """
    lat, lng = incident.get("lat", 12.8), incident.get("lng", 77.6)

    # Check if real responders exist
    first_aiders = get_nearest_responders(lat, lng, "first_aider")
    rescuers = get_nearest_responders(lat, lng, "snake_rescue")
    coordinators = get_nearest_responders(lat, lng, "hospital_coordinator")

    use_twilio = bool(_twilio_client() and TWILIO_FROM)

    if first_aiders or rescuers or coordinators:
        # Send real SMS via Twilio (if available)
        for r in first_aiders:
            msg = _build_message("first_aider", incident, r)
            sid = dispatch_sms(r["phone"], msg) if use_twilio else None
            print(f"[Dispatch] {'SMS sent' if sid else 'Simulated'} → {r['name']} ({r['phone']})")

        for r in rescuers:
            msg = _build_message("snake_rescue", incident, r)
            sid = dispatch_sms(r["phone"], msg) if use_twilio else None
            print(f"[Dispatch] {'SMS sent' if sid else 'Simulated'} → {r['name']} ({r['phone']})")

        for r in coordinators:
            msg = _build_message("hospital_coordinator", incident, r)
            sid = dispatch_sms(r["phone"], msg) if use_twilio else None
            print(f"[Dispatch] {'SMS sent' if sid else 'Simulated'} → {r['name']} ({r['phone']})")

        return {
            "trained": [{"name": r["name"], "role": r["role"], "distanceKm": r["distanceKm"],
                          "etaMin": r["etaMin"], "phone": r["phone"], "accept": True,
                          "acceptAt": 0} for r in first_aiders],
            "rescue": [{"name": r["name"], "role": r["role"], "distanceKm": r["distanceKm"],
                         "etaMin": r["etaMin"], "phone": r["phone"], "accept": True,
                         "acceptAt": 0} for r in rescuers],
            "ambulance": [{"name": r["name"], "role": r["role"], "distanceKm": r["distanceKm"],
                            "etaMin": r["etaMin"], "phone": r["phone"], "accept": True,
                            "acceptAt": 0} for r in coordinators],
        }

    # No real responders registered — fall back to simulated data
    print("[Dispatch] No real responders found, using simulate_dispatch()")
    return simulate_dispatch({"lat": lat, "lng": lng})
