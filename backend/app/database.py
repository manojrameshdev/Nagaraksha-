"""SQLite database layer for NagRaksha (Python backend).

Uses the same schema as the Prisma/SQLite database the Node prototype used,
so the data model is consistent. Pure sqlite3 + raw SQL — no ORM needed for
the hackathon, and it keeps the backend dependency-light.
"""
from __future__ import annotations

import sqlite3
import os
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
    active INTEGER DEFAULT 1,
    createdAt TEXT,
    updatedAt TEXT
);

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
"""


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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


import uuid


def new_id() -> str:
    return uuid.uuid4().hex[:24]
