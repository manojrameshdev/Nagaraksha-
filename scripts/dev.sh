#!/usr/bin/env bash
# Start the NagRaksha frontend (Next.js :3000) + backend (Python :8000).
set -m
cd "$(dirname "$0")/.."

# --- Backend (Python FastAPI on :8000) ---
(nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \
  > backend.log 2>&1 &)
echo "[dev] python backend starting on :8000 (log: backend.log)"

# --- Frontend (Next.js on :3000) ---
cd frontend
exec next dev -p 3000 --webpack 2>&1 | tee ../dev.log
