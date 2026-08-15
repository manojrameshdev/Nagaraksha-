import pytest
from app import database as db
from app.routes import sos

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
        assert resp.status_code == 404

    async def test_get_audit_nonexistent(self, async_client):
        resp = await async_client.get("/api/incidents/does-not-exist/audit")
        assert resp.status_code == 404

    async def test_stream_nonexistent_is_404(self, async_client):
        resp = await async_client.get("/api/incidents/does-not-exist/stream")
        assert resp.status_code == 404

    async def test_accept_missing_incident_404(self, async_client):
        resp = await async_client.patch("/api/incidents/does-not-exist/accept")
        assert resp.status_code == 404

    async def test_decline_missing_incident_404(self, async_client):
        resp = await async_client.patch("/api/incidents/does-not-exist/decline")
        assert resp.status_code == 404

    async def test_accept_no_pending_attempt_409(self, async_client):
        create = await async_client.post("/api/sos", json={"lat": 12.0, "lng": 77.0})
        inc_id = create.json()["incident"]["id"]
        resp = await async_client.patch(f"/api/incidents/{inc_id}/accept")
        # no DispatchAttempt rows exist yet (worker is mocked in tests)
        assert resp.status_code == 409

    async def test_accept_scoped_to_category(self, async_client):
        """Accept with ?category= only flips that lane's pending attempt (WR-03)."""
        from app import database as db

        create = await async_client.post("/api/sos", json={"lat": 12.0, "lng": 77.0})
        inc_id = create.json()["incident"]["id"]
        now = db.now_iso()
        trained_id = db.new_id()
        rescue_id = db.new_id()
        with db.get_conn() as conn:
            conn.execute(
                "INSERT INTO DispatchAttempt (id, incidentId, category, candidateName, candidateRole, "
                "distanceKm, etaMin, sentAt, outcome, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1)",
                (trained_id, inc_id, "TRAINED", "Alice", "first_aider", 1.2, 7, now),
            )
            conn.execute(
                "INSERT INTO DispatchAttempt (id, incidentId, category, candidateName, candidateRole, "
                "distanceKm, etaMin, sentAt, outcome, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1)",
                (rescue_id, inc_id, "RESCUE", "Bob", "snake_rescue", 2.0, 9, now),
            )

        resp = await async_client.patch(f"/api/incidents/{inc_id}/accept?category=RESCUE")
        assert resp.status_code == 200
        assert resp.json()["acceptedAttemptId"] == rescue_id

        with db.get_conn() as conn:
            trained = conn.execute(
                "SELECT outcome FROM DispatchAttempt WHERE id=?", (trained_id,)
            ).fetchone()
            rescue = conn.execute(
                "SELECT outcome FROM DispatchAttempt WHERE id=?", (rescue_id,)
            ).fetchone()
        assert trained["outcome"] == "PENDING"
        assert rescue["outcome"] == "ACCEPTED"

    async def test_symptom_missing_incident_404(self, async_client):
        resp = await async_client.post(
            "/api/incidents/does-not-exist/symptoms",
            json={"label": "Swelling", "severity": "MODERATE"},
        )
        assert resp.status_code == 404

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
        assert resp.status_code == 404


