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
    classify_venom_type,
    compute_dry_bite_probability,
    estimate_antivenom_vials,
    compute_venom_score,
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


from datetime import datetime, timezone

class TestStockFreshness:
    def test_out_of_stock(self):
        recent = datetime.now(timezone.utc).isoformat()
        res = stock_freshness("OUT", recent)
        assert res["stale"] is True
        assert res["tone"] == "red"

    def test_confirmed_recent(self):
        recent = datetime.now(timezone.utc).isoformat()
        res = stock_freshness("CONFIRMED", recent)
        assert res["stale"] is False
        assert res["tone"] == "green"

    def test_low_stock(self):
        recent = datetime.now(timezone.utc).isoformat()
        res = stock_freshness("LOW", recent)
        assert res["stale"] is False
        assert res["tone"] == "gold"

    def test_stale_when_old(self):
        res = stock_freshness("UNKNOWN", "2024-01-01T00:00:00Z")
        assert res["stale"] is True
        assert res["tone"] == "gold"


class TestRankHospitals:
    def test_confirmed_ranked_first(self):
        # Composite ranking: distance 40% / freshness 30% / compliance 30%.
        # Equidistant hospitals isolate the stock-freshness factor.
        recent = datetime.now(timezone.utc).isoformat()
        origin = {"lat": 12.8, "lng": 77.6}
        hospitals = [
            {"id": "a", "name": "Confirmed", "lat": 12.9, "lng": 77.7,
             "stock": {"status": "CONFIRMED", "verifiedAt": recent}},
            {"id": "b", "name": "Unknown", "lat": 12.9, "lng": 77.7,
             "stock": {"status": "UNKNOWN", "verifiedAt": recent}},
        ]
        ranked = rank_hospitals(origin, hospitals)
        assert ranked[0]["id"] == "a"
        assert ranked[0]["recommended"] is True
        assert ranked[0]["score"] > ranked[1]["score"]

    def test_out_stocked_last(self):
        recent = datetime.now(timezone.utc).isoformat()
        origin = {"lat": 12.8, "lng": 77.6}
        hospitals = [
            {"id": "a", "name": "Out", "lat": 12.9, "lng": 77.7,
             "stock": {"status": "OUT", "verifiedAt": recent}},
            {"id": "b", "name": "Confirmed", "lat": 12.9, "lng": 77.7,
             "stock": {"status": "CONFIRMED", "verifiedAt": recent}},
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


class TestVenomScore:
    """Unit coverage for the four VenomScore domain functions (uppercase vocab, advisory outputs)."""

    # ── classify_venom_type ────────────────────────────────────────────────
    def test_classify_neurotoxic_when_ptosis(self):
        assert classify_venom_type(
            [{"ptosisDetected": True, "percentChange": 57.1}], [], 10
        ) == "NEUROTOXIC"

    def test_classify_hemotoxic_when_wound_growth(self):
        wounds = [
            {"swellingAreaPx": 100, "severityScore": 10},
            {"swellingAreaPx": 8500, "severityScore": 60},
        ]
        assert classify_venom_type([], wounds, 10) == "HEMOTOXIC"

    def test_classify_dry_bite_after_45_min(self):
        assert classify_venom_type([], [], 50) == "DRY_BITE"

    def test_classify_unknown_early(self):
        assert classify_venom_type([], [], 10) == "UNKNOWN"

    # ── compute_dry_bite_probability ───────────────────────────────────────
    def test_dry_bite_probability_zero_when_ptosis(self):
        assert compute_dry_bite_probability(
            [{"ptosisDetected": True}], [], 50
        ) == 0.0

    def test_dry_bite_probability_after_50_min(self):
        p = compute_dry_bite_probability([], [], 50)
        assert p > 0.60 and p <= 0.95

    def test_dry_bite_probability_zero_before_20_min(self):
        assert compute_dry_bite_probability([], [], 5) == 0.0

    def test_dry_bite_probability_zero_on_fast_wound_growth(self):
        wounds = [
            {"swellingAreaPx": 100, "severityScore": 10},
            {"swellingAreaPx": 9000, "severityScore": 60},
        ]
        assert compute_dry_bite_probability([], wounds, 50) == 0.0

    # ── estimate_antivenom_vials ───────────────────────────────────────────
    def test_vials_neurotoxic_high_severity(self):
        res = estimate_antivenom_vials("NEUROTOXIC", 85.0)
        assert res["estimatedVials"] == 25
        assert res["confidenceLevel"] == "moderate"

    def test_vials_dry_bite_zero_high_confidence(self):
        res = estimate_antivenom_vials("DRY_BITE", 0.0)
        assert res["estimatedVials"] == 0
        assert res["confidenceLevel"] == "high"

    def test_vials_unknown_conservative_ten(self):
        res = estimate_antivenom_vials("UNKNOWN", 0.0)
        assert res["estimatedVials"] == 10
        assert res["confidenceLevel"] == "low"

    def test_vials_every_result_has_disclaimer(self):
        for vt in ("NEUROTOXIC", "HEMOTOXIC", "DRY_BITE", "UNKNOWN"):
            res = estimate_antivenom_vials(vt, 30.0)
            assert "disclaimer" in res
            assert "Confirm with 20-minute whole blood clotting test" in res["disclaimer"]

    # ── compute_venom_score composite ──────────────────────────────────────
    def test_composite_empty_readings(self):
        score = compute_venom_score([], [], 0)
        assert score["venomType"] == "UNKNOWN"
        assert score["overallSeverity"] == 0.0
        assert score["ptosisReadingCount"] == 0
        assert score["woundReadingCount"] == 0

    def test_composite_neurotoxic_critical_alert(self):
        score = compute_venom_score(
            [{"ptosisDetected": True, "percentChange": 85.0}], [], 40
        )
        assert score["venomType"] == "NEUROTOXIC"
        assert score["overallSeverity"] == 85.0
        assert score["ventilatorRequired"] is True
        assert score["criticalAlert"] is not None
        assert score["minutesSinceBite"] == 40

    def test_composite_echoes_minutes_since_bite(self):
        score = compute_venom_score([], [], 120)
        assert score["minutesSinceBite"] == 120

    def test_composite_dual_key_tolerance(self):
        camel = [{"ptosisDetected": True, "percentChange": 57.1}]
        snake = [{"ptosis_detected": True, "percent_change": 57.1}]
        a = compute_venom_score(camel, [], 30)
        b = compute_venom_score(snake, [], 30)
        assert a["venomType"] == b["venomType"] == "NEUROTOXIC"
        assert a["overallSeverity"] == b["overallSeverity"] == 57.1
