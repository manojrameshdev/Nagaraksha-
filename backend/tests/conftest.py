import os
import tempfile
import pytest
from unittest.mock import patch
from httpx import ASGITransport, AsyncClient

_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.environ["NAGRAKSHA_DB"] = _db_path

from app import database as db
from app.main import app
from app import eventbus
from app.routes import sos, incidents, hospitals

db.init_db()


@pytest.fixture(autouse=True)
def mock_background():
    with (
        patch("app.eventbus.start_worker", return_value=None),
        patch("app.routes.sos.start_worker", return_value=None),
        patch("app.routes.incidents.start_worker", return_value=None),
        patch("app.main.start_worker", return_value=None),
        patch("app.main.ensure_kb_seeded", return_value=None),
    ):
        yield


@pytest.fixture
def async_client():
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    return client


@pytest.fixture
def seeded_hospital():
    hid = "test-hosp-001"
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Hospital (id, name, lat, lng, address, contact, active, createdAt, updatedAt) "
            "VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
            (hid, "Test Hospital Anekal", 12.8, 77.6, "Anekal, Bangalore", "080-1234", now, now),
        )
        stock_id = db.new_id()
        conn.execute(
            "INSERT INTO AntivenomStock (id, hospitalId, product, status, quantityBand, verifiedAt, verifiedBy) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (stock_id, hid, "Polyvalent ASV", "CONFIRMED", "10+", now, "Test console"),
        )
    yield hid
    with db.get_conn() as conn:
        conn.execute("DELETE FROM AntivenomStock WHERE hospitalId=?", (hid,))
        conn.execute("DELETE FROM Hospital WHERE id=?", (hid,))


@pytest.fixture
def seeded_incident():
    """A real Incident row for VenomScore tests.

    Inserts directly via db.get_conn() (no asyncio event-loop pattern —
    pytest-asyncio incompatible) and cleans up in teardown.
    """
    inc_id = "test-inc-" + db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Incident (id, lat, lng, state, createdAt, updatedAt) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (inc_id, 12.8, 77.6, "DISPATCHING", now, now),
        )
    yield inc_id
    with db.get_conn() as conn:
        conn.execute("DELETE FROM Incident WHERE id=?", (inc_id,))


import atexit

@atexit.register
def cleanup():
    try:
        os.close(_db_fd)
        os.unlink(_db_path)
    except Exception:
        pass
