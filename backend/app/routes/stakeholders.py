"""Stakeholder Registry — documents real community engagement.

Addresses Datir judge feedback: "0/10 stakeholder buy-in, no documented authority support."
Seed real entries before the demo (Gerry Martin / Karnataka FD / MSRIT NSS).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from ..models import StakeholderRequest
from .. import database as db
from ..auth import require_role

router = APIRouter()


@router.get("/api/stakeholders")
def list_stakeholders():
    """Public endpoint — show documented stakeholder support in demo."""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, organization, role, supportType, district, addedAt "
            "FROM Stakeholder ORDER BY addedAt DESC"
        ).fetchall()
    return {
        "stakeholders": [dict(r) for r in rows],
        "count": len(rows),
    }


@router.post("/api/stakeholders")
def add_stakeholder(
    body: StakeholderRequest,
    role: str = Depends(require_role("system_admin")),
):
    """Admin-only: add a stakeholder entry (requires system_admin JWT)."""
    sid = db.new_id()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Stakeholder (id, name, organization, role, supportType, contact, district, addedAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, body.name, body.organization, body.role,
             body.support_type, body.contact, body.district, db.now_iso()),
        )
    return {"id": sid, "name": body.name, "organization": body.organization}


@router.delete("/api/stakeholders/{stakeholder_id}")
def remove_stakeholder(
    stakeholder_id: str,
    role: str = Depends(require_role("system_admin")),
):
    with db.get_conn() as conn:
        conn.execute("DELETE FROM Stakeholder WHERE id=?", (stakeholder_id,))
    return {"deleted": stakeholder_id}
