import time
import pytest
from app.domain import (
    haversine_km,
    road_km,
    eta_min,
    mins_ago,
    stock_freshness,
    rank_hospitals,
    gen_incident_ref,
    simulate_dispatch,
)


class TestHaversine:
    def test_zero_distance(self):
        assert haversine_km(12.8, 77.6, 12.8, 77.6) == 0.0

    def test_bangalore_to_mysore(self):
        dist = haversine_km(12.97, 77.59, 12.30, 76.65)
        assert 120 < dist < 150

    def test_known_city_distance(self):
        dist = haversine_km(28.61, 77.23, 19.07, 72.87)
        assert 1100 < dist < 1200


class TestRoadKm:
    def test_multiplier(self):
        assert road_km(10.0) == 13.2
        assert road_km(0) == 0
        assert road_km(1.0) == 1.3


class TestEtaMin:
    def test_short_distance(self):
        eta = eta_min(5)
        assert 10 <= eta <= 13

    def test_long_distance(self):
        eta = eta_min(30)
        assert 40 <= eta <= 45

    def test_minimum_two(self):
        assert eta_min(0.5) >= 2


class TestMinsAgo:
    def test_recent(self):
        now = time.time() * 1000
        iso = "2026-07-27T00:40:00Z"
        assert mins_ago(iso, now_ms=now) >= 0

    def test_future_returns_zero(self):
        now = 1000
        iso = "2026-07-27T00:00:01Z"
        assert mins_ago(iso, now_ms=now) == 0

    def test_invalid_iso_returns_zero(self):
        assert mins_ago("not-a-date") == 0


class TestStockFreshness:
    def test_out_of_stock(self):
        res = stock_freshness("OUT", "2026-07-27T00:00:00Z")
        assert res["stale"] is True
        assert res["tone"] == "red"

    def test_confirmed_recent(self):
        res = stock_freshness("CONFIRMED", "2026-07-27T00:00:00Z")
        assert res["stale"] is False
        assert res["tone"] == "green"

    def test_low_stock(self):
        res = stock_freshness("LOW", "2026-07-27T00:00:00Z")
        assert res["stale"] is False
        assert res["tone"] == "gold"

    def test_stale_when_old(self):
        res = stock_freshness("UNKNOWN", "2024-01-01T00:00:00Z")
        assert res["stale"] is True
        assert res["tone"] == "gold"


class TestRankHospitals:
    def test_confirmed_ranked_first(self):
        origin = {"lat": 12.8, "lng": 77.6}
        hospitals = [
            {"id": "a", "name": "Far Confirmed", "lat": 13.0, "lng": 77.8,
             "stock": {"status": "CONFIRMED", "verifiedAt": "2026-07-27T00:00:00Z"}},
            {"id": "b", "name": "Close Unknown", "lat": 12.81, "lng": 77.61,
             "stock": {"status": "UNKNOWN", "verifiedAt": "2026-07-27T00:00:00Z"}},
        ]
        ranked = rank_hospitals(origin, hospitals)
        assert ranked[0]["id"] == "a"
        assert ranked[0]["recommended"] is True
        assert ranked[0]["score"] > ranked[1]["score"]

    def test_out_stocked_last(self):
        origin = {"lat": 12.8, "lng": 77.6}
        hospitals = [
            {"id": "a", "name": "Out", "lat": 12.81, "lng": 77.61,
             "stock": {"status": "OUT", "verifiedAt": "2026-07-27T00:00:00Z"}},
            {"id": "b", "name": "Confirmed", "lat": 13.0, "lng": 77.8,
             "stock": {"status": "CONFIRMED", "verifiedAt": "2026-07-27T00:00:00Z"}},
        ]
        ranked = rank_hospitals(origin, hospitals)
        assert ranked[0]["id"] == "b"
        assert ranked[1]["id"] == "a"

    def test_empty_list(self):
        assert rank_hospitals({"lat": 0, "lng": 0}, []) == []


class TestGenIncidentRef:
    def test_format(self):
        ref = gen_incident_ref()
        assert ref.startswith("NR-")
        assert len(ref) == 7
        assert ref[3:].isdigit()

    def test_variation(self):
        refs = {gen_incident_ref() for _ in range(100)}
        assert len(refs) > 1


class TestSimulateDispatch:
    def test_returns_three_lanes(self):
        sim = simulate_dispatch({"lat": 12.8, "lng": 77.6})
        assert set(sim.keys()) == {"trained", "rescue", "ambulance"}
        assert len(sim["trained"]) == 2
        assert len(sim["rescue"]) == 2
        assert len(sim["ambulance"]) == 2

    def test_each_entry_has_required_fields(self):
        sim = simulate_dispatch({"lat": 12.8, "lng": 77.6})
        for lane in sim.values():
            for entry in lane:
                assert "name" in entry
                assert "role" in entry
                assert "distanceKm" in entry
                assert "etaMin" in entry
