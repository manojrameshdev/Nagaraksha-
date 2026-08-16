"""In-process event bus + durable outbox worker + audit logger.

Faithful to the System Design document:
  "transactional incident write → Dispatch Orchestrator → three independent
   dispatch jobs... Outbox/event emits IncidentCreated. Worker retries until
   processed. Client state updates through WebSocket/SSE."
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor


from . import database as db
from .dispatch import do_dispatch
from .routes.ws import broadcast_sync

_bus_lock = threading.Lock()
_subscribers: dict[str, list] = defaultdict(list)
_worker_started = False
# Bound the number of incidents processed concurrently so one slow incident
# (e.g. a simulated accept delay) no longer blocks the rest of the queue.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="outbox")
# Outbox events currently being processed off-thread — skipped by the poller
# until they finish, preserving per-event retry/FAILED semantics.
_inflight: set[str] = set()


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
        except (RuntimeError, ValueError, TypeError, KeyError):
            pass  # never let a subscriber crash the worker


def append_outbox(event_type: str, aggregate_id: str, payload: dict):
    with db.get_conn() as conn:
        append_outbox_tx(conn, event_type, aggregate_id, payload)


def append_outbox_tx(conn, event_type: str, aggregate_id: str, payload: dict) -> str:
    """Insert OutboxEvent within the caller's active database transaction."""
    eid = db.new_id()
    conn.execute(
        "INSERT INTO OutboxEvent (id, type, aggregateId, payload, state, attempts, createdAt) "
        "VALUES (?, ?, ?, ?, 'PENDING', 0, ?)",
        (eid, event_type, aggregate_id, json.dumps(payload), db.now_iso()),
    )
    return eid


def audit(incident_id=None, actor="system", action="", entity=None, metadata=None):
    try:
        with db.get_conn() as conn:
            conn.execute(
                "INSERT INTO AuditEvent (id, incidentId, actor, action, entity, metadata, timestamp) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), incident_id, actor, action, entity,
                 json.dumps(metadata) if metadata else None, db.now_iso()),
            )
    except (sqlite3.Error, ValueError, TypeError):
        pass  # audit is best-effort



def _handle_incident_created(incident_id, payload):
    """The three independent dispatch jobs (System Design step 5)."""
    audit(incident_id=incident_id, actor="system", action="DISPATCH_FANOUT",
          entity="Incident", metadata={"lanes": ["TRAINED", "RESCUE", "AMBULANCE"]})

    # Real responders (with Twilio SMS) when registered, else simulation.
    sim = do_dispatch(payload)
    lanes = [
        ("TRAINED", sim["trained"]),
        ("RESCUE", sim["rescue"]),
        ("AMBULANCE", sim["ambulance"]),
    ]
    real_dispatch = any("responderId" in a for _, attempts in lanes for a in attempts)

    for category, attempts in lanes:
        for i, a in enumerate(attempts):
            attempt_id = db.new_id()
            with db.get_conn() as conn:
                conn.execute(
                    "INSERT INTO DispatchAttempt (id, incidentId, category, candidateName, candidateRole, "
                    "distanceKm, etaMin, sentAt, outcome, sequence, responderId, smsSid) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)",
                    (attempt_id, incident_id, category, a["name"], a["role"], a["distanceKm"],
                     a["etaMin"], db.now_iso(), i + 1, a.get("responderId"), a.get("smsSid")),
                )
            _emit("DispatchAttempted", incident_id, {
                "attemptId": attempt_id, "category": category,
                "candidateName": a["name"], "candidateRole": a["role"],
                "distanceKm": a["distanceKm"], "etaMin": a["etaMin"],
                "sequence": i + 1, "state": "ALERTED",
            })
            broadcast_sync(incident_id, "dispatch_attempted", {
                "attemptId": attempt_id, "category": category,
                "candidateName": a["name"], "candidateRole": a["role"],
                "distanceKm": a["distanceKm"], "etaMin": a["etaMin"],
                "sequence": i + 1, "state": "ALERTED",
            })
            # Simulated lanes auto-accept the first candidate after a delay.
            # Real lanes wait for the responder's SMS reply / UI button instead.
            if not real_dispatch and i == 0 and a.get("accept"):
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
                broadcast_sync(incident_id, "dispatch_accepted", {
                    "attemptId": attempt_id, "category": category,
                    "candidateName": a["name"], "candidateRole": a["role"],
                    "distanceKm": a["distanceKm"], "etaMin": a["etaMin"],
                    "acceptedAt": db.now_iso(), "sequence": i + 1,
                })

    if real_dispatch:
        # Real flow: advance the state machine once a responder accepts
        # (SMS webhook / UI PATCH). Poll until then, with a hard timeout.
        _wait_for_accept_then_advance(incident_id)
    else:
        # advance incident state (demo pacing)
        time.sleep(0.6)
        _set_state(incident_id, "ACCEPTED")
        time.sleep(1.6)
        _set_state(incident_id, "TRANSPORTING")
        time.sleep(2.0)
        _set_state(incident_id, "HANDED_OFF")
        audit(incident_id=incident_id, actor="hospital", action="HANDOFF",
              entity="Incident", metadata={"state": "HANDED_OFF"})


