"""Start both backend (FastAPI) and frontend (Next.js) for NagRaksha.

Usage:
    python start.py          # start both
    python start.py --stop   # stop running processes
"""
from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time


ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

BACKEND_PORT = "8000"
FRONTEND_PORT = "3000"
BACKEND_HOST = "127.0.0.1"
BACKEND_LOG = os.path.join(ROOT, "backend.log")
FRONTEND_LOG = os.path.join(ROOT, "dev.log")

_procs: list[subprocess.Popen] = []


def _start_backend():
    log = open(BACKEND_LOG, "w", encoding="utf-8")
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", BACKEND_HOST, "--port", BACKEND_PORT],
        cwd=BACKEND_DIR, stdout=log, stderr=subprocess.STDOUT,
    )
    _procs.append(p)
    print(f"  backend  → PID {p.pid}  http://{BACKEND_HOST}:{BACKEND_PORT}")


def _start_frontend():
    log = open(FRONTEND_LOG, "w", encoding="utf-8")
    p = subprocess.Popen(
        ["npx", "next", "dev", "-p", FRONTEND_PORT],
        cwd=FRONTEND_DIR, stdout=log, stderr=subprocess.STDOUT,
    )
    _procs.append(p)
    print(f"  frontend → PID {p.pid}  http://localhost:{FRONTEND_PORT}")


def _stop():
    if sys.platform == "win32":
        subprocess.run(
            f"taskkill /F /FI \"WINDOWTITLE eq uvicorn*\" >nul 2>nul", shell=True
        )
        subprocess.run(
            f"taskkill /F /FI \"IMAGENAME eq node.exe\" /FI \"CMDLINE like %next%{FRONTEND_PORT}%\" >nul 2>nul",
            shell=True,
        )
    else:
        subprocess.run(
            f"pkill -f \"uvicorn.*{BACKEND_PORT}\" 2>/dev/null; "
            f"pkill -f \"next.*{FRONTEND_PORT}\" 2>/dev/null",
            shell=True,
        )
    print("  stopped nagraksha processes")


def _shutdown(signum, frame):
    print("\nShutting down...")
    for p in _procs:
        p.terminate()
    for p in _procs:
        p.wait(timeout=5)
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="NagRaksha dev launcher")
    parser.add_argument("--stop", action="store_true", help="Stop running dev processes")
    args = parser.parse_args()

    if args.stop:
        _stop()
        return

    print("Starting NagRaksha...\n")

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    _start_backend()
    time.sleep(1.5)
    _start_frontend()

    print(f"\nLogs:\n  backend  → {BACKEND_LOG}\n  frontend → {FRONTEND_LOG}")
    print("\nPress Ctrl+C to stop both.\n")

    try:
        for p in _procs:
            p.wait()
    except KeyboardInterrupt:
        _shutdown(None, None)


if __name__ == "__main__":
    main()
