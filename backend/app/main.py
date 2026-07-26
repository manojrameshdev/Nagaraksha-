"""NagRaksha backend — FastAPI application entry point.

Run: uvicorn app.main:app --port 8000 --reload
The frontend (Next.js) calls these endpoints via the gateway using
?XTransformPort=8000.
"""
from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import database as db
from .rag import ensure_kb_seeded
from .eventbus import start_worker
from .routes import sos, incidents, hospitals, risk, snake_id, myth_buster, stats, architecture, ops

app = FastAPI(title="NagRaksha Backend", version="1.0.0")

# CORS — allow the Next.js dev server (port 3000) to call directly if needed.
# Normal traffic goes through the Caddy gateway (same-origin).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db.init_db()
    ensure_kb_seeded()
    start_worker()


@app.get("/api/health")
def health():
    return {"ok": True, "service": "nagraksha-backend", "language": "python"}


# Register route modules
app.include_router(sos.router)
app.include_router(incidents.router)
app.include_router(hospitals.router)
app.include_router(risk.router)
app.include_router(snake_id.router)
app.include_router(myth_buster.router)
app.include_router(stats.router)
app.include_router(architecture.router)
app.include_router(ops.router)
