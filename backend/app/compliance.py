"""
Hospital compliance scoring — runs every 15 minutes via APScheduler.

Hospitals that don't update antivenom stock get deprioritized in routing.
Score is visible to admins and dispatch coordinators via a badge.

Formula:
  freshness  = 100 * exp(-0.099 * days_stale)   → halves every ~7 days
  activity   = min(30, updates_in_last_30d * 3)  → up to 30 bonus points
  score      = min(100, freshness + activity)
"""
from __future__ import annotations

import math

from . import database as db


def compute_compliance_score(hospital_id: str) -> float:
    """Compute a 0-100 compliance score for a hospital based on stock update freshness."""
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT MAX(verifiedAt) as last_update FROM AntivenomStock WHERE hospitalId=?",
            (hospital_id,),
        ).fetchone()
        last_update = row["last_update"] if row else None

        updates_30d = conn.execute(
            "SELECT COUNT(*) as cnt FROM AntivenomStock "
            "WHERE hospitalId=? AND verifiedAt >= datetime('now', '-30 days')",
            (hospital_id,),
        ).fetchone()["cnt"]

    if not last_update:
        return 0.0  # Never updated = 0

    days_stale = db.days_since(last_update)
    freshness = 100.0 * math.exp(-0.099 * days_stale)  # ~50% at 7 days
    activity_bonus = min(30.0, updates_30d * 3.0)
    return min(100.0, round(freshness + activity_bonus, 1))


def compliance_badge(score: float) -> dict:
    """Return badge metadata for a compliance score."""
    if score >= 80:
        return {"label": "Verified Reliable", "color": "green", "emoji": "🟢"}
    if score >= 50:
        return {"label": "Check Before Routing", "color": "yellow", "emoji": "🟡"}
    return {"label": "Deprioritized — Stock Data Unreliable", "color": "red", "emoji": "🔴"}


def run_compliance_job() -> None:
    """Called by APScheduler every 15 minutes. Updates complianceScore for all hospitals."""
    try:
        with db.get_conn() as conn:
            hospital_ids = [r["id"] for r in conn.execute("SELECT id FROM Hospital").fetchall()]

        scores: list[tuple[float, str]] = []
        for hid in hospital_ids:
            score = compute_compliance_score(hid)
            scores.append((score, hid))

        # Sort descending to assign rank
        scores_sorted = sorted(scores, key=lambda x: -x[0])
        with db.get_conn() as conn:
            for rank, (score, hid) in enumerate(scores_sorted, start=1):
                conn.execute(
                    "UPDATE Hospital SET complianceScore=?, complianceUpdatedAt=?, complianceRank=? WHERE id=?",
                    (score, db.now_iso(), rank, hid),
                )
        print(f"[Compliance] Updated {len(hospital_ids)} hospitals")
    except Exception as e:
        print(f"[Compliance] Job failed: {e}")
