"""Start and manage both backend (FastAPI) and frontend (Next.js) for NagRaksha.

Usage:
    python start.py          # start both backend & frontend with health checks
    python start.py --status # check status of running services
    python start.py --stop   # stop running dev processes
"""
from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

BACKEND_PORT = "8000"
FRONTEND_PORT = "3000"
BACKEND_HOST = "127.0.0.1"
BACKEND_LOG = os.path.join(ROOT, "backend.log")
FRONTEND_LOG = os.path.join(ROOT, "dev.log")

_procs: list[subprocess.Popen] = []


def _check_prerequisites():
    """Verify environment setup before starting."""
    print("Checking prerequisites...")
    # Python version
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 10):
        print(f"  [!] Warning: Python 3.10+ recommended (found {major}.{minor})")
    else:
        print(f"  [OK] Python {major}.{minor}")

    # Node / npx check
    if not shutil.which("npx") and not shutil.which("node"):
        print("  [!] Error: Node.js/npx not found on PATH. Please install Node.js 20+.")
        sys.exit(1)
    else:
        print("  [OK] Node.js / npx available")

    # .env check
    env_file = os.path.join(ROOT, ".env")
    env_example = os.path.join(ROOT, ".env.example")
    if not os.path.exists(env_file):
        if os.path.exists(env_example):
            print("  [i] Creating .env from .env.example...")
            shutil.copy(env_example, env_file)
        else:
            print("  [!] Note: No .env file found.")
    else:
        print("  [OK] .env file present")
    print()


def _is_port_responsive(url: str, timeout: float = 1.0) -> bool:
    """Check if an HTTP endpoint responds with a 2xx status."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NagRaksha-HealthCheck"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 400
    except Exception:
        return False


def _check_status():
    """Check and display status of NagRaksha services."""
    print("NagRaksha Status Check:")
    backend_url = f"http://{BACKEND_HOST}:{BACKEND_PORT}/api/health"
    frontend_url = f"http://localhost:{FRONTEND_PORT}"

    b_ok = _is_port_responsive(backend_url)
    f_ok = _is_port_responsive(frontend_url)

    print(f"  Backend  (port {BACKEND_PORT}): {'[ONLINE]' if b_ok else '[OFFLINE]'}")
    print(f"  Frontend (port {FRONTEND_PORT}): {'[ONLINE]' if f_ok else '[OFFLINE]'}")
    return b_ok, f_ok


def _start_backend():
    log = open(BACKEND_LOG, "w", encoding="utf-8")
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", BACKEND_HOST, "--port", BACKEND_PORT],
        cwd=BACKEND_DIR, stdout=log, stderr=subprocess.STDOUT,
    )
    _procs.append(p)
    print(f"  Backend  → PID {p.pid} | http://{BACKEND_HOST}:{BACKEND_PORT}")


def _start_frontend():
    log = open(FRONTEND_LOG, "w", encoding="utf-8")
    p = subprocess.Popen(
        ["npx", "next", "dev", "-p", FRONTEND_PORT],
        cwd=FRONTEND_DIR, stdout=log, stderr=subprocess.STDOUT,
        shell=(sys.platform == "win32")
    )
    _procs.append(p)
    print(f"  Frontend → PID {p.pid} | http://localhost:{FRONTEND_PORT}")


def _wait_for_health():
    """Poll services until they are ready."""
    print("\nWaiting for services to become healthy...")
    backend_url = f"http://{BACKEND_HOST}:{BACKEND_PORT}/api/health"
    frontend_url = f"http://localhost:{FRONTEND_PORT}"

    backend_ready = False
    frontend_ready = False

    for _ in range(15):
        if not backend_ready:
            backend_ready = _is_port_responsive(backend_url)
        if not frontend_ready:
            frontend_ready = _is_port_responsive(frontend_url)

        if backend_ready and frontend_ready:
            print("  [OK] Backend & Frontend are fully operational!")
            return True
        time.sleep(1.0)

    if backend_ready:
        print("  [OK] Backend is ready")
    else:
        print("  [!] Backend taking longer than expected to start (check backend.log)")

    if frontend_ready:
        print("  [OK] Frontend is ready")
    else:
        print("  [!] Frontend taking longer than expected to start (check dev.log)")

    return backend_ready or frontend_ready


def _stop():
    print("Stopping NagRaksha processes...")
    if sys.platform == "win32":
        subprocess.run(
            'taskkill /F /FI "WINDOWTITLE eq uvicorn*" >nul 2>nul', shell=True
        )
        subprocess.run(
            f'taskkill /F /FI "IMAGENAME eq node.exe" /FI "CMDLINE like %next%{FRONTEND_PORT}%" >nul 2>nul',
            shell=True,
        )
    else:
        subprocess.run(
            f'pkill -f "uvicorn.*{BACKEND_PORT}" 2>/dev/null; '
            f'pkill -f "next.*{FRONTEND_PORT}" 2>/dev/null',
            shell=True,
        )
    print("  Stopped NagRaksha processes.")


def _shutdown(signum, frame):
    print("\nShutting down NagRaksha...")
    for p in _procs:
        try:
            p.terminate()
        except Exception:
            pass
    for p in _procs:
        try:
            p.wait(timeout=3)
        except Exception:
            pass
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="NagRaksha dev launcher & manager")
    parser.add_argument("--stop", action="store_true", help="Stop running dev processes")
    parser.add_argument("--status", action="store_true", help="Check status of running services")
    args = parser.parse_args()

    if args.stop:
        _stop()
        return

    if args.status:
        _check_status()
        return

    print("==================================================")
    print(" NagRaksha — Parallel Emergency Response Launcher ")
    print("==================================================\n")

    _check_prerequisites()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    print("Starting services...")
    _start_backend()
    _start_frontend()

    print(f"\nLog files:\n  Backend  → {BACKEND_LOG}\n  Frontend → {FRONTEND_LOG}")

    _wait_for_health()

    print("\nPress Ctrl+C to stop both services.\n")

    try:
        for p in _procs:
            p.wait()
    except KeyboardInterrupt:
        _shutdown(None, None)


if __name__ == "__main__":
    main()
