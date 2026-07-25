"""Stats route — admin analytics (FR-9.1, 9.2)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter
from .. import database as db

router = APIRouter()


@router.get("/api/stats")
def stats():
    with db.get_conn() as conn:
        incidents = conn.execute("SELECT id, state, createdAt FROM Incident").fetchall()
        hospitals = conn.execute("SELECT id FROM Hospital").fetchall()
        stocks = conn.execute("SELECT status FROM AntivenomStock").fetchall()
        risks = conn.execute("SELECT id FROM RiskReport").fetchall()
        myths = conn.execute("SELECT id, mythFlagged FROM MythThread").fetchall()
        kb = conn.execute("SELECT COUNT(*) as c FROM KnowledgeChunk").fetchone()["c"]

    by_state: dict = {}
    for i in incidents:
        by_state[i["state"]] = by_state.get(i["state"], 0) + 1
    stock_counts: dict = {}
    # only the freshest stock per hospital counts
    seen = set()
    # re-query freshest
    with db.get_conn() as conn:
        hs = conn.execute("SELECT id FROM Hospital WHERE active=1").fetchall()
        for h in hs:
            s = conn.execute(
                "SELECT status FROM AntivenomStock WHERE hospitalId=? ORDER BY verifiedAt DESC LIMIT 1",
                (h["id"],),
            ).fetchone()
            st = s["status"] if s else "UNKNOWN"
            stock_counts[st] = stock_counts.get(st, 0) + 1

    # 14-day trend
    days = []
    for d in range(13, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        nxt = day + timedelta(days=1)
        count = sum(1 for i in incidents if day.isoformat() <= (i["createdAt"] or "") < nxt.isoformat())
        days.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    return {
        "totals": {
            "incidents": len(incidents), "hospitals": len(hospitals),
            "riskAreas": len(risks), "mythConversations": len(myths),
            "mythsBusted": sum(1 for m in myths if m["mythFlagged"]),
            "knowledgeChunks": kb,
        },
        "incidentsByState": by_state,
        "stockDistribution": stock_counts,
        "incidentTrend14d": days,
        "annualDeathsIndia": 58000,
        "parallelDispatchLanes": 3,
    }
