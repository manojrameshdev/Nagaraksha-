"""SQLite database layer for NagRaksha (Python backend).

Uses the same schema as the Prisma/SQLite database the Node prototype used,
so the data model is consistent. Pure sqlite3 + raw SQL — no ORM needed for
the hackathon, and it keeps the backend dependency-light.
"""
from __future__ import annotations

import sqlite3
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


DB_DIR = Path(__file__).resolve().parent.parent / "db"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = os.environ.get("NAGRAKSHA_DB", str(DB_DIR / "nagraksha.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS Incident (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE,
    lat REAL,
    lng REAL,
    address TEXT,
    biteTime TEXT,
    bodyPart TEXT,
    snakeType TEXT,
    state TEXT DEFAULT 'PENDING',
    presentingHospitalId TEXT,
    createdAt TEXT,
    updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_incident_state ON Incident(state);
CREATE INDEX IF NOT EXISTS idx_incident_created ON Incident(createdAt);

CREATE TABLE IF NOT EXISTS DispatchAttempt (

    id TEXT PRIMARY KEY,
    incidentId TEXT,
    category TEXT,
    candidateName TEXT,
    candidateRole TEXT,
    distanceKm REAL,
    etaMin INTEGER,
    sentAt TEXT,
    acceptedAt TEXT,
    outcome TEXT DEFAULT 'PENDING',
    sequence INTEGER DEFAULT 1,
    responderId TEXT,
    smsSid TEXT,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dispatch_incident ON DispatchAttempt(incidentId);

CREATE TABLE IF NOT EXISTS Hospital (
    id TEXT PRIMARY KEY,
    name TEXT,
    lat REAL,
    lng REAL,
    address TEXT,
    contact TEXT,
    facilityLevel TEXT DEFAULT 'PHC',
    capabilities TEXT DEFAULT '["ASV","EMERGENCY_CARE"]',
    ventilatorCount INTEGER DEFAULT 0,
    icuBedsAvailable INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS Referral (
    id TEXT PRIMARY KEY,
    incidentId TEXT NOT NULL,
    fromHospitalId TEXT NOT NULL,
    toHospitalId TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED')),
    urgency TEXT NOT NULL DEFAULT 'HIGH' CHECK (urgency IN ('CRITICAL_IMMEDIATE', 'HIGH_PRIORITY', 'ROUTINE')),
    missingCapabilities TEXT NOT NULL,
    clinicalReason TEXT NOT NULL,
    acceptedAt TEXT,
    acceptedBy TEXT,
    declinedAt TEXT,
    declinedReason TEXT,
    transportStartedAt TEXT,
    arrivedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE,
    FOREIGN KEY (fromHospitalId) REFERENCES Hospital(id),
    FOREIGN KEY (toHospitalId) REFERENCES Hospital(id)
);
CREATE INDEX IF NOT EXISTS idx_referral_incident ON Referral(incidentId);
CREATE INDEX IF NOT EXISTS idx_referral_to_hosp ON Referral(toHospitalId, status);

CREATE TABLE IF NOT EXISTS AntivenomStock (
    id TEXT PRIMARY KEY,
    hospitalId TEXT,
    product TEXT,
    status TEXT DEFAULT 'UNKNOWN',
    quantityBand TEXT,
    verifiedAt TEXT,
    verifiedBy TEXT,
    FOREIGN KEY (hospitalId) REFERENCES Hospital(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stock_hospital ON AntivenomStock(hospitalId);

CREATE TABLE IF NOT EXISTS SymptomObservation (
    id TEXT PRIMARY KEY,
    incidentId TEXT,
    code TEXT,
    label TEXT,
    severity TEXT,
    value TEXT,
    observedAt TEXT,
    author TEXT,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SnakeObservation (
    id TEXT PRIMARY KEY,
    incidentId TEXT,
    imageRef TEXT,
    predictedClass TEXT,
    confidence REAL,
    venomType TEXT,
    rescuerSpecies TEXT,
    createdAt TEXT,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS RiskReport (
    id TEXT PRIMARY KEY,
    area TEXT,
    lat REAL,
    lng REAL,
    level TEXT,
    score INTEGER,
    weather TEXT,
    season TEXT,
    likelySnakes TEXT,
    createdAt TEXT
);

CREATE TABLE IF NOT EXISTS MythThread (
    id TEXT PRIMARY KEY,
    question TEXT,
    answer TEXT,
    mythFlagged INTEGER DEFAULT 0,
    sources TEXT,
    createdAt TEXT
);

CREATE TABLE IF NOT EXISTS KnowledgeChunk (
    id TEXT PRIMARY KEY,
    docId TEXT,
    title TEXT,
    category TEXT,
    content TEXT,
    tags TEXT,
    reviewedBy TEXT DEFAULT 'NagRaksha medical review',
    reviewedAt TEXT,
    createdAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_kb_category ON KnowledgeChunk(category);

CREATE TABLE IF NOT EXISTS OutboxEvent (
    id TEXT PRIMARY KEY,
    type TEXT,
    aggregateId TEXT,
    payload TEXT,
    state TEXT DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    createdAt TEXT,
    processedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_state ON OutboxEvent(state);
CREATE INDEX IF NOT EXISTS idx_outbox_agg ON OutboxEvent(aggregateId);

CREATE TABLE IF NOT EXISTS AuditEvent (
    id TEXT PRIMARY KEY,
    incidentId TEXT,
    actor TEXT,
    action TEXT,
    entity TEXT,
    metadata TEXT,
    timestamp TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_incident ON AuditEvent(incidentId);
CREATE INDEX IF NOT EXISTS idx_audit_action ON AuditEvent(action);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON AuditEvent(timestamp);

CREATE TABLE IF NOT EXISTS WoundReading (
    id TEXT PRIMARY KEY,
    incidentId TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    swellingAreaPx INTEGER NOT NULL,
    severityScore INTEGER NOT NULL,
    progression TEXT NOT NULL,
    estimatedVenomSpreadCm REAL,
    recommendedAntivenomVials INTEGER,
    aiNotes TEXT,
    imageB64 TEXT,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wound_incident ON WoundReading(incidentId);

CREATE TABLE IF NOT EXISTS PtosisReading (
    id TEXT PRIMARY KEY,
    incidentId TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    rightAperture REAL NOT NULL,
    leftAperture REAL NOT NULL,
    avgAperture REAL NOT NULL,
    baselineAperture REAL,
    percentChange REAL,
    ptosisDetected INTEGER NOT NULL DEFAULT 0,
    severity TEXT NOT NULL DEFAULT 'none',
    asymmetric INTEGER NOT NULL DEFAULT 0,
    minutesSinceBite INTEGER,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ptosis_incident ON PtosisReading(incidentId);

CREATE TABLE IF NOT EXISTS Responder (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    verified INTEGER DEFAULT 0,
    skills TEXT,
    activeIncidentId TEXT,
    createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_responder_role ON Responder(role);

CREATE TABLE IF NOT EXISTS VillageAudit (
    id TEXT PRIMARY KEY,
    ashaWorkerId TEXT NOT NULL,
    gramPanchayat TEXT NOT NULL,
    district TEXT NOT NULL,
    auditDate TEXT NOT NULL,
    lat REAL,
    lng REAL,
    householdsVisited INTEGER DEFAULT 0,
    aggregateRiskScore REAL,
    createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_village_district ON VillageAudit(district);

CREATE TABLE IF NOT EXISTS HouseholdAudit (
    id TEXT PRIMARY KEY,
    villageAuditId TEXT NOT NULL,
    lat REAL,
    lng REAL,
    sleepsOnFloor INTEGER NOT NULL,
    hasWallGaps INTEGER NOT NULL,
    adequateLighting INTEGER NOT NULL,
    wearsFootwearNight INTEGER NOT NULL,
    nearAgriField INTEGER NOT NULL,
    priorSnakebite INTEGER NOT NULL,
    knowsMythsFacts INTEGER NOT NULL,
    knowsNearestHospital INTEGER NOT NULL,
    riskScore REAL NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (villageAuditId) REFERENCES VillageAudit(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_household_village ON HouseholdAudit(villageAuditId);

CREATE TABLE IF NOT EXISTS Stakeholder (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    role TEXT NOT NULL,
    supportType TEXT NOT NULL,
    contact TEXT,
    district TEXT,
    addedAt TEXT NOT NULL
);
"""


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r["name"] == column for r in rows)


def migrate_db():
    """Apply schema migrations that cannot use CREATE IF NOT EXISTS (ALTER TABLE)."""
    with get_conn() as conn:
        # Hospital compliance columns (added in rebuild)
        for col, defn in [
            ("complianceScore", "REAL DEFAULT 100.0"),
            ("complianceUpdatedAt", "TEXT"),
            ("complianceRank", "INTEGER"),
            ("facilityLevel", "TEXT DEFAULT 'PHC'"),
            ("capabilities", "TEXT DEFAULT '[\"ASV\",\"EMERGENCY_CARE\"]'"),
            ("ventilatorCount", "INTEGER DEFAULT 0"),
            ("icuBedsAvailable", "INTEGER DEFAULT 0"),
        ]:
            if not _column_exists(conn, "Hospital", col):
                conn.execute(f"ALTER TABLE Hospital ADD COLUMN {col} {defn}")
        # Incident presenting facility column
        if not _column_exists(conn, "Incident", "presentingHospitalId"):
            conn.execute("ALTER TABLE Incident ADD COLUMN presentingHospitalId TEXT")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_incident_presenting ON Incident(presentingHospitalId)")
        # DispatchAttempt real-SMS columns (added when Twilio dispatch was wired in)

        for col, defn in [
            ("responderId", "TEXT"),
            ("smsSid", "TEXT"),
        ]:
            if not _column_exists(conn, "DispatchAttempt", col):
                conn.execute(f"ALTER TABLE DispatchAttempt ADD COLUMN {col} {defn}")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode = WAL")  # concurrent readers + single writer
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    migrate_db()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def days_since(iso_ts: str) -> float:
    """Return fractional days elapsed since an ISO-8601 timestamp."""
    try:
        t = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - t
        return delta.total_seconds() / 86400
    except Exception:
        return 9999.0


def new_id() -> str:
    return uuid.uuid4().hex[:24]


