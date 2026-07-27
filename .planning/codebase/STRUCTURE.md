# STRUCTURE.md — Codebase Directory Structure

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## Monorepo Root

```
Nagaraksha-/
├── .agents/                  # Workspace-scoped agent rules (AGENTS.md)
├── .github/workflows/ci.yml  # GitHub Actions CI pipeline
├── .husky/                   # Pre-commit hooks (prettier + eslint)
├── .planning/                # GSD planning directory
│   ├── codebase/             # This codebase map (7 docs)
│   ├── debug/                # Debug session logs
│   ├── phases/               # Phase plans
│   ├── research/             # Research docs
│   ├── PROJECT.md            # Project charter
│   ├── REQUIREMENTS.md       # Functional requirements
│   ├── ROADMAP.md            # Milestone + phase roadmap
│   ├── MILESTONES.md         # Milestone tracker
│   ├── STATE.md              # Current GSD state
│   └── config.json           # GSD configuration
├── backend/                  # Python FastAPI backend
├── frontend/                 # Next.js 16 frontend
├── model/                    # GGUF model directory (empty — optional)
├── docs/                     # Additional documentation
├── scripts/                  # Utility scripts
├── .env                      # API keys + DB config (gitignored)
├── .env.example              # Template for .env
├── .bandit.yaml              # Bandit security config
├── .prettierrc               # Prettier config
├── package.json              # Root-level lint-staged + husky setup
├── setup.py                  # Python environment setup helper
├── start.py                  # Dev launcher (starts both services)
└── worklog.md                # Development work log
```

---

## Backend Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI app init, router mounting, startup
│   ├── database.py           # SQLite layer: schema, get_conn, new_id, now_iso
│   ├── models.py             # Pydantic request models (SosRequest, etc.)
│   ├── domain.py             # Haversine, road ETA, hospital ranking, dispatch sim
│   ├── eventbus.py           # Outbox worker, in-process bus, audit logger
│   ├── llm.py                # LLM fallback chain: GGUF → Grok → Gemini
│   ├── rag.py                # TF-IDF retrieval + RAG answer pipeline
│   ├── seed.py               # Demo data seeder (hospitals, risks, KB)
│   ├── knowledge_base_data.py # 22 curated KB chunks (myths, first aid, species)
│   └── routes/
│       ├── __init__.py
│       ├── sos.py            # POST /api/sos — incident creation + outbox
│       ├── incidents.py      # GET /api/incidents/:id, SSE stream, audit
│       ├── hospitals.py      # GET /api/hospitals, PATCH stock
│       ├── risk.py           # GET /api/risk — nearest risk report
│       ├── snake_id.py       # POST /api/snake-id — Grok Vision + keyword
│       ├── myth_buster.py    # POST /api/myth-buster — RAG answer
│       ├── stats.py          # GET /api/stats — totals + 14-day trend
│       ├── ops.py            # GET /api/ops/outbox, /audit (admin)
│       └── architecture.py   # GET /api/architecture — system design JSON
├── db/
│   └── nagraksha.db          # SQLite database file (gitignored)
└── tests/
    ├── conftest.py           # Test fixtures (temp DB, mock worker, seeded hospital)
    ├── test_routes.py        # Route integration tests (async httpx ASGI)
    └── test_domain.py        # Unit tests for domain helpers
```

---

## Frontend Structure

```
frontend/
├── public/                   # Static assets, PWA manifest, icons
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout: fonts, theme, toaster, SW registration
│   │   ├── page.tsx          # Main page: role router + GPS banner + views
│   │   └── globals.css       # Global CSS vars, dark theme, animations
│   ├── components/
│   │   ├── ui/               # Radix-based shadcn/ui primitives (Button, Badge, etc.)
│   │   ├── interactive.tsx   # All live data widgets:
│   │   │                     #   LiveSosDemo, RiskPanel, SnakeId, MythBuster,
│   │   │                     #   StatsStrip, AuditTrailPanel, OutboxPanel,
│   │   │                     #   HospitalStockConsole, SymptomLogger,
│   │   │                     #   KnowledgeBasePanel
│   │   ├── sections.tsx      # TopAppBar, NavigationDrawer, SiteFooter (memo)
│   │   ├── architecture.tsx  # System architecture diagram component
│   │   ├── shader-background.tsx  # WebGL fragment shader (memo)
│   │   ├── lazy-sections.tsx # Dynamic import wrappers for heavy sections
│   │   ├── reveal.tsx        # Scroll-reveal animation wrapper
│   │   ├── snake-progress.tsx # Animated snake-themed progress bar
│   │   ├── slither-sprite.tsx # CSS snake animation sprite
│   │   └── tri-line-dock.tsx  # Three-line navigation dock
│   ├── hooks/
│   │   ├── use-geolocation.ts # GPS hook with Bannerghatta fallback [NEW]
│   │   ├── use-scroll.ts     # InView + scroll position hooks
│   │   ├── use-mobile.ts     # Responsive breakpoint hook
│   │   └── use-toast.ts      # Sonner toast bridge
│   ├── lib/
│   │   ├── api.ts            # apiUrl() helper — appends ?XTransformPort=8000
│   │   └── utils.ts          # cn() class merge utility
│   └── test/
│       └── *.test.tsx        # Vitest component tests
├── next.config.ts            # Next.js config (standalone output, SW config)
├── tailwind.config.ts        # Tailwind v4 config
├── tsconfig.json             # TypeScript strict config
├── vitest.config.ts          # Vitest config with jsdom
└── eslint.config.mjs         # ESLint flat config (next + security plugin)
```

---

## Entry Points

| Entry Point | Path | Purpose |
|------------|------|---------|
| Dev launcher | `start.py` | Starts backend (uvicorn) + frontend (next dev) together |
| Backend app | `backend/app/main.py` | FastAPI app, mounted routers, startup events |
| Frontend app | `frontend/src/app/layout.tsx` | Root Next.js layout, SW registration (prod only) |
| Main page | `frontend/src/app/page.tsx` | All role-based views, GPS hook, component tree |
| API helper | `frontend/src/lib/api.ts` | `apiUrl()` for all fetch calls |
