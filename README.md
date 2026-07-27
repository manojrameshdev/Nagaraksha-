# NagRaksha

Snakebite response system for India — myth-busting RAG chatbot, SOS dispatch, hospital/antivenom maps, snake identification, and risk reporting.

## Quick Start

### Prerequisites

- **Python** 3.10+ — [python.org](https://python.org)
- **Node.js** 20+ — [nodejs.org](https://nodejs.org)
- **npm** or **bun** (we use bun-lock but npm works too)

### 1. One-Step Setup

```bash
git clone <repo>
cd nagraksha
python setup.py
```

This single command checks prerequisites, creates your `.env` file, installs Python and Node.js dependencies, and initializes the database.

Alternatively, to set up manually:

**Backend:**

```bash
pip install -r backend/requirements.txt
```

**Frontend:**

```bash
cd frontend && npm install && cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env` (automatically done by `python setup.py`):

```bash
cp .env.example .env
```

Or just export variables directly — the backend auto-reads them.

#### Required (for full LLM support)

| Variable         | Where to get it                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `GROK_API_KEY`   | [console.x.ai](https://console.x.ai) — Grok (xAI) API key                                    |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/app/apikey) — Google Gemini API key |

**Note:** You do **not** need API keys if you place a GGUF model file in `model/`. The backend will use the local model instead. See [Local LLM](#local-llm) below.

| Variable       | Purpose              | Default                   |
| -------------- | -------------------- | ------------------------- |
| `NAGRAKSHA_DB` | SQLite database path | `backend/db/nagraksha.db` |

### 3. Run

```bash
python start.py
```

This starts:

- **Backend** → `http://127.0.0.1:8000` (FastAPI)
- **Frontend** → `http://localhost:3000` (Next.js)

**Check status:**

```bash
python start.py --status
```

**Stop:**

```bash
python start.py --stop
```

Or press `Ctrl+C` in the terminal.

### 4. Open the app

Visit **http://localhost:3000** in your browser.

## LLM Support

The chatbot uses a **fallback chain** — it tries each provider in order:

| Priority | Provider         | Config                         |
| -------- | ---------------- | ------------------------------ |
| 1        | Local GGUF model | Place `.gguf` in `model/`      |
| 2        | Grok (xAI)       | Set `GROK_API_KEY` in `.env`   |
| 3        | Gemini (Google)  | Set `GEMINI_API_KEY` in `.env` |

If none are available, the bot falls back to retrieval-only mode (returns the top matching knowledge chunk verbatim).

### Local LLM

1. Download a GGUF model (e.g. from [Hugging Face](https://huggingface.co/models?search=gguf))
2. Place it in the `model/` folder at the project root
3. Restart the backend — it auto-detects the model

Recommended models (tested):

- `llama-3.2-1b-instruct-q4_k_m.gguf` — small, fast, decent quality
- `gemma-2-2b-it-Q4_K_M.gguf` — good for medical Q&A
- `qwen2.5-1.5b-instruct-q4_k_m.gguf` — strong instruct following

## Architecture

```
frontend/    Next.js app (TypeScript, Tailwind, shadcn/ui)
backend/     Python FastAPI (SQLite, scikit-learn RAG, optional LLM)
model/       Place GGUF models here (gitignored)
```

- **RAG pipeline:** TF-IDF vectorization (`scikit-learn`) over a curated medical knowledge base of snakebite info, myths, and first-aid guidance.
- **LLM generation:** Via local GGUF model or cloud API (Grok / Gemini).
- **Database:** SQLite by default (PostgreSQL + PostGIS documented in design docs for production).
- **SOS:** Dispatches alert to nearby responders via transactional outbox pattern.

## API Endpoints

| Endpoint            | Method   | Purpose                  |
| ------------------- | -------- | ------------------------ |
| `/api/health`       | GET      | Health check             |
| `/api/myth-buster`  | POST     | RAG chatbot query        |
| `/api/sos`          | POST     | Trigger SOS dispatch     |
| `/api/incidents`    | GET/POST | Snakebite incidents CRUD |
| `/api/hospitals`    | GET/POST | Hospital registry        |
| `/api/risk`         | GET/POST | Area risk reports        |
| `/api/snake-id`     | POST     | Snake identification     |
| `/api/stats`        | GET      | Dashboard statistics     |
| `/api/architecture` | GET      | System manifest          |
| `/api/ops`          | GET      | Operational endpoints    |

## Process Standards

- **Automated Commit Trigger**: Always propose or execute a git commit with a descriptive message as soon as CI/CD pipelines pass, a milestone/phase is completed, or a debug session (`gsd-debugger`) is completed and resolved.
- **Workflow & Test Synchronization**: Always ensure GitHub workflow files (`.github/workflows/`) are synchronized with the project structure and that all tests pass before completing a task.

## Project Status

Hackathon prototype. SQLite used for speed — production deployment should migrate to PostgreSQL + PostGIS (see [design docs](docs/)).
