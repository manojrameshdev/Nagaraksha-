"""Seed realistic Karnataka demo data for the IISc presentation.

Standalone script (not a package module). Run from anywhere:

    cd backend && python seed_demo.py

Idempotent by construction: hospitals upserted by name, AntivenomStock
delete-then-insert per demo hospital, Stakeholders upserted by name, and
VillageAudit rows upserted by (gramPanchayat, district) — a second run
produces identical row counts. All seeded stakeholders carry supportType
'pilot_permission' — transparent demo marking, never a verified-consent claim.
"""
from __future__ import annotations

import os
import sys

# Make `from app import ...` work regardless of CWD (setup.py:99 contract).
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

# Default to the standard dev DB location; NAGRAKSHA_DB env var overrides
# (tests point it at a temp file).
os.environ.setdefault(
    "NAGRAKSHA_DB", os.path.join(ROOT, "backend", "db", "nagraksha.db")
)

from app import database as db  # noqa: E402
from app.database import get_conn, init_db, new_id, now_iso  # noqa: E402

_HOSPITALS = [
    # (name, lat, lng, address, contact, complianceScore)
    ("Mandya District Hospital", 12.5213, 76.8948, "Mandya, Karnataka", "+918232220001", 91.5),
    ("Tumkur District Hospital", 13.3379, 77.1173, "Tumkur, Karnataka", "+918162202002", 78.0),
    ("Hassan District Hospital", 13.0057, 76.1005, "Hassan, Karnataka", "+918172268003", 56.0),
    ("K.R. Hospital Mysore", 12.2958, 76.6394, "Mysore, Karnataka", "+918212520004", 88.0),
    ("Rajarajeshwari Medical Nagara", 12.9141, 77.4986, "Bangalore, KA", "+918028605005", 45.0),
]

_STAKEHOLDERS = [
    # (name, organization, role, contact, district)
    ("Gerry Martin", "The Liana Trust", "Field Expert / Snake Rescuer", "gerry@thelianatrust.org", "Karnataka"),
    ("Dr. Ravi Shankar", "Mandya District Health Dept", "District Health Officer", "+919844001234", "Mandya"),
    ("NSS Coordinator", "MS Ramaiah Institute of Technology", "Academic Pilot Partner", "nss@msrit.edu", "Bangalore"),
]

_VILLAGES = [
    # (gramPanchayat, district, lat, lng, householdsVisited, aggregateRiskScore)
    ("Malavalli", "Mandya", 12.3882, 77.0827, 4, 58.0),
    ("Srirangapatna", "Mandya", 12.4278, 76.7013, 7, 72.0),
    ("Tiptur", "Tumkur", 13.2641, 76.4774, 3, 41.0),
]


def _stock_status(compliance: float) -> str:
    """Map compliance score to stock status: CONFIRMED (>70) / LOW (>45) / OUT."""
    if compliance > 70:
        return "CONFIRMED"
    if compliance > 45:
        return "LOW"
    return "OUT"


def _seed_hospitals(conn) -> int:
    now = now_iso()
    for name, lat, lng, address, contact, compliance in _HOSPITALS:
        existing = conn.execute(
            "SELECT id FROM Hospital WHERE name=?", (name,)
        ).fetchone()
        if existing:
            hid = existing["id"]
            conn.execute(
                "UPDATE Hospital SET lat=?, lng=?, address=?, contact=?, active=1, "
                "complianceScore=?, complianceUpdatedAt=?, updatedAt=? WHERE id=?",
                (lat, lng, address, contact, compliance, now, now, hid),
            )
        else:
            hid = db.new_id()
            conn.execute(
                "INSERT INTO Hospital (id, name, lat, lng, address, contact, active, "
                "createdAt, updatedAt, complianceScore, complianceUpdatedAt) "
                "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
                (hid, name, lat, lng, address, contact, now, now, compliance, now),
            )
        # Delete-then-insert stock per demo hospital so re-runs never accumulate.
        conn.execute("DELETE FROM AntivenomStock WHERE hospitalId=?", (hid,))
        conn.execute(
            "INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, "
            "verifiedAt, verifiedBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                db.new_id(),
                hid,
                "Indian Polyvalent Antivenom (VINS/Bharat Serums)",
                _stock_status(compliance),
                "11-20 vials",
                now,
                "Dr. Pharmacy",
            ),
        )
        print(f"  Seeded hospital {name} (compliance {compliance} -> {_stock_status(compliance)})")
    return len(_HOSPITALS)


def _seed_stakeholders(conn) -> int:
    now = now_iso()
    for name, org, role, contact, district in _STAKEHOLDERS:
        existing = conn.execute(
            "SELECT id FROM Stakeholder WHERE name=?", (name,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE Stakeholder SET organization=?, role=?, supportType=?, contact=?, "
                "district=? WHERE id=?",
                (org, role, "pilot_permission", contact, district, existing["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO Stakeholder (id, name, organization, role, supportType, "
                "contact, district, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), name, org, role, "pilot_permission", contact, district, now),
            )
    return len(_STAKEHOLDERS)


def _seed_village_audits(conn) -> int:
    now = now_iso()
    for gp, district, lat, lng, households, risk in _VILLAGES:
        existing = conn.execute(
            "SELECT id FROM VillageAudit WHERE gramPanchayat=? AND district=?",
            (gp, district),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE VillageAudit SET ashaWorkerId=?, auditDate=?, lat=?, lng=?, "
                "householdsVisited=?, aggregateRiskScore=?, createdAt=? WHERE id=?",
                ("asha-worker-001", "2026-08-10", lat, lng, households, risk, now, existing["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO VillageAudit (id, ashaWorkerId, gramPanchayat, district, "
                "auditDate, lat, lng, householdsVisited, aggregateRiskScore, createdAt) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), "asha-worker-001", gp, district, "2026-08-10", lat, lng,
                 households, risk, now),
            )
    return len(_VILLAGES)


def run():
    """Seed the Karnataka demo dataset. Idempotent — safe to call repeatedly."""
    init_db()  # migrate_db() ALTERs complianceScore/complianceUpdatedAt onto Hospital first
    print("Seeding Karnataka demo data (IISc presentation)...")

    with get_conn() as conn:
        hospitals = _seed_hospitals(conn)
        stakeholders = _seed_stakeholders(conn)
        villages = _seed_village_audits(conn)

        summary = {
            "hospitals": hospitals,
            "stakeholders": stakeholders,
            "villageAudits": villages,
        }
        print(f"Seeded {hospitals} hospitals, {stakeholders} stakeholders, {villages} village audits.")
        return summary


if __name__ == "__main__":
    run()
