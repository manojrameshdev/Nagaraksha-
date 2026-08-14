"""Compliance scoring tests — pure function + DB-backed score checks."""

from app import database as db
from app.compliance import compliance_badge, compute_compliance_score, run_compliance_job


def _hospital():
    hid = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Hospital (id, name, lat, lng, address, contact, active, createdAt, updatedAt) "
            "VALUES (?, 'Compliance Test', 12.8, 77.6, 'Test', '', 1, ?, ?)",
            (hid, now, now),
        )
    return hid


class TestComplianceBadge:
    def test_green_over_80(self):
        assert compliance_badge(85)["color"] == "green"

    def test_yellow_50_79(self):
        assert compliance_badge(60)["color"] == "yellow"

    def test_red_under_50(self):
        assert compliance_badge(20)["color"] == "red"


class TestComputeComplianceScore:
    def test_no_stock_is_zero(self):
        hid = _hospital()
        try:
            assert compute_compliance_score(hid) == 0.0
        finally:
            with db.get_conn() as conn:
                conn.execute("DELETE FROM Hospital WHERE id=?", (hid,))

    def test_fresh_stock_scores_high(self):
        hid = _hospital()
        try:
            with db.get_conn() as conn:
                conn.execute(
                    "INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) "
                    "VALUES (?, ?, 'Polyvalent ASV', 'CONFIRMED', '10+', ?, 'Test')",
                    (db.new_id(), hid, db.now_iso()),
                )
            score = compute_compliance_score(hid)
            assert score > 80
        finally:
            with db.get_conn() as conn:
                conn.execute("DELETE FROM AntivenomStock WHERE hospitalId=?", (hid,))
                conn.execute("DELETE FROM Hospital WHERE id=?", (hid,))


class TestRunComplianceJob:
    def test_updates_compliance_columns(self):
        hid = _hospital()
        try:
            with db.get_conn() as conn:
                conn.execute(
                    "INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) "
                    "VALUES (?, ?, 'Polyvalent ASV', 'CONFIRMED', '10+', ?, 'Test')",
                    (db.new_id(), hid, db.now_iso()),
                )
            run_compliance_job()
            with db.get_conn() as conn:
                row = conn.execute(
                    "SELECT complianceScore, complianceRank FROM Hospital WHERE id=?", (hid,)
                ).fetchone()
            assert row is not None
            assert row["complianceScore"] is not None
            assert row["complianceRank"] == 1
        finally:
            with db.get_conn() as conn:
                conn.execute("DELETE FROM AntivenomStock WHERE hospitalId=?", (hid,))
                conn.execute("DELETE FROM Hospital WHERE id=?", (hid,))
