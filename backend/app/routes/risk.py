"""Weather-based risk advisory (FR-7.1)."""
from __future__ import annotations

import math
from fastapi import APIRouter, Query
from .. import database as db

router = APIRouter()

ADVISORIES = {
    "LOW": "Encounter risk is low. Standard field precautions apply — carry a light, watch where you step.",
    "MODERATE": "Moderate encounter risk. Wear closed footwear, use a torch after dark, avoid tall grass and dry woodpiles.",
    "HIGH": "High encounter risk. Snakes are active in these conditions. Use a stick to probe ahead, keep children away from vegetation edges, keep mobile SOS ready.",
    "SEVERE": "Severe encounter risk. Post-monsoon conditions strongly favour snake movement. Avoid walking through fields at dusk and dawn; if bitten, do not waste time on folk remedies — trigger SOS immediately.",
}


@router.get("/api/risk")
def get_risk(
    lat: float = Query(12.8003, ge=-90, le=90, description="Latitude of origin"),
    lng: float = Query(77.5954, ge=-180, le=180, description="Longitude of origin"),
):
    # Narrow the scan with a bounding box around the origin; fall back to the
    # full table only when nothing is nearby.
    with db.get_conn() as conn:
        reports = conn.execute(
            "SELECT * FROM RiskReport WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? "
            "ORDER BY createdAt DESC",
            (lat - 2.0, lat + 2.0, lng - 2.0, lng + 2.0),
        ).fetchall()
        if not reports:
            reports = conn.execute(
                "SELECT * FROM RiskReport ORDER BY createdAt DESC"
            ).fetchall()
    if not reports:
        return {"level": "UNKNOWN", "score": 0, "advisory": "No risk data available."}
    nearest = min(reports, key=lambda r: math.hypot(r["lat"] - lat, r["lng"] - lng))
    return {
        "area": nearest["area"], "level": nearest["level"], "score": nearest["score"],
        "weather": nearest["weather"], "season": nearest["season"],
        "likelySnakes": [s.strip() for s in nearest["likelySnakes"].split(",")] if nearest["likelySnakes"] else [],
        "advisory": ADVISORIES.get(nearest["level"], ADVISORIES["MODERATE"]),
        "origin": {"lat": lat, "lng": lng},
    }
