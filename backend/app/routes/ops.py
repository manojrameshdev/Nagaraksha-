"""Audit + outbox + knowledge-base operational routes."""
from __future__ import annotations

import json
from fastapi import APIRouter, Query
from .. import database as db
from ..rag import retrieve

router = APIRouter()


@router.get("/api/audit")
def recent_audit():
    with db.get_conn() as conn:
        events = conn.execute(
            "SELECT * FROM AuditEvent ORDER BY timestamp DESC LIMIT 24"
        ).fetchall()
    by_action: dict = {}
    out = []
    for e in events:
        by_action[e["action"]] = by_action.get(e["action"], 0) + 1
        out.append({
            "id": e["id"], "incidentId": e["incidentId"], "actor": e["actor"],
            "action": e["action"], "entity": e["entity"],
            "metadata": json.loads(e["metadata"]) if e["metadata"] else None,
            "timestamp": e["timestamp"],
        })
    return {"count": len(out), "byAction": by_action, "events": out}


@router.get("/api/outbox")
def outbox_state():
    with db.get_conn() as conn:
        pending = conn.execute("SELECT COUNT(*) as c FROM OutboxEvent WHERE state='PENDING'").fetchone()["c"]
        processed = conn.execute("SELECT COUNT(*) as c FROM OutboxEvent WHERE state='PROCESSED'").fetchone()["c"]
        failed = conn.execute("SELECT COUNT(*) as c FROM OutboxEvent WHERE state='FAILED'").fetchone()["c"]
        recent = conn.execute(
            "SELECT id, type, aggregateId, state, attempts, createdAt, processedAt "
            "FROM OutboxEvent ORDER BY createdAt DESC LIMIT 12"
        ).fetchall()
    return {
        "summary": {"pending": pending, "processed": processed, "failed": failed,
                     "total": pending + processed + failed},
        "recent": [dict(r) for r in recent],
    }


@router.get("/api/knowledge-base")
def knowledge_base(
    q: str = Query("", description="Search query"),
    k: int = Query(4, ge=1, le=50, description="Number of results"),
):
    if q.strip():
        return {"query": q, "results": retrieve(q, k)}
    with db.get_conn() as conn:
        chunks = conn.execute(
            "SELECT id, docId, title, category, tags, reviewedBy, reviewedAt FROM KnowledgeChunk ORDER BY category ASC LIMIT 50"
        ).fetchall()
    return {
        "count": len(chunks),
        "reviewedBy": "NagRaksha medical review (demo corpus)",
        "chunks": [dict(c) for c in chunks],
    }
