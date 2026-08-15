"""Shared slowapi rate limiter for the NagRaksha backend.

Extracted from app.main so both the app entry point and individual route
modules (e.g. routes/sos.py) can apply ``@limiter.limit(...)`` without a
circular import — main.py imports the route modules before any module-level
limiter used to exist, so routes could never import it back from main.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])