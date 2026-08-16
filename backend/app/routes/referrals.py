"""Care Corridor Referral routes — capability evaluation, referral lifecycle, and closed-loop timeline."""
from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException
from ..models import (
    ReferralCreateRequest,
    ReferralAcceptRequest,
    ReferralDeclineRequest,
)
from .. import database as db
from ..auth import require_role_if_enforced
from ..eventbus import append_outbox_tx, audit, get_ranked_hospitals
from ..domain import evaluate_capability_gap, rank_capable_hospitals

router = APIRouter()


def _load_hospital(conn, hid: str) -> dict | None:
    h = conn.execute("SELECT * FROM Hospital WHERE id=?", (hid,)).fetchone()
    if not h:
        return None
    h = dict(h)
    stock = conn.execute(
        "SELECT * FROM AntivenomStock WHERE hospitalId=? ORDER BY rowid DESC LIMIT 1", (hid,)
    ).fetchone()
    h["stock"] = dict(stock) if stock else {}
    return h


def _load_referral(conn, ref_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM Referral WHERE id=?", (ref_id,)).fetchone()
    if not row:
        return None
    r = dict(row)
    try:
        r["missingCapabilities"] = json.loads(r["missingCapabilities"])
    except Exception:
        r["missingCapabilities"] = [c.strip() for c in r["missingCapabilities"].split(",") if c.strip()]
    return r


@router.post("/api/incidents/{inc_id}/evaluate-referral")
def evaluate_incident_referral(inc_id: str):
    """
    Evaluate presenting facility capabilities against live patient telemetry (VenomScore/Ptosis/Wounds)
    and return capability gap analysis + ranked eligible destination facilities.
    """
    with db.get_conn() as conn:
        inc = conn.execute("SELECT * FROM Incident WHERE id=?", (inc_id,)).fetchone()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        inc = dict(inc)

        # Presenting facility
        presenting_id = inc.get("presentingHospitalId")
        current_hospital = None
        if presenting_id:
            current_hospital = _load_hospital(conn, presenting_id)

        # Telemetry: latest ptosis reading
        latest_ptosis = conn.execute(
            "SELECT * FROM PtosisReading WHERE incidentId=? ORDER BY timestamp DESC LIMIT 1",
            (inc_id,),
        ).fetchone()

        # Telemetry: latest wound reading
        latest_wound = conn.execute(
            "SELECT * FROM WoundReading WHERE incidentId=? ORDER BY timestamp DESC LIMIT 1",
            (inc_id,),
        ).fetchone()

        # Systemic symptoms
        symptoms = [
            r["code"]
            for r in conn.execute(
                "SELECT code FROM SymptomObservation WHERE incidentId=?", (inc_id,)
            ).fetchall()
            if r["code"]
        ]

        # All candidate hospitals
        all_hospitals = get_ranked_hospitals(inc["lat"], inc["lng"])

    current_level = current_hospital.get("facilityLevel", "PHC") if current_hospital else "PHC"
    current_caps_raw = current_hospital.get("capabilities", ["ASV", "EMERGENCY_CARE"]) if current_hospital else ["ASV", "EMERGENCY_CARE"]
    if isinstance(current_caps_raw, str):
        try:
            current_caps = json.loads(current_caps_raw)
        except Exception:
            current_caps = [c.strip() for c in current_caps_raw.split(",") if c.strip()]
    else:
        current_caps = list(current_caps_raw)

    # Ptosis and wound values
    pct_change = float(latest_ptosis["percentChange"]) if latest_ptosis and latest_ptosis["percentChange"] is not None else None
    ptosis_sev = latest_ptosis["severity"] if latest_ptosis else "none"
    swelling_prog = latest_wound["progression"] if latest_wound else "NONE"
    venom_type = "NEUROTOXIC" if (pct_change is not None and pct_change >= 20.0) or (latest_ptosis and latest_ptosis["ptosisDetected"]) else "UNKNOWN"


    gap_result = evaluate_capability_gap(
        current_facility_level=current_level,
        current_capabilities=current_caps,
        venom_type=venom_type,
        ptosis_severity=ptosis_sev,
        ptosis_percent_change=pct_change,
        swelling_progression=swelling_prog,
        systemic_signs=symptoms,
    )

    # Rank capable destination facilities
    ranked_targets = rank_capable_hospitals(
        origin={"lat": inc["lat"], "lng": inc["lng"]},
        hospitals=all_hospitals,
        required_capabilities=gap_result["required_capabilities"],
    )

    eligible = [h for h in ranked_targets if h["eligible"]]
    recommended = eligible[0] if eligible else None

    return {
        "incidentId": inc_id,
        "presentingHospital": current_hospital,
        "capabilityGap": gap_result,
        "recommendedHospital": recommended,
        "eligibleHospitals": eligible,
        "allHospitals": ranked_targets,
    }


@router.post("/api/incidents/{inc_id}/referrals")
def create_referral(
    inc_id: str,
    body: ReferralCreateRequest,
    role: str = Depends(require_role_if_enforced("victim", "hospital_admin", "system_admin")),
):
    """Create a new referral record and enqueue transactional outbox event."""
    ref_id = db.new_id()
    now = db.now_iso()
    with db.get_conn() as conn:
        inc = conn.execute("SELECT id FROM Incident WHERE id=?", (inc_id,)).fetchone()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        from_h = conn.execute("SELECT id FROM Hospital WHERE id=?", (body.fromHospitalId,)).fetchone()
        if not from_h:
            raise HTTPException(status_code=404, detail="Referring facility not found")
        to_h = conn.execute("SELECT id, name FROM Hospital WHERE id=?", (body.toHospitalId,)).fetchone()
        if not to_h:
            raise HTTPException(status_code=404, detail="Target facility not found")

        conn.execute(
            "INSERT INTO Referral ("
            "id, incidentId, fromHospitalId, toHospitalId, status, urgency, "
            "missingCapabilities, clinicalReason, createdAt, updatedAt"
            ") VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)",
            (
                ref_id,
                inc_id,
                body.fromHospitalId,
                body.toHospitalId,
                body.urgency,
                json.dumps(body.missingCapabilities),
                body.clinicalReason,
                now,
                now,
            ),
        )

        payload = {
            "referralId": ref_id,
            "incidentId": inc_id,
            "fromHospitalId": body.fromHospitalId,
            "toHospitalId": body.toHospitalId,
            "toHospitalName": to_h["name"],
            "urgency": body.urgency,
            "missingCapabilities": body.missingCapabilities,
            "clinicalReason": body.clinicalReason,
            "status": "PENDING",
            "createdAt": now,
        }
        append_outbox_tx(conn, "ReferralCreated", inc_id, payload)

    audit(
        incident_id=inc_id,
        actor="referring_clinician",
        action="REFERRAL_CREATED",
        entity="Referral",
        metadata={"referralId": ref_id, "toHospitalId": body.toHospitalId, "urgency": body.urgency},
    )

    return {
        "id": ref_id,
        "incidentId": inc_id,
        "fromHospitalId": body.fromHospitalId,
        "toHospitalId": body.toHospitalId,
        "status": "PENDING",
        "urgency": body.urgency,
        "missingCapabilities": body.missingCapabilities,
        "clinicalReason": body.clinicalReason,
        "createdAt": now,
        "updatedAt": now,
    }


@router.get("/api/incidents/{inc_id}/referrals")
def list_incident_referrals(inc_id: str):
    """List all referrals for an incident."""
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM Referral WHERE incidentId=? ORDER BY createdAt DESC", (inc_id,)
        ).fetchall()
        referrals = []
        for r in rows:
            rd = dict(r)
            try:
                rd["missingCapabilities"] = json.loads(rd["missingCapabilities"])
            except Exception:
                rd["missingCapabilities"] = [c.strip() for c in rd["missingCapabilities"].split(",") if c.strip()]
            referrals.append(rd)
    return {"referrals": referrals}


