# ARCHITECTURE.md — System Architecture

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## High-Level Architecture

```
Browser (React PWA)
    │
    │  HTTP + SSE (via ?XTransformPort=8000)
    ▼
Caddy Gateway (AntiGravity IDE)
    │
    ├──▶ Next.js Frontend (:3000)   — pages, components, PWA service worker
    │
    └──▶ FastAPI Backend (:8000)    — SOS, RAG, hospitals, snake ID, audit
              │
              ├── SQLite DB (backend/db/nagraksha.db)
              ├── Outbox Worker (background daemon thread)
              ├── In-process Event Bus (threading.Lock + subscribers)
              └── LLM Module (GGUF → Grok → Gemini → retrieval-only)
```

---

## Backend Architecture

### Transactional Outbox Pattern

The SOS flow implements a textbook transactional outbox:

```
POST /api/sos
  → DB transaction:
      INSERT Incident (state=DISPATCHING)
      INSERT OutboxEvent (type=IncidentCreated, state=PENDING)
  → Background worker polls every 2.5s
  → Worker picks up IncidentCreated
  → Fans out 3 parallel dispatch lanes
  → Emits SSE events per lane via in-process bus
  → Advances incident state: DISPATCHING → ACCEPTED → TRANSPORTING → HANDED_OFF
```

The outbox has retry logic: attempts counter increments on failure, FAILED state after 4 attempts. This ensures at-least-once delivery even if the dispatch handler throws.

### Three-Lane Dispatch Model

```
IncidentCreated
   ├── TRAINED lane   (Anjali M., Ravi K.)
   ├── RESCUE lane    (Bannerghatta Rescue Cell, Urban Wildlife Rescue)
   └── AMBULANCE lane (Ambulance 108 BLR-South, BLR-Rural)
```

Each lane fires independently in `_handle_incident_created`. First candidate in each lane "accepts" after a simulated delay (6–15s). State transitions drive SSE events.

> ⚠️ Dispatch candidates are currently simulated in `domain.py:simulate_dispatch()`. Real responder registry integration is a future milestone.

### RAG Pipeline

```
User question
  ↓
Emergency regex guard (bitten|swelling|bleeding…) → hard-coded emergency reply
  ↓
TF-IDF retrieval (scikit-learn cosine similarity, bigrams, sublinear_tf)
  ↓  top-4 chunks, MYTH/FIRST_AID category boosted
LLM generation: GGUF → Grok grok-2-latest → Gemini → retrieval-only fallback
  ↓
Response: answer + sources + mythFlagged + source label
```

### Hospital Ranking Algorithm (FR-4.2)

Score formula (descending = best):
```
CONFIRMED stock: 100 - (etaMin × 0.6)
LOW stock:        55 - (etaMin × 0.6)
UNKNOWN stock:    30 - (etaMin × 0.5)
STALE confirmed: score -= 35
OUT of stock:      5 - (etaMin × 0.2)
```

Distance: Haversine straight-line × 1.32 road factor. Speed: 42 km/h >25km, 26 km/h short.

### Snake ID Classification Chain

```
POST /api/snake-id { image, text }
  ↓
1. image + GROK_API_KEY? → Grok Vision (grok-2-vision-latest)
   Returns single digit 1-5 → CATALOGUE[idx]
  ↓
2. text provided? → Deterministic keyword match (cobra/hood/viper/krait/rat snake)
  ↓
3. Neither? → Guidance message "Please describe the snake"
   (no random.choice — eliminated)
```

---

## Frontend Architecture

### Pages & Routing

Single-page application. One route: `/` (`app/page.tsx`). Role switching via `activeRole` state:

```
activeRole:
  'sos'       → GPS banner + RiskPanel + LiveSosDemo + quick-action cards
  'responder' → Responder Dashboard (incident queue)
  'hospital'  → HospitalStockConsole + AuditTrailPanel
  'myth'      → MythBuster (RAG chat)
  'snake_id'  → SnakeId (Grok Vision + text)
  'admin'     → StatsStrip + OutboxPanel + ArchitectureDisplay
```

### Component Hierarchy

```
page.tsx (Page)
  ├── ShaderBackground        [memo] WebGL fragment shader animation
  ├── TopAppBar               [memo] Header + role switcher
  ├── NavigationDrawer        [memo] Slide-out drawer
  │
  ├── GPS Banner              (inline, driven by useGeolocation hook)
  ├── RiskPanel               fetches /api/risk with real GPS coords
  ├── LiveSosDemo             SSE stream, 3-lane dispatch view, hospital ranking
  ├── SnakeId                 Grok Vision + text keyword ID
  ├── MythBuster              RAG chat UI
  ├── HospitalStockConsole    Stock PATCH + hospital list
  ├── StatsStrip              /api/stats bar chart
  ├── AuditTrailPanel         /api/audit timeline
  ├── OutboxPanel             /api/ops/outbox live view
  ├── SymptomLogger           Symptom observation form
  └── SiteFooter              [memo]
```

### Data Flow

```
useGeolocation hook
  → lat/lng/source/label
  → passed as props to: RiskPanel, LiveSosDemo
  → LiveSosDemo passes coords in POST /api/sos body
  → RiskPanel appends ?lat=&lng= to GET /api/risk
```

SSE connection lifecycle:
```
trigger() → POST /api/sos → streamUrl in response
  → new EventSource(streamUrl)
  → events: snapshot, dispatch_attempted, dispatch_accepted, incident_state
  → closeStream() on HANDED_OFF or component unmount
```

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Python backend + Next.js frontend (not pure Next.js) | System design requirement: demonstrate outbox pattern, SSE, real DB layer |
| SQLite not Postgres | Hackathon / demo mode; `NAGRAKSHA_DB` env var allows Postgres path |
| In-process event bus | No Redis/Kafka dependency; daemonthread handles dispatch; good enough for single-instance |
| TF-IDF not vector DB | Zero infrastructure; scikit-learn is already a dependency; works offline |
| Grok Vision over file upload | No CV model deployment; API call is instant; gracefully falls back to text |
| `?XTransformPort=8000` | AntiGravity IDE gateway convention; keeps all API calls relative |
| `navigator.geolocation` in hook | Encapsulates browser API; provides typed fallback; prevents prop drilling |
