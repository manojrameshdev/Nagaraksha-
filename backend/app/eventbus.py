"""In-process event bus + durable outbox worker + audit logger.

Faithful to the System Design document:
  "transactional incident write → Dispatch Orchestrator → three independent
   dispatch jobs... Outbox/event emits IncidentCreated. Worker retries until
   processed. Client state updates through WebSocket/SSE."
"""
from __future__ import annotations

import json
import threading
import time
from collections import defaultdict

from . import database as db
from .domain import simulate_dispatch

_bus_lock = threading.Lock()
_subscribers: dict[str, list] = defaultdict(list)
_worker_started = False


def subscribe(event_type: str, callback):
    """Register a subscriber for an event type (used by SSE streams)."""
    with _bus_lock:
        _subscribers[event_type].append(callback)


def unsubscribe(event_type: str, callback):
    with _bus_lock:
        if callback in _subscribers.get(event_type, []):
            _subscribers[event_type].remove(callback)


def _emit(event_type: str, incident_id: str, payload: dict):
    """Dispatch to in-process subscribers (non-blocking)."""
    with _bus_lock:
        subs = list(_subscribers.get(event_type, []))
    for cb in subs:
        try:
            cb(incident_id, payload)
        except Exception:
            pass  # never let a subscriber crash the worker


def append_outbox(event_type: str, aggregate_id: str, payload: dict):
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO OutboxEvent (id, type, aggregateId, payload, state, attempts, createdAt) "
            "VALUES (?, ?, ?, ?, 'PENDING', 0, ?)",
            (db.new_id(), event_type, aggregate_id, json.dumps(payload), db.now_iso()),
        )


def audit(incident_id=None, actor="system", action="", entity=None, metadata=None):
    try:
        with db.get_conn() as conn:
            conn.execute(
                "INSERT INTO AuditEvent (id, incidentId, actor, action, entity, metadata, timestamp) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), incident_id, actor, action, entity,
                 json.dumps(metadata) if metadata else None, db.now_iso()),
            )
    except Exception:
        pass  # audit is best-effort


def _handle_incident_created(incident_id, payload):
    """The three independent dispatch jobs (System Design step 5)."""
    audit(incident_id=incident_id, actor="system", action="DISPATCH_FANOUT",
          entity="Incident", metadata={"lanes": ["TRAINED", "RESCUE", "AMBULANCE"]})

    sim = simulate_dispatch({"lat": payload["lat"], "lng": payload["lng"]})
    lanes = [
        ("TRAINED", sim["trained"]),
        ("RESCUE", sim["rescue"]),
        ("AMBULANCE", sim["ambulance"]),
    ]

    for category, attempts in lanes:
        for i, a in enumerate(attempts):
            attempt_id = db.new_id()
            with db.get_conn() as conn:
                conn.execute(
                    "INSERT INTO DispatchAttempt (id, incidentId, category, candidateName, candidateRole, "
                    "distanceKm, etaMin, sentAt, outcome, sequence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (attempt_id, incident_id, category, a["name"], a["role"], a["distanceKm"],
                     a["etaMin"], db.now_iso(), "PENDING", i + 1),
                )
            _emit("DispatchAttempted", incident_id, {
                "attemptId": attempt_id, "category": category,
                "candidateName": a["name"], "candidateRole": a["role"],
                "distanceKm": a["distanceKm"], "etaMin": a["etaMin"],
                "sequence": i + 1, "state": "ALERTED",
            })
            # first candidate accepts after its simulated delay
            if i == 0 and a.get("accept"):
                delay = max(0.4, (a["acceptAt"] - time.time() * 1000) / 1000)
                time.sleep(delay)
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE DispatchAttempt SET acceptedAt=?, outcome='ACCEPTED' WHERE id=?",
                        (db.now_iso(), attempt_id),
                    )
                _emit("DispatchAccepted", incident_id, {
                    "attemptId": attempt_id, "category": category,
                    "candidateName": a["name"], "candidateRole": a["role"],
                    "distanceKm": a["distanceKm"], "etaMin": a["etaMin"],
                    "acceptedAt": db.now_iso(), "sequence": i + 1,
                })

    # advance incident state
    time.sleep(0.6)
    _set_state(incident_id, "ACCEPTED")
    time.sleep(1.6)
    _set_state(incident_id, "TRANSPORTING")
    time.sleep(2.0)
    _set_state(incident_id, "HANDED_OFF")
    audit(incident_id=incident_id, actor="hospital", action="HANDOFF",
          entity="Incident", metadata={"state": "HANDED_OFF"})


def _set_state(incident_id, state):
    with db.get_conn() as conn:
        conn.execute("UPDATE Incident SET state=?, updatedAt=? WHERE id=?",
                     (state, db.now_iso(), incident_id))
    _emit("IncidentStateChanged", incident_id, {"state": state})


def _worker_tick():
    """Drain pending outbox events once."""
    try:
        with db.get_conn() as conn:
            pending = conn.execute(
                "SELECT * FROM OutboxEvent WHERE state='PENDING' ORDER BY createdAt ASC LIMIT 25"
            ).fetchall()
        for ev in pending:
            try:
                payload = json.loads(ev["payload"])
                etype = ev["type"]
                if etype == "IncidentCreated":
                    _handle_incident_created(ev["aggregateId"], payload)
                _emit(etype, ev["aggregateId"], payload)
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE OutboxEvent SET state='PROCESSED', processedAt=?, attempts=attempts+1 WHERE id=?",
                        (db.now_iso(), ev["id"]),
                    )
            except Exception:
                with db.get_conn() as conn:
                    conn.execute(
                        "UPDATE OutboxEvent SET attempts=attempts+1 WHERE id=?", (ev["id"],)
                    )
                    fail = conn.execute(
                        "SELECT attempts as a FROM OutboxEvent WHERE id=?", (ev["id"],)
                    ).fetchone()
                    if fail and fail["a"] >= 4:
                        conn.execute(
                            "UPDATE OutboxEvent SET state='FAILED', processedAt=? WHERE id=?",
                            (db.now_iso(), ev["id"]),
                        )
    except Exception:
        pass


def start_worker():
    """Background poller that drains the outbox every 2.5s."""
    global _worker_started
    if _worker_started:
        return
    _worker_started = True

    def loop():
        while True:
            _worker_tick()
            time.sleep(2.5)

    t = threading.Thread(target=loop, daemon=True)
    t.start()


def get_ranked_hospitals(lat, lng):
    with db.get_conn() as conn:
        hospitals = conn.execute(
            "SELECT * FROM Hospital WHERE active=1"
        ).fetchall()
        result = []
        for h in hospitals:
            stock = conn.execute(
                "SELECT * FROM AntivenomStock WHERE hospitalId=? ORDER BY verifiedAt DESC LIMIT 1",
                (h["id"],),
            ).fetchone()
            result.append({
                "id": h["id"], "name": h["name"], "lat": h["lat"], "lng": h["lng"],
                "address": h["address"], "contact": h["contact"],
                "stock": {
                    "product": stock["product"] if stock else "Polyvalent ASV",
                    "status": stock["status"] if stock else "UNKNOWN",
                    "quantityBand": stock["quantityBand"] if stock else None,
                    "verifiedAt": stock["verifiedAt"] if stock else "1970-01-01T00:00:00Z",
                    "verifiedBy": stock["verifiedBy"] if stock else None,
                },
            })
    from .domain import rank_hospitals
    return rank_hospitals({"lat": lat, "lng": lng}, result)