@router.patch("/api/referrals/{ref_id}/accept")
def accept_referral(
    ref_id: str,
    body: ReferralAcceptRequest,
    role: str = Depends(require_role_if_enforced("hospital_admin", "system_admin")),
):
    """Guarded acceptance of referral by receiving hospital."""
    now = db.now_iso()
    with db.get_conn() as conn:
        ref = conn.execute("SELECT * FROM Referral WHERE id=?", (ref_id,)).fetchone()
        if not ref:
            raise HTTPException(status_code=404, detail="Referral not found")
        if ref["status"] != "PENDING":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot accept referral in '{ref['status']}' status (must be PENDING)",
            )

        cur = conn.execute(
            "UPDATE Referral SET status='ACCEPTED', acceptedAt=?, acceptedBy=?, updatedAt=? "
            "WHERE id=? AND status='PENDING'",
            (now, body.acceptedBy, now, ref_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=409, detail="Referral conflict or already updated")

        payload = {
            "referralId": ref_id,
            "incidentId": ref["incidentId"],
            "toHospitalId": ref["toHospitalId"],
            "status": "ACCEPTED",
            "acceptedAt": now,
            "acceptedBy": body.acceptedBy,
            "notes": body.notes,
        }
        append_outbox_tx(conn, "ReferralAccepted", ref["incidentId"], payload)

    audit(
        incident_id=ref["incidentId"],
        actor=body.acceptedBy or "receiving_hospital",
        action="REFERRAL_ACCEPTED",
        entity="Referral",
        metadata={"referralId": ref_id, "acceptedAt": now},
    )
    return {"referralId": ref_id, "status": "ACCEPTED", "acceptedAt": now, "acceptedBy": body.acceptedBy}


@router.patch("/api/referrals/{ref_id}/decline")
def decline_referral(
    ref_id: str,
    body: ReferralDeclineRequest,
    role: str = Depends(require_role_if_enforced("hospital_admin", "system_admin")),
):
    """Guarded decline of referral by receiving hospital."""
    now = db.now_iso()
    with db.get_conn() as conn:
        ref = conn.execute("SELECT * FROM Referral WHERE id=?", (ref_id,)).fetchone()
        if not ref:
            raise HTTPException(status_code=404, detail="Referral not found")
        if ref["status"] != "PENDING":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot decline referral in '{ref['status']}' status (must be PENDING)",
            )

        cur = conn.execute(
            "UPDATE Referral SET status='DECLINED', declinedAt=?, declinedReason=?, updatedAt=? "
            "WHERE id=? AND status='PENDING'",
            (now, body.reason, now, ref_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=409, detail="Referral conflict or already updated")

        payload = {
            "referralId": ref_id,
            "incidentId": ref["incidentId"],
            "toHospitalId": ref["toHospitalId"],
            "status": "DECLINED",
            "declinedAt": now,
            "declinedBy": body.declinedBy,
            "declinedReason": body.reason,
        }
        append_outbox_tx(conn, "ReferralDeclined", ref["incidentId"], payload)

    audit(
        incident_id=ref["incidentId"],
        actor=body.declinedBy or "receiving_hospital",
        action="REFERRAL_DECLINED",
        entity="Referral",
        metadata={"referralId": ref_id, "reason": body.reason},
    )
    return {"referralId": ref_id, "status": "DECLINED", "declinedAt": now, "declinedReason": body.reason}


@router.patch("/api/referrals/{ref_id}/transport")
def start_transport(
    ref_id: str,
    role: str = Depends(require_role_if_enforced("victim", "hospital_admin", "system_admin")),
):
    """Guarded transition indicating ambulance/transport has started."""
    now = db.now_iso()
    with db.get_conn() as conn:
        ref = conn.execute("SELECT * FROM Referral WHERE id=?", (ref_id,)).fetchone()
        if not ref:
            raise HTTPException(status_code=404, detail="Referral not found")
        if ref["status"] != "ACCEPTED":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot start transport in '{ref['status']}' status (must be ACCEPTED)",
            )

        cur = conn.execute(
            "UPDATE Referral SET status='IN_TRANSIT', transportStartedAt=?, updatedAt=? "
            "WHERE id=? AND status='ACCEPTED'",
            (now, now, ref_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=409, detail="Referral conflict or already updated")

        payload = {
            "referralId": ref_id,
            "incidentId": ref["incidentId"],
            "status": "IN_TRANSIT",
            "transportStartedAt": now,
        }
        append_outbox_tx(conn, "TransportStarted", ref["incidentId"], payload)

    audit(
        incident_id=ref["incidentId"],
        actor="ambulance_coordinator",
        action="TRANSPORT_STARTED",
        entity="Referral",
        metadata={"referralId": ref_id, "startedAt": now},
    )
    return {"referralId": ref_id, "status": "IN_TRANSIT", "transportStartedAt": now}


@router.patch("/api/referrals/{ref_id}/arrive")
def confirm_arrival(
    ref_id: str,
    role: str = Depends(require_role_if_enforced("hospital_admin", "system_admin")),
):
    """Guarded transition indicating patient has arrived at receiving facility."""
    now = db.now_iso()
    with db.get_conn() as conn:
        ref = conn.execute("SELECT * FROM Referral WHERE id=?", (ref_id,)).fetchone()
        if not ref:
            raise HTTPException(status_code=404, detail="Referral not found")
        if ref["status"] != "IN_TRANSIT":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot confirm arrival in '{ref['status']}' status (must be IN_TRANSIT)",
            )

        cur = conn.execute(
            "UPDATE Referral SET status='ARRIVED', arrivedAt=?, updatedAt=? "
            "WHERE id=? AND status='IN_TRANSIT'",
            (now, now, ref_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=409, detail="Referral conflict or already updated")

        payload = {
            "referralId": ref_id,
            "incidentId": ref["incidentId"],
            "status": "ARRIVED",
            "arrivedAt": now,
        }
        append_outbox_tx(conn, "PatientArrived", ref["incidentId"], payload)

    audit(
        incident_id=ref["incidentId"],
        actor="receiving_hospital",
        action="PATIENT_ARRIVED",
        entity="Referral",
        metadata={"referralId": ref_id, "arrivedAt": now},
    )
    return {"referralId": ref_id, "status": "ARRIVED", "arrivedAt": now}


@router.get("/api/incidents/{inc_id}/corridor")
def get_corridor_timeline(inc_id: str):
    """
    Unified 8-stage Care Corridor timeline:
    1. Bite Reported / SOS
    2. Presenting Facility
    3. Clinical Telemetry (VenomScore, Ptosis, Wounds)
    4. Capability Gap Detected
    5. Capable Referral Target Recommended
    6. Receiving Facility Acceptance
    7. Ambulance / Inter-Facility Transit
    8. Patient Arrived & Care Completed
    """
    with db.get_conn() as conn:
        inc = conn.execute("SELECT * FROM Incident WHERE id=?", (inc_id,)).fetchone()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        inc = dict(inc)

        presenting_hosp = None
        if inc.get("presentingHospitalId"):
            presenting_hosp = _load_hospital(conn, inc["presentingHospitalId"])

        latest_referral = conn.execute(
            "SELECT * FROM Referral WHERE incidentId=? ORDER BY createdAt DESC LIMIT 1", (inc_id,)
        ).fetchone()
        ref_dict = None
        to_hosp = None
        if latest_referral:
            ref_dict = dict(latest_referral)
            try:
                ref_dict["missingCapabilities"] = json.loads(ref_dict["missingCapabilities"])
            except Exception:
                ref_dict["missingCapabilities"] = [c.strip() for c in ref_dict["missingCapabilities"].split(",") if c.strip()]
            to_hosp = _load_hospital(conn, ref_dict["toHospitalId"])

        latest_ptosis = conn.execute(
            "SELECT * FROM PtosisReading WHERE incidentId=? ORDER BY timestamp DESC LIMIT 1", (inc_id,)
        ).fetchone()
        latest_wound = conn.execute(
            "SELECT * FROM WoundReading WHERE incidentId=? ORDER BY timestamp DESC LIMIT 1", (inc_id,)
        ).fetchone()

    loc_str = inc.get("address") or f"{inc['lat']}, {inc['lng']}"
    # Build 8 chronological stages
    stages = [
        {
            "index": 1,
            "stageKey": "SOS_REPORTED",
            "title": "Incident & SOS Activated",
            "status": "COMPLETED",
            "timestamp": inc["createdAt"],
            "details": f"Bite reported at {loc_str}",
        },
        {
            "index": 2,
            "stageKey": "PRESENTING_FACILITY",
            "title": "Presenting Facility Triage",
            "status": "COMPLETED" if presenting_hosp else "IN_PROGRESS",
            "timestamp": inc.get("updatedAt"),
            "facilityName": presenting_hosp["name"] if presenting_hosp else "Pending initial arrival",
            "facilityLevel": presenting_hosp.get("facilityLevel", "PHC") if presenting_hosp else "PHC",
            "capabilities": presenting_hosp.get("capabilities", ["ASV", "EMERGENCY_CARE"]) if presenting_hosp else [],
        },
        {
            "index": 3,
            "stageKey": "CLINICAL_TELEMETRY",
            "title": "Clinical Observation & VenomScore",
            "status": "COMPLETED" if latest_ptosis or latest_wound else "PENDING",
            "timestamp": (latest_ptosis["timestamp"] if latest_ptosis else inc["createdAt"]),
            "ptosisSeverity": latest_ptosis["severity"] if latest_ptosis else "none",
            "percentChange": latest_ptosis["percentChange"] if latest_ptosis else None,
            "woundProgression": latest_wound["progression"] if latest_wound else "NONE",
        },
        {
            "index": 4,
            "stageKey": "CAPABILITY_GAP",
            "title": "Facility Capability Gap",
            "status": "COMPLETED" if ref_dict else "PENDING",
            "missingCapabilities": ref_dict.get("missingCapabilities", []) if ref_dict else [],
            "urgency": ref_dict.get("urgency", "ROUTINE") if ref_dict else "ROUTINE",
            "clinicalReason": ref_dict.get("clinicalReason") if ref_dict else None,
        },
        {
            "index": 5,
            "stageKey": "REFERRAL_TARGET",
            "title": "Capable Receiving Facility",
            "status": "COMPLETED" if ref_dict else "PENDING",
            "destinationHospitalName": to_hosp["name"] if to_hosp else None,
            "destinationLevel": to_hosp.get("facilityLevel") if to_hosp else None,
            "ventilatorCount": to_hosp.get("ventilatorCount", 0) if to_hosp else 0,
        },
        {
            "index": 6,
            "stageKey": "HOSPITAL_ACCEPTANCE",
            "title": "Receiving Hospital Acceptance",
            "status": (
                "COMPLETED" if ref_dict and ref_dict["status"] in ("ACCEPTED", "IN_TRANSIT", "ARRIVED", "COMPLETED")
                else "DECLINED" if ref_dict and ref_dict["status"] == "DECLINED"
                else "IN_PROGRESS" if ref_dict and ref_dict["status"] == "PENDING"
                else "PENDING"
            ),
            "acceptedAt": ref_dict.get("acceptedAt") if ref_dict else None,
            "acceptedBy": ref_dict.get("acceptedBy") if ref_dict else None,
            "declinedReason": ref_dict.get("declinedReason") if ref_dict else None,
        },
        {
            "index": 7,
            "stageKey": "AMBULANCE_TRANSIT",
            "title": "Inter-Facility 108 Ambulance Transit",
            "status": (
                "COMPLETED" if ref_dict and ref_dict["status"] in ("ARRIVED", "COMPLETED")
                else "IN_PROGRESS" if ref_dict and ref_dict["status"] == "IN_TRANSIT"
                else "PENDING"
            ),
            "transportStartedAt": ref_dict.get("transportStartedAt") if ref_dict else None,
        },
        {
            "index": 8,
            "stageKey": "PATIENT_ARRIVED",
            "title": "Arrival & Closed-Loop Handoff",
            "status": (
                "COMPLETED" if ref_dict and ref_dict["status"] in ("ARRIVED", "COMPLETED")
                else "PENDING"
            ),
            "arrivedAt": ref_dict.get("arrivedAt") if ref_dict else None,
        },
    ]

    return {
        "incidentId": inc_id,
        "presentingHospital": presenting_hosp,
        "activeReferral": ref_dict,
        "destinationHospital": to_hosp,
        "stages": stages,
    }