class TestTwilioWebhook:
    async def test_unknown_sender_returns_twiml(self, async_client):
        resp = await async_client.post(
            "/webhook/twilio",
            data={"Body": "ACCEPT", "From": "+919999999999"},
        )
        assert resp.status_code == 200
        assert b"<Response>" in resp.content

    async def test_signature_required_when_token_set(self, async_client, monkeypatch):
        monkeypatch.setenv("TWILIO_AUTH_TOKEN", "test-auth-token")
        resp = await async_client.post(
            "/webhook/twilio",
            data={"Body": "ACCEPT", "From": "+919999999999"},
        )
        # No X-Twilio-Signature header -> rejected
        assert resp.status_code == 403

    async def test_register_responder(self, async_client):
        resp = await async_client.post(
            "/api/responders",
            data={
                "name": "Test Responder", "phone": "+919876543210",
                "role": "first_aider", "lat": "12.8", "lng": "77.6",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"]


class TestQueryParamValidation:
    async def test_knowledge_base_non_numeric_k(self, async_client):
        resp = await async_client.get("/api/knowledge-base?k=abc")
        assert resp.status_code == 422

    async def test_knowledge_base_k_bounded(self, async_client):
        resp = await async_client.get("/api/knowledge-base?k=9999")
        assert resp.status_code == 422

    async def test_risk_non_numeric_lat(self, async_client):
        resp = await async_client.get("/api/risk?lat=foo")
        assert resp.status_code == 422

    async def test_risk_lat_out_of_range(self, async_client):
        resp = await async_client.get("/api/risk?lat=200")
        assert resp.status_code == 422

    async def test_risk_valid_query(self, async_client):
        resp = await async_client.get("/api/risk?lat=12.8&lng=77.6")
        assert resp.status_code == 200


class TestRateLimit:
    async def test_trigger_sos_carries_rate_limit(self):
        """Structural: trigger_sos must carry slowapi's 10/minute limit.

        slowapi 0.1.9 registers limits on the Limiter keyed by module-qualified
        function name (`limiter._route_limits`) rather than stamping a
        `_rate_limits` attribute onto the function (pre-0.1.9 API). Check the
        modern registry first, fall back to the legacy attribute.
        """
        from app.limiter import limiter

        limits = getattr(sos.trigger_sos, "_rate_limits", None)
        if not limits:
            limits = limiter._route_limits.get("app.routes.sos.trigger_sos", [])
        assert limits, "trigger_sos carries no @limiter.limit decorator"

        first = limits[0]
        amount = getattr(first, "amount", None)
        if amount is None:
            amount = first.limit.amount
        assert amount == 10

    async def test_rate_limit_returns_429_after_threshold(self):
        """Behavioral: decorator + Request injection + exception handler wired.

        Runs against an isolated throwaway app with a fresh Limiter so the
        shared test-session limiter storage (used by other tests) is never
        polluted. First 3 POSTs pass, the 4th is rejected with 429.
        """
        from fastapi import FastAPI, Request
        from fastapi.testclient import TestClient
        from slowapi import Limiter as IsolatedLimiter, _rate_limit_exceeded_handler
        from slowapi.errors import RateLimitExceeded
        from slowapi.util import get_remote_address

        test_limiter = IsolatedLimiter(
            key_func=get_remote_address, default_limits=["200/minute"]
        )
        app = FastAPI()
        app.state.limiter = test_limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

        @app.post("/api/test-limit")
        @test_limiter.limit("3/minute")
        def test_limit(request: Request):
            return {"ok": True}

        client = TestClient(app)
        for _ in range(3):
            resp = client.post("/api/test-limit")
            assert resp.status_code == 200
        resp = client.post("/api/test-limit")
        assert resp.status_code == 429


_BASELINE_BODY = {
    "right_aperture": 0.025,
    "left_aperture": 0.024,
    "avg_aperture": 0.0245,
    "ptosis_detected": False,
    "severity": "none",
    "asymmetric": False,
}


class TestVenomScore:
    async def test_posting_reading_broadcasts(self, async_client, seeded_incident, monkeypatch):
        """POST persists + broadcasts VENOM_SCORE_UPDATE with venomScore payload.

        httpx ASGI transport cannot observe real WebSocket pushes, so the
        broadcast is monkeypatched with an async fake that records the call.
        """
        from app.routes import venom_score

        recorded = {}

        async def fake_broadcast(incident_id, event, payload):
            recorded["incident_id"] = incident_id
            recorded["event"] = event
            recorded["payload"] = payload

        monkeypatch.setattr(venom_score, "broadcast", fake_broadcast)

        resp = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading", json=_BASELINE_BODY
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert recorded["incident_id"] == seeded_incident
        assert recorded["event"] == "VENOM_SCORE_UPDATE"
        assert "venomScore" in recorded["payload"]

    async def test_submit_baseline_reading(self, async_client, seeded_incident):
        """Baseline reading with no ptosis → UNKNOWN, dryBiteProbability 0.0."""
        resp = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading", json=_BASELINE_BODY
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["venomScore"]["venomType"] == "UNKNOWN"
        assert data["venomScore"]["dryBiteProbability"] == 0.0

    async def test_post_unknown_incident_404(self, async_client):
        resp = await async_client.post(
            "/api/venom-score/does-not-exist/reading", json=_BASELINE_BODY
        )
        assert resp.status_code == 404

    async def test_get_score_unknown_incident_404(self, async_client):
        resp = await async_client.get("/api/venom-score/does-not-exist/score")
        assert resp.status_code == 404

    async def test_get_readings_unknown_incident_404(self, async_client):
        resp = await async_client.get("/api/venom-score/does-not-exist/readings")
        assert resp.status_code == 404

    async def test_invalid_aperture_422(self, async_client, seeded_incident):
        """right_aperture 1.5 is out of the 0.0-1.0 bound → Pydantic 422 before any DB write."""
        resp = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading",
            json={**_BASELINE_BODY, "right_aperture": 1.5},
        )
        assert resp.status_code == 422

    async def test_ptosis_progression_neurotoxic(self, async_client, seeded_incident):
        """Baseline then ptosis reading → GET /score reflects persistence + progression."""
        await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading", json=_BASELINE_BODY
        )
        resp = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading",
            json={
                "right_aperture": 0.010,
                "left_aperture": 0.012,
                "avg_aperture": 0.011,
                "baseline_aperture": 0.0245,
                "percent_change": 57.1,
                "ptosis_detected": True,
                "severity": "moderate",
                "asymmetric": True,
                "minutes_since_bite": 55,
            },
        )
        assert resp.status_code == 200
        score_resp = await async_client.get(f"/api/venom-score/{seeded_incident}/score")
        assert score_resp.status_code == 200
        score = score_resp.json()["venomScore"]
        assert score["venomType"] == "NEUROTOXIC"
        assert score["ptosisReadingCount"] == 2
        assert score["ventilatorRequired"] is False  # 57.1 < 60

    async def test_readings_ordered_by_timestamp(self, async_client, seeded_incident):
        """Two POSTs → GET /readings returns 2 rows ordered by timestamp ASC."""
        first = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading", json=_BASELINE_BODY
        )
        second = await async_client.post(
            f"/api/venom-score/{seeded_incident}/reading",
            json={**_BASELINE_BODY, "avg_aperture": 0.02},
        )
        assert first.status_code == 200 and second.status_code == 200

        resp = await async_client.get(f"/api/venom-score/{seeded_incident}/readings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["incidentId"] == seeded_incident
        assert len(data["readings"]) == 2
        stamps = [r["timestamp"] for r in data["readings"]]
        assert stamps == sorted(stamps)
