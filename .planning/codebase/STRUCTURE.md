# Codebase Structure

**Analysis Date:** 2026-07-27

## Directory & File Layout

```
Nagaraksha-/
├── backend/                       # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI app entry point & lifespan handler
│   │   ├── database.py            # SQLite DDL schema & connection manager
│   │   ├── domain.py              # Haversine, hospital ranking & dispatch simulation
│   │   ├── eventbus.py            # Outbox worker thread & SSE event bus
│   │   ├── llm.py                 # LLM fallback chain (GGUF → Grok → Gemini)
│   │   ├── models.py              # Pydantic validation schemas
│   │   ├── rag.py                 # RAG pipeline & TF-IDF cosine similarity search
│   │   ├── knowledge_base_data.py # Curated medical knowledge base (22 chunks)
│   │   ├── seed.py                # Database seeding script
│   │   └── routes/                # REST API routers
│   │       ├── sos.py             # SOS trigger endpoint
│   │       ├── incidents.py       # Incidents, symptoms & SSE stream
│   │       ├── hospitals.py       # Hospital rankings & stock updates
│   │       ├── risk.py            # Regional risk advisory
│   │       ├── snake_id.py        # Snake photo identification (CV)
│   │       ├── myth_buster.py     # AI Myth Buster RAG search
│   │       ├── stats.py           # Admin analytics totals & 14-day trend
│   │       └── ops.py             # Audit trail, outbox worker & corpus browser
│   ├── db/
│   │   └── nagraksha.db           # Durable SQLite database (WAL mode)
│   ├── tests/                     # Backend test suite (33 Pytest tests)
│   │   ├── test_domain.py
│   │   └── test_routes.py
│   └── requirements.txt           # Python backend dependencies
│
├── frontend/                      # Next.js 16 App Router PWA Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout (Metadata, Fonts, Dark Mode)
│   │   │   ├── page.tsx           # Main application PWA SPA shell
│   │   │   └── globals.css        # CSS Tokens & Google Fonts import
│   │   ├── components/
│   │   │   ├── sections.tsx       # TopAppBar, NavigationDrawer, SiteFooter
│   │   │   ├── interactive.tsx    # LiveSosDemo, MythBuster, HospitalStockConsole, etc.
│   │   │   ├── shader-background.tsx # WebGL fragment shader canvas
│   │   │   ├── snake-progress.tsx # Left rail serpentine progress bar
│   │   │   ├── tri-line-dock.tsx  # Floating dock navigation
│   │   │   └── ui/                # UI primitives (Button, Badge, Input, etc.)
│   │   ├── lib/
│   │   │   ├── api.ts             # API helper & URL builder
│   │   │   ├── nagraksha.ts       # Frontend domain helpers & math utilities
│   │   │   └── __tests__/         # Frontend test suite (16 Vitest tests)
│   │   │       ├── eventbus.test.ts
│   │   │       └── nagraksha.test.ts
│   │   └── hooks/
│   │       └── use-scroll.ts      # In-view & scroll tracking hooks
│   ├── next.config.ts             # Relative `/api` rewrite proxy config
│   ├── package.json               # Node.js dependencies & scripts
│   └── vitest.config.ts           # Vitest runner configuration
│
├── docs/                          # PRD, SRS, System Design, Brand & Pitch docs
├── setup.py                       # Automated 5-step installer & configuration script
├── start.py                       # Dev process launcher, health checker & status CLI
├── README.md                      # Comprehensive developer setup guide
└── worklog.md                     # Development session timeline
```

## Key File Locations

- **Launcher & Installer:** `setup.py`, `start.py`
- **Frontend Entry:** `frontend/src/app/page.tsx`
- **Frontend Layout:** `frontend/src/app/layout.tsx`
- **Backend Entry:** `backend/app/main.py`
- **API Proxy Config:** `frontend/next.config.ts`
- **Backend Unit Tests:** `backend/tests/` (33 tests)
- **Frontend Unit Tests:** `frontend/src/lib/__tests__/` (16 tests)

---

*Updated: 2026-07-27*
