"""WebSocket handler — replaces SSE for real-time incident state updates.

One channel per incident. All roles (victim, responder, hospital) subscribe.
Server pushes events; client just listens. Reconnection handled client-side.
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# incident_id → list of open WebSocket connections
_connections: dict[str, list[WebSocket]] = defaultdict(list)

# Main event loop (registered from the app lifespan) so the background outbox
# worker thread can push events to connected WebSocket clients.
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop) -> None:
    global _loop
    _loop = loop


def broadcast_sync(incident_id: str, event: str, payload: dict) -> None:
    """Thread-safe broadcast: schedule onto the app's event loop from any thread."""
    loop = _loop
    if loop is None or loop.is_closed():
        return
    try:
        asyncio.run_coroutine_threadsafe(broadcast(incident_id, event, payload), loop)
    except (RuntimeError, ValueError):
        pass


@router.websocket("/ws/incidents/{incident_id}")
async def incident_ws(websocket: WebSocket, incident_id: str):
    """WebSocket endpoint. One connection per viewer per incident."""
    await websocket.accept()
    _connections[incident_id].append(websocket)
    try:
        while True:
            # Keep alive; the server does all pushing via broadcast()
            # Client can send pings; we just receive and ignore them
            await websocket.receive_text()
    except WebSocketDisconnect:
        _remove(incident_id, websocket)
    except (RuntimeError, OSError):
        _remove(incident_id, websocket)


def _remove(incident_id: str, ws: WebSocket) -> None:
    conns = _connections.get(incident_id, [])
    if ws in conns:
        conns.remove(ws)


async def broadcast(incident_id: str, event: str, payload: dict) -> None:
    """Push an event to all WebSocket clients subscribed to an incident."""
    message = json.dumps({"event": event, "data": payload})
    dead: list[WebSocket] = []
    for ws in list(_connections.get(incident_id, [])):
        try:
            await ws.send_text(message)
        except (WebSocketDisconnect, RuntimeError, OSError):
            dead.append(ws)
    for ws in dead:
        _remove(incident_id, ws)



def connection_count(incident_id: str) -> int:
    return len(_connections.get(incident_id, []))
