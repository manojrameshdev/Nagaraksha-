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
        risks = conn.execute("SELECT id FROM RiskReport").fetchall()
        myths = conn.execute("SELECT id, mythFlagged FROM MythThread").fetchall()
        kb = conn.execute("SELECT COUNT(*) as c FROM KnowledgeChunk").fetchone()["c"]


    by_state: dict = {}
    for i in incidents:
        by_state[i["state"]] = by_state.get(i["state"], 0) + 1

    # only the freshest stock per hospital counts — single JOIN, no N+1
    stock_counts: dict = {}
    with db.get_conn() as conn:
        hs = conn.execute(
            """
            SELECT h.id, s.status AS stock_status
            FROM Hospital h
            LEFT JOIN (
                SELECT hs.*, ROW_NUMBER() OVER (
                    PARTITION BY hs.hospitalId ORDER BY hs.verifiedAt DESC
                ) AS rn
                FROM AntivenomStock hs
            ) s ON s.hospitalId = h.id AND s.rn = 1
            WHERE h.active = 1
            """
        ).fetchall()
    for h in hs:
        st = h["stock_status"] or "UNKNOWN"
        stock_counts[st] = stock_counts.get(st, 0) + 1

    # 14-day trend — compare tz-aware datetimes, never raw ISO strings.
    # Stored timestamps use a 'Z' suffix (db.now_iso); fromisoformat needs
    # '+00:00', so normalize first (see db.days_since).
    def _parse(ts):
        if not ts:
            return None
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            return None

    parsed_created = [(i, _parse(i["createdAt"])) for i in incidents]
    days = []
    for d in range(13, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        nxt = day + timedelta(days=1)
        count = sum(1 for _, ts in parsed_created if ts is not None and day <= ts < nxt)
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
