# NagRaksha (ನಾಗರಕ್ಷಾ)

**India's Comprehensive Snakebite Emergency Response, Clinical Telemetry & Care Corridor Referral Network**

NagRaksha is an emergency response platform designed to eliminate fatal delays in snakebite treatment. It integrates one-tap community SOS dispatch, on-device facial landmarking for real-time neurotoxic progression tracking (VenomScore), and a capability-aware **Care Corridor** closed-loop referral system grounded in WHO (2016) and India NCDC NAPSE (2024) guidelines.

---

## Key Capabilities

1. **One-Tap SOS & Tripartite Parallel Dispatch**
   - Instantly notifies three independent responder lanes in parallel:
     - **Trained Village First Responder / ASHA Worker**
     - **Certified Snake Rescuer**
     - **108 ALS Ambulance** routed to the nearest hospital with confirmed antivenom (ASV).
   - Zero sequential queueing; live ETA streaming and automated outbox worker retries.

2. **On-Device VenomScore™ Neurotoxic Telemetry**
   - Client-side MediaPipe Face Landmarker running completely in the browser (WASM).
   - Tracks bilateral palpebral aperture (landmarks 159/145 and 386/374) against a personalized baseline.
   - Continuously computes ptosis percentage reduction and estimates required ASV vial bands (10–20 vials) according to WHO Table 3.
   - Zero video streaming to servers — only structured clinical telemetry is transmitted.

3. **Care Corridor & Capability-Aware Referral Engine**
   - Grounded in WHO (2016) Guidelines and National Action Plan for Prevention & Control of Snakebite Envenoming (NCDC NAPSE 2024, Sec 4.2).
   - Automatically detects clinical capability deficits at the presenting facility level (e.g. Primary Health Centres with ASV but no mechanical ventilation).
   - **Clinical Rules**:
     - Ptosis change $\ge 40\%$ or respiratory distress $\rightarrow$ Requires **VENTILATION** + **ICU** (`CRITICAL_IMMEDIATE`).
     - Persistent coagulopathy / spontaneous bleeding $\rightarrow$ Requires **BLOOD_BANK** + **ICU**.
     - Acute kidney injury / anuria $\rightarrow$ Requires **DIALYSIS** + **ICU**.
   - Enforces hard capability filtering to route cases exclusively to equipped District Hospitals or Tertiary Centres with active antivenom inventory.

4. **Closed-Loop 8-Stage Care Timeline & Hospital Console**
   - **Unified 8-Stage Timeline**:
     1. Incident & SOS Activated
     2. Presenting Facility Triage
     3. Clinical Observation & VenomScore
     4. Facility Capability Gap Detected
     5. Capable Receiving Facility Recommended
     6. Receiving Hospital Acceptance & Ventilator Reservation
     7. Inter-Facility 108 Ambulance Transit
     8. Patient Arrived & Care Completed
   - **Hospital Console (`?role=hospital`)**: Allows receiving hospital coordinators to accept transfers and reserve ICU ventilators with one tap.

5. **Curated RAG Myth-Busting Engine**
   - TF-IDF vector retrieval with local GGUF, Grok (xAI), or Gemini (Google) fallback over authoritative snakebite knowledge.
   - Debunks lethal myths (tight tourniquets, incisions, sucking venom, ice) with clinical evidence.

6. **Village Risk Audit Registry**
   - Mobile-first audit tool for ASHA workers to evaluate household risk factors (sleeping on floor, wall gaps, lighting, agricultural proximity).

---

## Quick Start

