"""Hospital routes — list (ranked) + stock update."""
from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from ..models import StockUpdate, HospitalCapabilityUpdate
from .. import database as db
from ..auth import require_role_if_enforced
from ..eventbus import audit, get_ranked_hospitals

router = APIRouter()



@router.get("/api/hospitals")
def list_hospitals(
    lat: float = Query(12.8003, ge=-90, le=90, description="Latitude of origin"),
    lng: float = Query(77.5954, ge=-180, le=180, description="Longitude of origin"),
):
    return {"hospitals": get_ranked_hospitals(lat, lng), "origin": {"lat": lat, "lng": lng}}


@router.patch("/api/hospitals/{hid}/stock")
def update_stock(
    hid: str,
    body: StockUpdate,
    role: str = Depends(require_role_if_enforced("hospital_admin", "system_admin")),
):
    with db.get_conn() as conn:
        h = conn.execute("SELECT id FROM Hospital WHERE id=?", (hid,)).fetchone()
        if not h:
            raise HTTPException(status_code=404, detail="Hospital not found")
        stock_id = db.new_id()
        conn.execute(
            "INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (stock_id, hid, body.product, body.status, body.quantityBand, db.now_iso(), body.verifiedBy),
        )
        conn.execute("DELETE FROM AntivenomStock WHERE hospitalId=? AND id!=?", (hid, stock_id))
    audit(incident_id=None, actor="hospital", action="STOCK_UPDATED", entity="AntivenomStock",
          metadata={"hospitalId": hid, "status": body.status})
    return {"hospitalId": hid, "stock": {
        "product": body.product, "status": body.status,
        "quantityBand": body.quantityBand, "verifiedAt": db.now_iso(), "verifiedBy": body.verifiedBy,
    }}


@router.get("/api/hospitals/{hid}/capabilities")
def get_capabilities(hid: str):
    with db.get_conn() as conn:
        h = conn.execute("SELECT id, name, facilityLevel, capabilities, ventilatorCount, icuBedsAvailable FROM Hospital WHERE id=?", (hid,)).fetchone()
        if not h:
            raise HTTPException(status_code=404, detail="Hospital not found")
        hd = dict(h)
        try:
            hd["capabilities"] = json.loads(hd["capabilities"])
        except (json.JSONDecodeError, TypeError, AttributeError):
            hd["capabilities"] = [c.strip() for c in hd["capabilities"].split(",") if c.strip()]
        return hd



@router.patch("/api/hospitals/{hid}/capabilities")
def update_capabilities(
    hid: str,
    body: HospitalCapabilityUpdate,
    role: str = Depends(require_role_if_enforced("hospital_admin", "system_admin")),
):
    with db.get_conn() as conn:
        h = conn.execute("SELECT id FROM Hospital WHERE id=?", (hid,)).fetchone()
        if not h:
            raise HTTPException(status_code=404, detail="Hospital not found")
        conn.execute(
            "UPDATE Hospital SET facilityLevel=?, capabilities=?, ventilatorCount=?, icuBedsAvailable=?, updatedAt=? WHERE id=?",
            (body.facilityLevel, json.dumps(body.capabilities), body.ventilatorCount, body.icuBedsAvailable, db.now_iso(), hid),
        )
    audit(incident_id=None, actor="hospital", action="CAPABILITIES_UPDATED", entity="Hospital",
          metadata={"hospitalId": hid, "capabilities": body.capabilities, "ventilators": body.ventilatorCount})
    return {"hospitalId": hid, "facilityLevel": body.facilityLevel, "capabilities": body.capabilities,
            "ventilatorCount": body.ventilatorCount, "icuBedsAvailable": body.icuBedsAvailable}

