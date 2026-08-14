"""NagRaksha backend — FastAPI application entry point.

Run: uvicorn app.main:app --port 8000 --reload
Frontend calls these endpoints via NEXT_PUBLIC_BACKEND_URL env var.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from . import database as db
from .rag import ensure_kb_seeded
from .eventbus import start_worker
from .scheduler import start_scheduler, stop_scheduler
from .routes import (
    sos, incidents, hospitals, risk, snake_id,
    myth_buster, stats, architecture, ops, transcribe,
)
from .routes import ws, wound, audit, stakeholders, twilio_webhook

# ── Sentry ──────────────────────────────────────────────────────────
sentry_dsn = os.environ.get("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[FastApiIntegration(), StarletteIntegration()],
        traces_sample_rate=0.2,
        environment=os.environ.get("ENV", "development"),
    )

# ── Rate limiter ─────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    ensure_kb_seeded()
    # Let the background outbox worker push events over WebSocket.
    ws.set_loop(asyncio.get_running_loop())
    start_worker()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="NagRaksha Backend", version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow Next.js dev + production URLs
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.environ.get("FRONTEND_URL"):
    _allowed_origins.append(os.environ["FRONTEND_URL"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "nagraksha-backend", "version": "2.0.0", "language": "python"}


# ── Auth token endpoint ──────────────────────────────────────────────
from .models import TokenRequest
from .auth import create_token, ROLE_SECRETS


@app.post("/api/auth/token")
@limiter.limit("10/minute")
def get_token(request: Request, body: TokenRequest):
    """Issue a JWT for a role. Takes {role, secret} — secrets set in .env."""
    expected = ROLE_SECRETS.get(body.role)
    if not expected or body.secret != expected:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid role or secret")
    token = create_token(body.role)
    return {"token": token, "role": body.role}


# ── Register all route modules ────────────────────────────────────────
app.include_router(sos.router)
app.include_router(incidents.router)
app.include_router(hospitals.router)
app.include_router(risk.router)
app.include_router(snake_id.router)
app.include_router(myth_buster.router)
app.include_router(stats.router)
app.include_router(architecture.router)
app.include_router(ops.router)
app.include_router(transcribe.router)

# New in v2
app.include_router(ws.router)
app.include_router(wound.router)
app.include_router(audit.router)
app.include_router(stakeholders.router)
app.include_router(twilio_webhook.router)
