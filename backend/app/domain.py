"""Domain helpers — geo, dispatch simulation, hospital ranking."""
from __future__ import annotations

import math
import random
import time
from datetime import datetime, timezone


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p = math.pi / 180
    dlat = (lat2 - lat1) * p
    dlng = (lng2 - lng1) * p
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def road_km(straight_km):
    return round(straight_km * 1.32 * 10) / 10


def eta_min(road_km):
    speed = 42 if road_km > 25 else 26
    return max(2, round((road_km / speed) * 60))


def mins_ago(iso, now_ms=None):
    now = now_ms or time.time() * 1000
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000
    except Exception:
        return 0
    return max(0, round((now - t) / 60000))


def stock_freshness(status, verified_at):
    m = mins_ago(verified_at)
    if status == "OUT":
        return {"label": "Out of stock", "stale": True, "tone": "red"}
    if status == "CONFIRMED" and m <= 120:
        return {"label": f"Confirmed · verified {m} min ago", "stale": False, "tone": "green"}
    if status == "LOW":
        return {"label": f"Low stock · verified {m} min ago", "stale": False, "tone": "gold"}
    return {"label": f"Stale · last verified {m} min ago", "stale": True, "tone": "gold"}


def rank_hospitals(origin, hospitals):
    """NagRaksha ranking (FR-4.2): confirmed stock first, then travel time."""
    scored = []
    for h in hospitals:
        straight = haversine_km(origin["lat"], origin["lng"], h["lat"], h["lng"])
        dist = road_km(straight)
        eta = eta_min(dist)
        fr = stock_freshness(h["stock"]["status"], h["stock"]["verifiedAt"])
        score = 100.0
        st = h["stock"]["status"]
        if st == "CONFIRMED":
            score = 100 - eta * 0.6
        elif st == "LOW":
            score = 55 - eta * 0.6
        elif st == "UNKNOWN":
            score = 30 - eta * 0.5
        elif st == "STALE":
            score = 28 - eta * 0.5
        elif st == "OUT":
            score = 5 - eta * 0.2
        if fr["stale"] and st == "CONFIRMED":
            score -= 35
        scored.append({**h, "distanceKm": dist, "etaMin": eta, "freshness": fr, "score": round(score)})
    scored.sort(key=lambda x: -x["score"])
    for i, h in enumerate(scored):
        h["rank"] = i + 1
        h["recommended"] = i == 0
    return scored


def simulate_dispatch(origin):
    base = time.time() * 1000
    trained = [
        {"name": "Anjali M.", "role": "Trained first responder · Anekal", "distanceKm": 2.4, "etaMin": 4, "acceptAt": base + 6000, "accept": True},
        {"name": "Ravi K.", "role": "Trained first responder · Sarjapur", "distanceKm": 6.1, "etaMin": 11, "acceptAt": base + 9000, "accept": True},
    ]
    rescue = [
        {"name": "Bannerghatta Rescue Cell", "role": "Snake rescue team · certified", "distanceKm": 3.0, "etaMin": 6, "acceptAt": base + 12000, "accept": True},
        {"name": "Urban Wildlife Rescue", "role": "Snake rescue team · certified", "distanceKm": 8.2, "etaMin": 14, "acceptAt": base + 15000, "accept": True},
    ]
    ambulance = [
        {"name": "Ambulance 108 · BLR-South", "role": "State ambulance · ALS", "distanceKm": 4.6, "etaMin": 9, "acceptAt": base + 8000, "accept": True},
        {"name": "Ambulance 108 · BLR-Rural", "role": "State ambulance · BLS", "distanceKm": 9.9, "etaMin": 18, "acceptAt": base + 11000, "accept": True},
    ]
    return {"trained": trained, "rescue": rescue, "ambulance": ambulance}


def gen_incident_ref():
    n = random.randint(1000, 9999)
    return f"NR-{n}"