def _run_incident_job(event_id, incident_id, payload):
    """Executor task: run the dispatch job, then mark the outbox event done.

    Failures are attributed to the event (attempts/FAILED) instead of being
    lost, preserving the outbox retry contract while keeping the poller fast.
    """
    try:
        _handle_incident_created(incident_id, payload)
        _mark_processed(event_id)
    except Exception as e:  # noqa: BLE001 - guard rail; failures are logged, never crash the poller
        print(f"[Eventbus] IncidentCreated handler failed for {incident_id}: {e}")
        _mark_failed_or_retry(event_id)
    finally:
        _inflight.discard(event_id)


def _wait_for_accept_then_advance(incident_id, timeout_s: int = 300):
    """Poll for an ACCEPTED DispatchAttempt, then run the state machine."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        with db.get_conn() as conn:
            accepted = conn.execute(
                "SELECT COUNT(*) as c FROM DispatchAttempt WHERE incidentId=? AND outcome='ACCEPTED'",
                (incident_id,),
            ).fetchone()["c"]
        if accepted:
            time.sleep(0.6)
            _set_state(incident_id, "ACCEPTED")
            time.sleep(1.6)
            _set_state(incident_id, "TRANSPORTING")
            time.sleep(2.0)
            _set_state(incident_id, "HANDED_OFF")
            audit(incident_id=incident_id, actor="hospital", action="HANDOFF",
                  entity="Incident", metadata={"state": "HANDED_OFF"})
            return
        time.sleep(2.0)
    # Timeout with no accept — leave the incident DISPATCHING for a re-dispatch.
    print(f"[Eventbus] No responder accepted incident {incident_id} within {timeout_s}s")


def _set_state(incident_id, state):
    with db.get_conn() as conn:
        conn.execute("UPDATE Incident SET state=?, updatedAt=? WHERE id=?",
                     (state, db.now_iso(), incident_id))
    _emit("IncidentStateChanged", incident_id, {"state": state})
    broadcast_sync(incident_id, "incident_state", {"state": state})


def _worker_tick():
    """Drain pending outbox events once."""
    try:
        with db.get_conn() as conn:
            pending = conn.execute(
                "SELECT * FROM OutboxEvent WHERE state='PENDING' ORDER BY createdAt ASC LIMIT 25"
            ).fetchall()
        for ev in pending:
            if ev["id"] in _inflight:
                continue  # still running on the executor — retry accounting stays intact
            try:
                payload = json.loads(ev["payload"])
                etype = ev["type"]
                if etype == "IncidentCreated":
                    # Long-running simulated dispatch runs off the poller thread
                    # so incidents process in parallel (bounded pool).
                    _inflight.add(ev["id"])
                    _executor.submit(_run_incident_job, ev["id"], ev["aggregateId"], payload)
                elif etype in (
                    "ReferralCreated",
                    "ReferralAccepted",
                    "ReferralDeclined",
                    "TransportStarted",
                    "PatientArrived",
                ):
                    ws_event_name = {
                        "ReferralCreated": "REFERRAL_CREATED",
                        "ReferralAccepted": "REFERRAL_ACCEPTED",
                        "ReferralDeclined": "REFERRAL_DECLINED",
                        "TransportStarted": "TRANSPORT_STARTED",
                        "PatientArrived": "PATIENT_ARRIVED",
                    }.get(etype, etype)
                    broadcast_sync(ev["aggregateId"], ws_event_name, payload)
                    _emit(etype, ev["aggregateId"], payload)
                    _mark_processed(ev["id"])
                else:
                    _emit(etype, ev["aggregateId"], payload)
                    _mark_processed(ev["id"])
            except (sqlite3.Error, ValueError, KeyError, json.JSONDecodeError, TypeError):
                _mark_failed_or_retry(ev["id"])
    except (sqlite3.Error, OSError, ValueError):
        pass


def _mark_processed(event_id: str):
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE OutboxEvent SET state='PROCESSED', processedAt=?, attempts=attempts+1 WHERE id=?",
            (db.now_iso(), event_id),
        )


def _mark_failed_or_retry(event_id: str):
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE OutboxEvent SET attempts=attempts+1 WHERE id=?", (event_id,)
        )
        fail = conn.execute(
            "SELECT attempts as a FROM OutboxEvent WHERE id=?", (event_id,)
        ).fetchone()
        if fail and fail["a"] >= 4:
            conn.execute(
                "UPDATE OutboxEvent SET state='FAILED', processedAt=? WHERE id=?",
                (db.now_iso(), event_id),
            )


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
    """Rank hospitals, joining the freshest AntivenomStock per hospital in one query."""
    with db.get_conn() as conn:
        rows = conn.execute(
            """
            SELECT h.id, h.name, h.lat, h.lng, h.address, h.contact, h.complianceScore,
                   h.facilityLevel, h.capabilities, h.ventilatorCount, h.icuBedsAvailable,
                   s.product AS stock_product, s.status AS stock_status,
                   s.quantityBand AS stock_quantityBand, s.verifiedAt AS stock_verifiedAt,
                   s.verifiedBy AS stock_verifiedBy
            FROM Hospital h
            LEFT JOIN (
                SELECT hs.*, ROW_NUMBER() OVER (
                    PARTITION BY hs.hospitalId ORDER BY hs.verifiedAt DESC
                ) AS rn
                FROM AntivenomStock hs
            ) s ON s.hospitalId = h.id AND s.rn = 1
            WHERE h.active = 1
            """
        ).fetchall()
        result = []
        for r in rows:
            caps = r["capabilities"]
            if isinstance(caps, str):
                try:
                    caps = json.loads(caps)
                except (json.JSONDecodeError, TypeError, AttributeError):
                    caps = [c.strip() for c in caps.split(",") if c.strip()]
            elif caps is None:
                caps = ["ASV", "EMERGENCY_CARE"]


            result.append({
                "id": r["id"], "name": r["name"], "lat": r["lat"], "lng": r["lng"],
                "address": r["address"], "contact": r["contact"],
                "complianceScore": r["complianceScore"] if r["complianceScore"] is not None else 50.0,
                "facilityLevel": r["facilityLevel"] or "PHC",
                "capabilities": caps,
                "ventilatorCount": r["ventilatorCount"] or 0,
                "icuBedsAvailable": r["icuBedsAvailable"] or 0,
                "stock": {
                    "product": r["stock_product"] or "Polyvalent ASV",
                    "status": r["stock_status"] or "UNKNOWN",
                    "quantityBand": r["stock_quantityBand"],
                    "verifiedAt": r["stock_verifiedAt"] or "1970-01-01T00:00:00Z",
                    "verifiedBy": r["stock_verifiedBy"],
                },
            })
    from .domain import rank_hospitals
    return rank_hospitals({"lat": lat, "lng": lng}, result)

