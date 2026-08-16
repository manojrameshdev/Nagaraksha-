"""NagRaksha — One-step environment setup & dependency installer.

Usage:
    python setup.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")
ENV_FILE = os.path.join(ROOT, ".env")
ENV_EXAMPLE = os.path.join(ROOT, ".env.example")


def print_step(num: int, title: str):
    print(f"\n[{num}/5] {title}")
    print("=" * 50)


def check_prerequisites():
    print_step(1, "Checking Prerequisites")
    # Python
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 10):
        print(f"  [!] Warning: Python 3.10+ recommended (found {major}.{minor})")
    else:
        print(f"  [OK] Python {major}.{minor}")

    # Node / package manager
    node_path = shutil.which("node")
    if not node_path:
        print("  [!] Error: Node.js 20+ is required. Please install Node.js.")
        sys.exit(1)

    pnpm_path = shutil.which("pnpm")
    npm_path = shutil.which("npm")
    if pnpm_path:
        print("  [OK] Node.js & pnpm detected")
    elif npm_path:
        print("  [OK] Node.js & npm detected (pnpm fallback enabled)")
    else:
        print("  [!] Error: Node.js package manager (npm or pnpm) not found on PATH.")
        sys.exit(1)


def setup_env():
    print_step(2, "Setting Up Environment File (.env)")
    if not os.path.exists(ENV_FILE):
        if os.path.exists(ENV_EXAMPLE):
            shutil.copy(ENV_EXAMPLE, ENV_FILE)
            print("  [OK] Created .env from .env.example")
        else:
            with open(ENV_FILE, "w", encoding="utf-8") as f:
                f.write("# NagRaksha Environment\nNAGRAKSHA_DB=backend/db/nagraksha.db\n")
            print("  [OK] Created default .env file")
    else:
        print("  [OK] Existing .env file found")

    # Inform user about API keys / local model
    print("\n  Environment Configuration Summary:")
    print("  * Database: SQLite (default at backend/db/nagraksha.db)")
    print("  * Chatbot & Vision AI Options:")
    print("      1. Local GGUF: Place any .gguf model in model/ (no API key needed for RAG)")
    print("      2. Grok (xAI): Set GROK_API_KEY in .env (RAG chatbot + Snake ID Vision)")
    print("      3. Gemini (Google): Set GEMINI_API_KEY in .env (secondary RAG fallback)")


def install_backend_deps():
    print_step(3, "Installing Backend Dependencies (Python)")
    req_file = os.path.join(BACKEND_DIR, "requirements.txt")
    if not os.path.exists(req_file):
        print("  [!] Warning: backend/requirements.txt not found")
        return

    cmd = [sys.executable, "-m", "pip", "install", "-r", req_file]
    print(f"  Running: {' '.join(cmd)}")
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("  [OK] Backend dependencies installed successfully")
    else:
        print("  [!] Warning: Failed to install some backend dependencies")


def install_frontend_deps():
    print_step(4, "Installing Frontend Dependencies")
    if not os.path.exists(os.path.join(FRONTEND_DIR, "package.json")):
        print("  [!] Warning: frontend/package.json not found")
        return

    pnpm_path = shutil.which("pnpm")
    npx_path = shutil.which("npx")

    if pnpm_path:
        cmd = ["pnpm", "install"]
        print("  Running: pnpm install in frontend/")
        res = subprocess.run(cmd, cwd=FRONTEND_DIR, shell=(sys.platform == "win32"))
    elif npx_path:
        cmd = ["npx", "-y", "pnpm", "install"]
        print("  Running: npx -y pnpm install in frontend/")
        res = subprocess.run(cmd, cwd=FRONTEND_DIR, shell=(sys.platform == "win32"))
    else:
        cmd = ["npm", "install", "--legacy-peer-deps"]
        print("  Running: npm install --legacy-peer-deps in frontend/")
        res = subprocess.run(cmd, cwd=FRONTEND_DIR, shell=(sys.platform == "win32"))

    if res.returncode == 0:
        print("  [OK] Frontend dependencies installed successfully")
    else:
        print("  [!] Warning: Failed to install frontend dependencies")



def init_database():
    print_step(5, "Initializing Database & Demo Seed Data")
    sys.path.insert(0, BACKEND_DIR)
    try:
        from app import seed
        seed.run()
        print("  [OK] Base SQLite schema, hospitals, risk reports & RAG knowledge base initialized")
    except Exception as e:
        print(f"  [!] Base database initialization notice: {e}")

    try:
        import seed_demo
        seed_demo.run()
        print("  [OK] Karnataka Care Corridor facilities & demo incident NR-1042 seeded")
    except Exception as e:
        print(f"  [!] Demo scenario seed notice: {e}")


def main():
    print("==================================================")
    print("      NagRaksha Automated Project Setup           ")
    print("==================================================")

    check_prerequisites()
    setup_env()
    install_backend_deps()
    install_frontend_deps()
    init_database()

    print("\n" + "=" * 50)
    print(" Setup Complete!")
    print("=" * 50)
    print("\nTo start NagRaksha:")
    print("  python start.py")
    print("\nTo check service status:")
    print("  python start.py --status")
    print("\nTo stop services:")
    print("  python start.py --stop")
    print("==================================================\n")


if __name__ == "__main__":
    main()

