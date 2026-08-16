"""Post-seed correctness + idempotency assertions for backend/seed_demo.py.

The seed script is standalone (sys.path bootstrap inside the module), so these
tests import it directly and run run() twice against an isolated temp DB to
prove exact values and re-run idempotency.
"""
import os
import tempfile

import pytest

from app import database as db
import seed_demo

_EXPECTED_HOSPITALS = {
    "Malavalli Taluk PHC": 82.0,
    "Srirangapatna CHC": 75.0,
    "Mandya District Hospital": 91.5,
    "Tumkur District Hospital": 78.0,
    "Hassan District Hospital": 56.0,
    "K.R. Hospital Mysore": 88.0,
    "Rajarajeshwari Medical Nagara": 45.0,
}


@pytest.fixture
def isolated_seed_db(monkeypatch):
    """Point db.DB_PATH at a fresh temp DB so seed tests never touch shared state.

    conftest.py imports app.database at session start (binding DB_PATH to its
    own temp file), so a module-scope NAGRAKSHA_DB env var in this file would be
    a no-op. Monkeypatching the module attribute achieves the same isolation.
    """
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    monkeypatch.setattr(db, "DB_PATH", path)
    db.init_db()
    yield path
    try:
        os.unlink(path)
    except OSError:
        pass


def _counts():
    with db.get_conn() as conn:
        hospitals = conn.execute("SELECT COUNT(*) AS c FROM Hospital").fetchone()["c"]
        stock = conn.execute("SELECT COUNT(*) AS c FROM AntivenomStock").fetchone()["c"]
        stakeholders = conn.execute("SELECT COUNT(*) AS c FROM Stakeholder").fetchone()["c"]
        villages = conn.execute("SELECT COUNT(*) AS c FROM VillageAudit").fetchone()["c"]
        incidents = conn.execute("SELECT COUNT(*) AS c FROM Incident").fetchone()["c"]
        return hospitals, stock, stakeholders, villages, incidents


class TestSeedDemo:
    def test_seed_exact_hospitals_and_compliance(self, isolated_seed_db):
        seed_demo.run()
        with db.get_conn() as conn:
            rows = conn.execute(
                "SELECT name, complianceScore, facilityLevel, ventilatorCount FROM Hospital"
            ).fetchall()
        actual = {r["name"]: r["complianceScore"] for r in rows}
        assert set(actual) == set(_EXPECTED_HOSPITALS)
        for name, compliance in _EXPECTED_HOSPITALS.items():
            assert actual[name] == compliance

        mandya = next(r for r in rows if r["name"] == "Mandya District Hospital")
        assert mandya["facilityLevel"] == "DH"
        assert mandya["ventilatorCount"] == 4

        malavalli = next(r for r in rows if r["name"] == "Malavalli Taluk PHC")
        assert malavalli["facilityLevel"] == "PHC"
        assert malavalli["ventilatorCount"] == 0

    def test_demo_incident_seeded(self, isolated_seed_db):
        seed_demo.run()
        with db.get_conn() as conn:
            inc = conn.execute("SELECT * FROM Incident WHERE id='inc-nr-1042'").fetchone()
            assert inc is not None
            assert inc["token"] == "NR-1042"
            assert inc["presentingHospitalId"] is not None

            ptosis = conn.execute("SELECT * FROM PtosisReading WHERE incidentId='inc-nr-1042'").fetchone()
            assert ptosis is not None
            assert ptosis["percentChange"] == 50.0

    def test_stock_status_mapping(self, isolated_seed_db):
        seed_demo.run()
        with db.get_conn() as conn:
            rows = conn.execute(
                "SELECT h.name AS name, s.status AS status "
                "FROM AntivenomStock s JOIN Hospital h ON h.id = s.hospitalId"
            ).fetchall()
        status_by_hospital = {r["name"]: r["status"] for r in rows}
        assert status_by_hospital["Mandya District Hospital"] == "CONFIRMED"  # 91.5
        assert status_by_hospital["Hassan District Hospital"] == "LOW"  # 56.0
        assert status_by_hospital["Rajarajeshwari Medical Nagara"] == "OUT"  # 45.0

    def test_stock_does_not_accumulate_across_runs(self, isolated_seed_db):
        seed_demo.run()
        seed_demo.run()
        with db.get_conn() as conn:
            rows = conn.execute(
                "SELECT h.name AS name, COUNT(s.id) AS n "
                "FROM Hospital h LEFT JOIN AntivenomStock s ON s.hospitalId = h.id "
                "GROUP BY h.id"
            ).fetchall()
        by_name = {r["name"]: r["n"] for r in rows}
        for name in _EXPECTED_HOSPITALS:
            assert by_name[name] == 1

    def test_stakeholders_pilot_permission(self, isolated_seed_db):
        seed_demo.run()
        with db.get_conn() as conn:
            rows = conn.execute(
                "SELECT name, supportType FROM Stakeholder"
            ).fetchall()
        assert len(rows) == 3
        names = {r["name"] for r in rows}
        assert "Gerry Martin" in names
        assert all(r["supportType"] == "pilot_permission" for r in rows)

    def test_village_audits_exact(self, isolated_seed_db):
        seed_demo.run()
        with db.get_conn() as conn:
            rows = conn.execute(
                "SELECT gramPanchayat, district, aggregateRiskScore, ashaWorkerId "
                "FROM VillageAudit"
            ).fetchall()
        assert len(rows) == 3
        malavalli = next(r for r in rows if r["gramPanchayat"] == "Malavalli")
        assert malavalli["district"] == "Mandya"
        assert malavalli["aggregateRiskScore"] == 58.0
        assert all(r["ashaWorkerId"] == "asha-worker-001" for r in rows)

    def test_rerun_is_idempotent(self, isolated_seed_db):
        seed_demo.run()
        after_first = _counts()
        seed_demo.run()
        after_second = _counts()
        assert after_first == after_second == (7, 7, 3, 3, 1)

