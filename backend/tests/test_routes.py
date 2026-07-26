import pytest
from app import database as db

pytestmark = pytest.mark.asyncio


class TestSOS:
    async def test_sos_creates_incident(self, async_client):
        resp = await async_client.post("/api/sos", json={"lat": 12.8, "lng": 77.6})
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"]["state"] == "DISPATCHING"
        assert data["incident"]["lat"] == 12.8
        assert data["incident"]["lng"] == 77.6
        assert data["ref"].startswith("NR-")
        assert "streamUrl" in data
        assert "auditUrl" in data

    async def test_sos_with_defaults(self, async_client):
        resp = await async_client.post("/api/sos", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"]["lat"] == 12.8003
        assert data["incident"]["lng"] == 77.5954

    async def test_sos_persists_to_db(self, async_client):
        resp = await async_client.post("/api/sos", json={"lat": 12.0, "lng": 77.0})
        inc_id = resp.json()["incident"]["id"]
        with db.get_conn() as conn:
            row = conn.execute("SELECT id, state, lat, lng FROM Incident WHERE id=?", (inc_id,)).fetchone()
            assert row is not None
            assert row["state"] == "DISPATCHING"
            assert row["lat"] == 12.0

    async def test_sos_creates_outbox_event(self, async_client):
        resp = await async_client.post("/api/sos", json={})
        inc_id = resp.json()["incident"]["id"]
        with db.get_conn() as conn:
            outbox = conn.execute(
                "SELECT * FROM OutboxEvent WHERE aggregateId=? AND type='IncidentCreated'",
                (inc_id,),
            ).fetchall()
            assert len(outbox) == 1
            assert outbox[0]["state"] == "PENDING"


class TestIncidents:
    async def test_get_nonexistent(self, async_client):
        resp = await async_client.get("/api/incidents/does-not-exist")
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"] is None

    async def test_get_incident(self, async_client):
        create = await async_client.post("/api/sos", json={"lat": 12.34, "lng": 56.78})
        inc_id = create.json()["incident"]["id"]
        resp = await async_client.get(f"/api/incidents/{inc_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"]["id"] == inc_id
        assert data["incident"]["lat"] == 12.34
        assert "dispatchAttempts" in data["incident"]
        assert "symptomObservations" in data["incident"]
        assert "snakeObservations" in data["incident"]

    async def test_get_audit(self, async_client):
        create = await async_client.post("/api/sos", json={"lat": 12.34, "lng": 56.78})
        inc_id = create.json()["incident"]["id"]
        resp = await async_client.get(f"/api/incidents/{inc_id}/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert data["incident"] is not None
        assert isinstance(data["audit"], list)
        assert isinstance(data["outbox"], list)

    # SSE stream endpoint cannot be tested via httpx ASGI transport
    # (deadlocks on infinite streaming responses). Tested via unit/integration
    # in the stream handler itself.


class TestHospitals:
    async def test_list_empty(self, async_client):
        resp = await async_client.get("/api/hospitals")
        assert resp.status_code == 200
        data = resp.json()
        assert data["hospitals"] == []
        assert data["origin"] == {"lat": 12.8003, "lng": 77.5954}

    async def test_list_with_seeded(self, async_client, seeded_hospital):
        resp = await async_client.get("/api/hospitals")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["hospitals"]) == 1
        assert data["hospitals"][0]["id"] == seeded_hospital
        assert data["hospitals"][0]["recommended"] is True
        assert data["hospitals"][0]["stock"]["status"] == "CONFIRMED"

    async def test_list_with_custom_origin(self, async_client, seeded_hospital):
        resp = await async_client.get("/api/hospitals?lat=13.0&lng=77.5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["origin"] == {"lat": 13.0, "lng": 77.5}
        assert len(data["hospitals"]) == 1

    async def test_update_stock(self, async_client, seeded_hospital):
        resp = await async_client.patch(
            f"/api/hospitals/{seeded_hospital}/stock",
            json={"status": "LOW", "product": "Polyvalent ASV", "quantityBand": "5-9", "verifiedBy": "Test"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["hospitalId"] == seeded_hospital
        assert data["stock"]["status"] == "LOW"

    async def test_update_stock_not_found(self, async_client):
        resp = await async_client.patch(
            "/api/hospitals/nonexistent/stock",
            json={"status": "OUT"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "error" in data
        assert data["error"] == "Hospital not found"
