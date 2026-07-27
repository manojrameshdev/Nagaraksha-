# System Architecture

**Analysis Date:** 2026-07-27

## Pattern Overview

**Overall:** Modular monolith with an event-driven core and PWA frontend shell.

NagRaksha is designed as a two-tier emergency system consisting of a Next.js 16 App Router PWA frontend and a Python 3.12/3.13 FastAPI event-driven backend.

### Key Architectural Characteristics

1. **Next.js API Proxy Rewrite:** In development, Next.js (`frontend/next.config.ts`) proxies `/api/:path*` directly to FastAPI on `http://127.0.0.1:8000/api/:path*`, unifying API communication without CORS configuration issues.
2. **WebGL Organic Shader Canvas:** Visual background layer rendered via WebGL fragment shader (`frontend/src/components/shader-background.tsx`), wrapped in CSS glassmorphism overlay tokens (`#051710` Midnight, `#184D36` Forest Green).
3. **Role & View Switcher:** Mobile-friendly `TopAppBar` and `NavigationDrawer` ([sections.tsx](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/src/components/sections.tsx)) enabling role switching across Victim SOS, First Responder, Hospital Inventory, AI Myth Buster, Snake Photo ID, and Admin Analytics.
4. **Durable Transactional Outbox Pattern:** `OutboxEvent` table in SQLite written in the same transaction as `Incident` creation. Background worker thread polls every 2.5s and fans out 3 dispatch lanes (Trained First Responder, Rescue Team, Ambulance).
5. **Real-time SSE Stream:** Server-Sent Events emitted at `GET /api/incidents/{id}/stream` delivering live state changes (`snapshot`, `dispatch_attempted`, `dispatch_accepted`, `incident_state`).
6. **Antivenom-Aware Hospital Ranking:** Dijkstra travel-time combined with stock freshness scoring (CONFIRMED > LOW > UNKNOWN > STALE > OUT).
7. **Grounded Medical RAG Pipeline:** TF-IDF cosine similarity search over 22 curated medical chunks with emergency regex guard.

## System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Web / PWA Client                           │
│                                                                        │
│  [TopAppBar] ── [NavigationDrawer] ── [Role View Switcher]             │
│                                                                        │
│  ├── 1. Victim SOS View (Hold-to-trigger button & SSE Dispatch Stream) │
│  ├── 2. First Responder View (Active Alert, Symptom Logger)            │
│  ├── 3. Hospital Console (Antivenom Stock Manager, Dijkstra Ranking)   │
│  ├── 4. AI Myth Buster (RAG Chatbot + Grounded Citations)              │
│  ├── 5. Snake Photo ID (CV Species Classification + Disclaimers)       │
│  └── 6. Admin Analytics (Platform Stats, Outbox Worker, Audit Trail)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ relative /api/* requests
                                   ▼
                       Next.js Rewrite Proxy (3000)
                                   │
                                   ▼
                      FastAPI Backend Engine (8000)
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  RAG Engine  │            │ Outbox Engine│            │ Hospital Rank│
│ TF-IDF + LLM │            │ Event Poller │            │ Dijkstra+Stock│
└──────────────┘            └──────────────┘            └──────────────┘
       │                           │                           │
       └───────────────────────────┼───────────────────────────┘
                                   ▼
                        SQLite Database (WAL)
                      backend/db/nagraksha.db
```

## Layers

### 1. Client Layer (PWA Frontend)
- **Path:** `frontend/src/app/`, `frontend/src/components/`, `frontend/src/lib/`
- **Key Components:**
  - `page.tsx`: Main SPA entry point handling role view switching (`'sos'`, `'responder'`, `'hospital'`, `'myth'`, `'snake_id'`, `'admin'`).
  - `sections.tsx`: Implements `TopAppBar`, `NavigationDrawer`, and `SiteFooter`.
  - `interactive.tsx`: Implements `LiveSosDemo`, `MythBuster`, `HospitalStockConsole`, `SymptomLogger`, `SnakeIdUpload`, `StatsStrip`, `AuditTrailPanel`, `OutboxPanel`, and `KnowledgeBasePanel`.
  - `shader-background.tsx`: WebGL scale fragment shader.

### 2. API & Routing Layer (FastAPI Backend)
- **Path:** `backend/app/main.py`, `backend/app/routes/`
- **Modules:** `sos.py`, `incidents.py`, `hospitals.py`, `risk.py`, `snake_id.py`, `myth_buster.py`, `stats.py`, `ops.py`.

### 3. Domain Logic & Data Model Layer
- **Path:** `backend/app/`
- **Modules:**
  - `domain.py`: Geo formulas (`haversine_km`, `road_km`), hospital ranking (`rank_hospitals`), dispatch simulation.
  - `rag.py`: TF-IDF vectorizer + cosine similarity search over `KnowledgeChunk`.
  - `llm.py`: Multi-tier fallback chain (Local GGUF → Grok → Gemini).
  - `eventbus.py`: Transactional outbox worker and audit logger.
  - `database.py`: SQLite connection management with WAL mode.

---

*Updated: 2026-07-27*
