"""Seed NagRaksha demo data: hospitals, antivenom stock, risk reports, KB."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from . import database as db
from .rag import ensure_kb_seeded


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def run():
    db.init_db()
    print("Seeding NagRaksha demo data (Python backend)...")

    now = datetime.now(timezone.utc)
    hospitals = [
        ("District Hospital A", 12.8003, 77.5954, "Bannerghatta, Bengaluru", "+91 80 2655 0100",
         "Polyvalent ASV", "CONFIRMED", "40-80 vials", now - timedelta(minutes=8), "Pharmacy"),
        ("Hospital B - Jayanagar", 12.9250, 77.5938, "Jayanagar, Bengaluru", "+91 80 2655 0200",
         "Polyvalent ASV", "UNKNOWN", "unknown", now - timedelta(hours=26), None),
        ("Hospital C - Rural Tumkur", 13.3409, 77.1000, "Tumakuru 572101", "+91 816 220 1100",
         "Polyvalent ASV", "LOW", "5-10 vials", now - timedelta(minutes=42), "Pharmacy"),
        ("Hospital D - Kengeri", 12.9172, 77.4865, "Kengeri, Bengaluru", "+91 80 2655 0300",
         "Polyvalent ASV", "OUT", "0 vials", now - timedelta(hours=3), "Pharmacy"),
    ]
    with db.get_conn() as conn:
        for t in ("AntivenomStock", "Hospital", "RiskReport"):
            conn.execute(f"DELETE FROM {t}")  # nosec B608 – table name from hardcoded tuple, no user input
        for h in hospitals:
            hid = db.new_id()
            conn.execute(
                "INSERT INTO Hospital (id, name, lat, lng, address, contact, active, createdAt, updatedAt) "
                "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
                (hid, h[0], h[1], h[2], h[3], h[4], _iso(now), _iso(now)),
            )
            conn.execute(
                "INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), hid, h[5], h[6], h[7], _iso(h[8]), h[9]),
            )
        risks = [
            ("Bannerghatta Forest Edge", 12.8003, 77.5954, "HIGH", 78,
             "Monsoon 28C 86% humidity post-rain", "Monsoon",
             "Russell's viper, Saw-scaled viper, Indian cobra, Common krait"),
            ("Bengaluru Urban Core", 12.9719, 77.5937, "MODERATE", 46,
             "Pre-monsoon 31C 64% humidity", "Pre-monsoon",
             "Indian cobra, Rat snake, Wolf snake"),
            ("Tumakuru Rural Belt", 13.3409, 77.1000, "SEVERE", 88,
             "Monsoon 26C 92% humidity heavy rain", "Monsoon",
             "Russell's viper, Saw-scaled viper, Common krait"),
        ]
        for r in risks:
            conn.execute(
                "INSERT INTO RiskReport (id, area, lat, lng, level, score, weather, season, likelySnakes, createdAt) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], _iso(now)),
            )
    ensure_kb_seeded()
    with db.get_conn() as conn:
        kb = conn.execute("SELECT COUNT(*) as c FROM KnowledgeChunk").fetchone()["c"]
    print(f"Seeded {len(hospitals)} hospitals, {len(risks)} risks, {kb} KB chunks.")