### Prerequisites

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 20+** — [nodejs.org](https://nodejs.org) (with `npm` or `pnpm`)

---

### 1. One-Step Automated Setup

Run the cross-platform setup script:

```bash
python setup.py
```

This single command:

1. Validates Python and Node.js environments.
2. Creates `.env` from `.env.example`.
3. Installs Python backend dependencies (`pip install -r backend/requirements.txt`).
4. Installs Next.js frontend dependencies.
5. Initializes SQLite database, seeds Karnataka demonstration hospitals (`Malavalli PHC`, `Mandya DH`, `K.R. Hospital Mysore`, etc.), and loads the deterministic rehearsal scenario (`NR-1042`).

---

### 2. Launch Services

Start both backend (FastAPI) and frontend (Next.js) with health monitoring:

```bash
python start.py
```

- **Backend API**: `http://127.0.0.1:8000` (FastAPI)
- **Frontend App**: `http://localhost:3000` (Next.js)

#### Direct Navigation Links:

| Role / Purpose                     | URL                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Victim / Community SOS**         | [http://localhost:3000](http://localhost:3000)                                                                         |
| **Hospital Care Corridor Console** | [http://localhost:3000/incidents/inc-nr-1042?role=hospital](http://localhost:3000/incidents/inc-nr-1042?role=hospital) |
| **State / ASHA Risk Dashboard**    | [http://localhost:3000/dashboard](http://localhost:3000/dashboard)                                                     |
| **Myth-Buster RAG Engine**         | [http://localhost:3000/myth-buster](http://localhost:3000/myth-buster)                                                 |
| **FastAPI Swagger Docs**           | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)                                                               |

#### Service Management:

- **Check Status**: `python start.py --status`
- **Stop Services**: `python start.py --stop` (or `Ctrl+C` in terminal)

---

## Environment Configuration

Configure options in `.env`:

```ini
# Database
NAGRAKSHA_DB=backend/db/nagraksha.db

# Cloud LLM Options (Optional — RAG works offline or with local GGUF)
GROK_API_KEY=xai-...        # Grok (xAI) API key
GEMINI_API_KEY=AIzaSy...    # Google Gemini API key

# Local LLM Option
# Place any .gguf model in model/ folder (auto-detected on startup)
```

---

## Project Architecture

```
Nagaraksha/
├── backend/
│   ├── app/
│   │   ├── domain.py             # Pure clinical decision rules (WHO 2016, NAPSE 2024)
│   │   ├── database.py           # SQLite database layer, schema migrations & outbox
│   │   ├── eventbus.py           # Transactional outbox worker & WebSocket broadcaster
│   │   ├── models.py             # Pydantic schemas & capability literal unions
│   │   ├── rag.py                # Scikit-learn TF-IDF RAG & LLM provider chain
│   │   ├── knowledge_base_data.py # Curated clinical knowledge chunks
│   │   └── routes/
│   │       ├── referrals.py      # Care Corridor referral lifecycle & evaluation API
│   │       ├── venom_score.py    # Ptosis telemetry & VenomScore endpoints
│   │       ├── sos.py            # SOS trigger & tripartite parallel dispatch
│   │       ├── incidents.py      # Incident stream, audit log, symptom logger
│   │       ├── hospitals.py      # Hospital registry, stock & capability endpoints
│   │       └── ws.py             # WebSocket connection hub
│   ├── seed_demo.py              # Karnataka demo dataset (7 facilities, NR-1042 scenario)
│   └── tests/                    # 103 Pytest unit & integration tests
├── frontend/
│   ├── app/                      # Next.js 16 App Router pages
│   ├── components/
│   │   ├── care-corridor-timeline.tsx # 8-Stage Care Corridor progression & hospital actions
│   │   ├── venom-score.tsx       # MediaPipe on-device WASM eye landmarking
│   │   └── venom-score-chart.tsx # Trend visualization
│   ├── store/
│   │   └── sos-store.ts          # Zustand state reconciler & WebSocket handlers
│   └── test/                     # Vitest test suite with MSW mock handlers
├── setup.py                      # One-step environment setup
└── start.py                      # Dev server orchestrator & health checker
```

---

## Testing & Quality Assurance

Run backend and frontend test suites locally:

```bash
# Backend Pytest Suite (103 tests)
cd backend && pytest tests/ -v

# Backend Ruff Linter
ruff check backend/app

# Frontend Vitest Suite (27 tests)
cd frontend && npx vitest run

# Frontend ESLint Check
cd frontend && npm run lint

# Next.js Production Turbopack Build
cd frontend && npx next build
```

---

## Process Standards

- **Automated Commit Trigger**: Always propose or execute a git commit with a descriptive message as soon as CI/CD pipelines pass, a milestone/phase is completed, or a debug session (`gsd-debugger`) is completed and resolved.
- **Workflow & Test Synchronization**: Always ensure GitHub workflow files (`.github/workflows/`) are synchronized with the project structure and that all tests pass before completing a task.
