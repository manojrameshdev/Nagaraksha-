"""JWT auth middleware — minimal role-based access for NagRaksha demo.

Not full OAuth. Role-keyed tokens protect quota-burning routes.
Demo login: victim / hospital_admin / system_admin each have a shared secret in .env.

Usage on protected routes:
  @router.patch("/hospitals/{id}/stock")
  async def update_stock(..., role: str = Depends(require_role("hospital_admin", "system_admin"))):
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Callable

from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError

SECRET = os.environ.get("JWT_SECRET", "nagraksha-demo-secret-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

ROLE_SECRETS: dict[str, str] = {
    "victim": os.environ.get("ROLE_SECRET_VICTIM", "victim-demo"),
    "hospital_admin": os.environ.get("ROLE_SECRET_HOSPITAL", "hospital-demo"),
    "system_admin": os.environ.get("ROLE_SECRET_ADMIN", "admin-demo"),
}


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


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory: raise 403 if caller's role isn't in allowed_roles."""
    def _check(role: str = Depends(get_role)) -> str:
        if role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role}' is not permitted. Required: {list(allowed_roles)}",
            )
        return role
    return _check
