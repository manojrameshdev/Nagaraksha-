"""ASHA Gram Panchayat Audit Tool — backend routes.

Addresses Datir judge feedback: standardized mobile form for ASHA worker home visits.
Aggregates to GP-level risk profiles shown on the district heatmap.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from ..models import HouseholdAuditRequest, VillageAuditRequest
from .. import database as db

router = APIRouter()


def compute_household_risk(data: dict) -> float:
    """
    Weighted risk score 0-100.
    Based on WHO snakebite prevention guidelines.
    Validated by NagRaksha B.Pharm team members.
    """
    risk = 0.0
    if data.get("sleeps_on_floor"):
        risk += 25  # highest risk factor
    if data.get("has_wall_gaps"):
        risk += 20  # snake entry point
    if not data.get("adequate_lighting"):
        risk += 15  # can't see snake at night
    if not data.get("wears_footwear_night"):
        risk += 15  # most bites on feet
    if data.get("near_agri_field"):
        risk += 10  # snake habitat proximity
    if data.get("prior_snakebite"):
        risk += 10  # high-risk household history
    if not data.get("knows_myths_facts"):
        risk += 5   # dangerous myth adherence
    # knowsNearestHospital is protective but doesn't increase risk
    return min(100.0, round(risk, 1))



@router.post("/api/audit/village")
def start_village_audit(body: VillageAuditRequest):
    """Start a new village audit session for an ASHA worker."""
    vid = db.new_id()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO VillageAudit "
            "(id, ashaWorkerId, gramPanchayat, district, auditDate, lat, lng, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (vid, body.asha_worker_id, body.gram_panchayat,
             body.district, body.audit_date, body.lat, body.lng, db.now_iso()),
        )
    return {"villageAuditId": vid, "gramPanchayat": body.gram_panchayat, "district": body.district}


@router.post("/api/audit/village/{village_audit_id}/household")
def submit_household(village_audit_id: str, body: HouseholdAuditRequest):
    """Submit a household risk assessment form and update GP aggregate score."""
    with db.get_conn() as conn:
        va = conn.execute(
            "SELECT id FROM VillageAudit WHERE id=?", (village_audit_id,)
        ).fetchone()
    if not va:
        raise HTTPException(status_code=404, detail="Village audit session not found")

    risk = compute_household_risk(body.model_dump())
    hid = db.new_id()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO HouseholdAudit "
            "(id, villageAuditId, lat, lng, sleepsOnFloor, hasWallGaps, adequateLighting, "
            "wearsFootwearNight, nearAgriField, priorSnakebite, knowsMythsFacts, "
            "knowsNearestHospital, riskScore, notes, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                hid, village_audit_id, body.lat, body.lng,
                int(body.sleeps_on_floor), int(body.has_wall_gaps),
                int(body.adequate_lighting), int(body.wears_footwear_night),
                int(body.near_agri_field), int(body.prior_snakebite),
                int(body.knows_myths_facts), int(body.knows_nearest_hospital),
                risk, body.notes, db.now_iso(),
            ),
        )
        # Update aggregate risk score and household count for the village
        conn.execute(
            """UPDATE VillageAudit SET
                householdsVisited = householdsVisited + 1,
                aggregateRiskScore = (
                    SELECT AVG(riskScore) FROM HouseholdAudit WHERE villageAuditId = ?
                )
            WHERE id = ?""",
            (village_audit_id, village_audit_id),
        )
    return {"id": hid, "riskScore": risk, "riskLabel": _risk_label(risk)}


@router.get("/api/audit/village/{village_audit_id}")
def get_village_audit(village_audit_id: str):
    """Get a village audit session with all household records."""
    with db.get_conn() as conn:
        va = conn.execute(
            "SELECT * FROM VillageAudit WHERE id=?", (village_audit_id,)
        ).fetchone()
        if not va:
            raise HTTPException(status_code=404, detail="Village audit not found")
        households = [dict(r) for r in conn.execute(
            "SELECT * FROM HouseholdAudit WHERE villageAuditId=? ORDER BY createdAt ASC",
            (village_audit_id,),
        ).fetchall()]
    return {"villageAudit": dict(va), "households": households}


@router.get("/api/audit/district/{district}")
def get_district_risk(district: str):
    """Return all GP-level risk profiles for the district heatmap."""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT gramPanchayat, district, lat, lng, householdsVisited, "
            "aggregateRiskScore, auditDate, id "
            "FROM VillageAudit WHERE district=? ORDER BY aggregateRiskScore DESC",
            (district,),
        ).fetchall()
    return {
        "district": district,
        "gramPanchayats": [
            {**dict(r), "riskLabel": _risk_label(r["aggregateRiskScore"] or 0)}
            for r in rows
        ],
    }


@router.get("/api/audit/districts")
def list_districts():
    """List all districts that have audit data."""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT district, COUNT(*) as gpCount FROM VillageAudit GROUP BY district"
        ).fetchall()
    return {"districts": [dict(r) for r in rows]}


def _risk_label(score: float) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MODERATE"
    return "LOW"
