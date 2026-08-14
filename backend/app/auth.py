"""JWT auth middleware — minimal role-based access for NagRaksha demo.

Not full OAuth. Role-keyed tokens protect quota-burning routes.
Demo login: victim / hospital_admin / system_admin each have a shared secret in .env.

In production (ENV=production) the demo fallback secrets are rejected at import
so a default-configured deployment fails startup instead of minting admin tokens.
Set AUTH_ENFORCED=true (or ENV=production) to require a valid role token on the
mutating routes that use require_role_if_enforced().

Usage on protected routes:
  @router.patch("/hospitals/{id}/stock")
  async def update_stock(..., role: str = Depends(require_role("hospital_admin", "system_admin"))):
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Header
from jose import JWTError, jwt

_ENV = os.environ.get("ENV", "development")

_DEMO_SECRET = "nagraksha-demo-secret-change-in-prod"
_DEMO_ROLE_SECRETS = {"victim-demo", "hospital-demo", "admin-demo"}


def _env_secret(name: str, default: str, placeholder: str) -> str:
    """Read a secret; refuse demo/placeholder values when ENV=production."""
    value = os.environ.get(name, default)
    if _ENV == "production" and (not value or value == placeholder or "demo" in value):
        raise RuntimeError(
            f"{name} must be set to a real, non-demo secret in production (ENV=production). "
            f"Refusing to start with the default."
        )
    return value


SECRET = _env_secret("JWT_SECRET", _DEMO_SECRET, _DEMO_SECRET)
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def _role_secret(name: str, default: str) -> str:
    value = os.environ.get(name, default)
    if _ENV == "production" and (not value or value in _DEMO_ROLE_SECRETS or "demo" in value):
        raise RuntimeError(
            f"{name} must be set to a real, non-demo secret in production (ENV=production). "
            f"Refusing to start with the default."
        )
    return value


ROLE_SECRETS: dict[str, str] = {
    "victim": _role_secret("ROLE_SECRET_VICTIM", "victim-demo"),
    "hospital_admin": _role_secret("ROLE_SECRET_HOSPITAL", "hospital-demo"),
    "system_admin": _role_secret("ROLE_SECRET_ADMIN", "admin-demo"),
}

# When enforced, mutating routes require a valid role token. Off by default so
# the demo UI (which has no login flow) keeps working; enable for deployment.
AUTH_ENFORCED = (
    _ENV == "production"
    or os.environ.get("AUTH_ENFORCED", "").lower() in ("1", "true", "yes", "on")
)


def create_token(role: str) -> str:
    """Create a JWT for a given role. Expires in TOKEN_EXPIRE_HOURS hours."""
    payload = {
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def _extract_role(authorization: str = Header(default="")) -> str:
    """Dependency: extract role from Authorization header. Returns 'anonymous' if absent."""
    if not authorization:
        return "anonymous"
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return str(payload.get("role", "anonymous"))
    except JWTError:
        return "anonymous"


def get_role(authorization: str = Header(default="")) -> str:
    """Dependency: same as _extract_role but raises 401 if token is present but invalid."""
    if not authorization:
        return "anonymous"
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return str(payload.get("role", "anonymous"))
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_role(*allowed_roles: str):
    """Dependency factory: raise 403 if caller's role isn't in allowed_roles."""
    def _check(role: str = Depends(get_role)) -> str:
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role}' is not permitted. Required: {list(allowed_roles)}",
            )
        return role
    return _check


def require_role_if_enforced(*allowed_roles: str):
    """Dependency factory: enforce role checks only when AUTH_ENFORCED is set.

    Keeps the token-less demo flow working while letting a production
    deployment turn on real authorization without code changes.
    """
    def _check(role: str = Depends(get_role)) -> str:
        if not AUTH_ENFORCED:
            return role
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role}' is not permitted. Required: {list(allowed_roles)}",
            )
        return role
    return _check
