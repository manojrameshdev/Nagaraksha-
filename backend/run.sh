#!/usr/bin/env bash
# Start the NagRaksha Python backend (FastAPI/uvicorn on port 8000).
cd "$(dirname "$0")/.."
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
