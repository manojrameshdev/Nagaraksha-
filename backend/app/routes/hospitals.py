"""Hospital routes — list (ranked) + stock update."""
from __future__ import annotations

from fastapi import APIRouter, Request
from ..models import StockUpdate
from .. import database as db
from ..eventbus import audit, get_ranked_hospitals

router = APIRouter()


@router.get("/api/hospitals")
def list_hospitals(request: Request):
    lat = float(request.query_params.get("lat", 12.8003))
    lng = float(request.query_params.get("lng", 77.5954))
    return {"hospitals": get_ranked_hospitals(lat, lng), "origin": {"lat": lat, "lng": lng}}


@router.patch("/api/hospitals/{hid}/stock")
def update_stock(hid: str, body: StockUpdate):
    with db.get_conn() as conn:
        h = conn.execute("SELECT id FROM Hospital WHERE id=?", (hid,)).fetchone()
        if not h:
            return {"error": "Hospital not found"}
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
