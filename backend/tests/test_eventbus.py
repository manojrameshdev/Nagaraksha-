"""Outbox worker state machine tests.

The simulated dispatch sleeps make direct execution slow, so `time.sleep`
is patched to a no-op and the bounded executor thread is polled to completion.
"""

import json
import time as _time
from unittest.mock import patch

from app import database as db
from app import eventbus


def _insert_incident_outbox():
    inc_id = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO Incident (id, token, lat, lng, state, createdAt, updatedAt) "
            "VALUES (?, ?, ?, ?, 'DISPATCHING', ?, ?)",
            (inc_id, db.new_id(), 12.8, 77.6, now, now),
        )
        conn.execute(
            "INSERT INTO OutboxEvent (id, type, aggregateId, payload, state, attempts, createdAt) "
            "VALUES (?, 'IncidentCreated', ?, ?, 'PENDING', 0, ?)",
            (db.new_id(), inc_id, json.dumps({"lat": 12.8, "lng": 77.6, "incidentId": inc_id}), now),
        )
    return inc_id


def _insert_incident_created_outbox_only():
    """An IncidentCreated outbox event with no backing Incident (for retry tests)."""
    now = db.now_iso()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO OutboxEvent (id, type, aggregateId, payload, state, attempts, createdAt) "
            "VALUES (?, 'IncidentCreated', ?, ?, 'PENDING', 0, ?)",
            (db.new_id(), db.new_id(), json.dumps({"lat": 12.8, "lng": 77.6}), now),
        )


def _incident_state(inc_id):
    with db.get_conn() as conn:
        row = conn.execute("SELECT state FROM Incident WHERE id=?", (inc_id,)).fetchone()
    return row["state"] if row else None


def _outbox_state_for(inc_id):
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT state FROM OutboxEvent WHERE aggregateId=? AND type='IncidentCreated'",
            (inc_id,),
        ).fetchone()
    return row["state"] if row else None


def _wait_until(predicate, timeout=15.0):
    deadline = _time.time() + timeout
    while _time.time() < deadline:
        if predicate():
            return True
        _time.sleep(0.05)
    return False


class TestOutboxWorker:
    def test_incident_created_advances_to_handed_off(self):
        with patch.object(eventbus.time, "sleep", lambda *a, **k: None):
            inc_id = _insert_incident_outbox()
            eventbus._worker_tick()

            # The handler sets HANDED_OFF as its last step, then the executor
            # marks the outbox event PROCESSED — wait for both.
            assert _wait_until(
                lambda: _incident_state(inc_id) == "HANDED_OFF"
                and _outbox_state_for(inc_id) == "PROCESSED"
            )

            with db.get_conn() as conn:
                attempts = conn.execute(
                    "SELECT * FROM DispatchAttempt WHERE incidentId=? ORDER BY category, sequence",
                    (inc_id,),
                ).fetchall()
            assert len(attempts) == 6  # 3 lanes x 2 candidates
            categories = {a["category"] for a in attempts}
            assert categories == {"TRAINED", "RESCUE", "AMBULANCE"}
            # the simulated first candidate auto-accepts within each lane
            first_per_lane = {
                (a["category"], a["sequence"]) for a in attempts if a["outcome"] == "ACCEPTED"
            }
            assert first_per_lane == {("TRAINED", 1), ("RESCUE", 1), ("AMBULANCE", 1)}

    def test_failed_event_retries_then_marks_failed(self):
        with patch.object(eventbus.time, "sleep", lambda *a, **k: None):
            with patch.object(eventbus, "do_dispatch", side_effect=RuntimeError("boom")):
                _insert_incident_created_outbox_only()
                for _ in range(12):
                    eventbus._worker_tick()
                    if _wait_until(lambda: _last_event_state() == "FAILED", timeout=2.0):
                        break
                    _time.sleep(0.02)
                assert _last_event_state() == "FAILED"


def _last_event_state():
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT state, attempts FROM OutboxEvent WHERE type='IncidentCreated' "
            "ORDER BY createdAt DESC LIMIT 1"
        ).fetchone()
    return row["state"] if row else None
