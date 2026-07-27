# External & Internal Integrations

**Analysis Date:** 2026-07-27

## Next.js API Rewrite Proxy Gateway

In local development, the Next.js frontend (port 3000) proxies relative `/api/*` HTTP requests directly to the FastAPI backend (port 8000).

- **Configuration:** [frontend/next.config.ts](file:///c:/Users/OM%20Prakash/Documents/Nagaraksha-/frontend/next.config.ts)
```typescript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://127.0.0.1:8000/api/:path*',
    },
  ];
}
```
- **Benefit:** Eliminates CORS issues in browser fetch calls, allowing seamless relative `fetch('/api/...')` execution across client components.

## Internal REST API Endpoints

### 1. Incident Lifecycle & Dispatch (`/api/incidents`)
- `POST /api/incidents/dispatch`: Creates a new victim SOS incident, appends `IncidentCreated` event to outbox, and starts 3-lane dispatch fan-out (Trained First Responder, Rescue Team, Ambulance).
- `GET /api/incidents/{id}`: Fetches current incident status, assigned candidates, and Dijkstra hospital rankings.
- `GET /api/incidents/{id}/stream`: Server-Sent Events (SSE) live-state stream emitting `snapshot`, `dispatch_attempted`, `dispatch_accepted`, and `incident_state`.
- `POST /api/incidents/{id}/symptoms`: Logs structured symptom observations (fang marks, swelling, ptosis, pain, bite location) for pre-arrival hospital transmission.

### 2. Hospital & Antivenom Inventory (`/api/hospitals`)
- `GET /api/hospitals?lat={lat}&lng={lng}`: Evaluates Dijkstra shortest travel time + stock freshness penalty to produce antivenom-aware hospital ranking.
- `POST /api/hospitals/{id}/stock`: Doctors and emergency staff update antivenom availability (`CONFIRMED`, `LOW`, `OUT`) with timestamp verification.

### 3. AI Myth Buster RAG (`/api/myth-buster`)
- `POST /api/myth-buster`: Queries the 22-chunk medical RAG vector store using TF-IDF cosine similarity. Returns grounded first-aid answers, myth flag badges, and doc ID source citations.

### 4. Risk & Advisory (`/api/risk`)
- `GET /api/risk?lat={lat}&lng={lng}`: Returns regional monsoon risk level, advisory score (0-100), active species activity (Russell's Viper, Spectacled Cobra), and safety tips.

### 5. Snake Photo ID (`/api/snake-id`)
- `POST /api/snake-id`: Accepts uploaded photos or textual descriptions to provide species classification confidence, venom severity, and medical disclaimers.

### 6. Analytics & Audit (`/api/stats`, `/api/audit`, `/api/outbox`)
- `GET /api/stats`: Returns platform incident totals, active hospitals, RAG chunks, and 14-day trend metrics.
- `GET /api/audit`: Returns immutable audit trail event logs (`SOS_TRIGGERED`, `DISPATCH_FANOUT`, `RESPONDER_ACCEPTED`, `STOCK_UPDATED`, `RAG_QUERY`).
- `GET /api/outbox`: Returns state of the transactional outbox worker (processed, pending, failed queue metrics).

## External LLM Providers & Fallback Chain

Implemented in `backend/app/llm.py`:

1. **Local GGUF Model:** Local CPU inference via `llama-cpp-python` (`model/*.gguf`).
2. **Grok (xAI) API:** Primary online fallback (`https://api.x.ai/v1/chat/completions`) via `GROK_API_KEY`.
3. **Gemini (Google) API:** Secondary online fallback (`https://generativelanguage.googleapis.com/v1beta/...`) via `GEMINI_API_KEY`.
4. **TF-IDF RAG Grounded Fallback:** If LLM keys are absent, returns the highest-scoring medical RAG chunk directly.

## Event / Message Bus & Outbox Pattern

- **Database Table:** `OutboxEvent` in SQLite (`backend/db/nagraksha.db`).
- **Worker Thread:** Background loop drains pending outbox events every 2.5s, triggering subscribers and emitting events over SSE streams.
- **Event Types:** `IncidentCreated`, `DispatchAttempted`, `DispatchAccepted`, `IncidentStateChanged`, `StockUpdated`.

---

*Updated: 2026-07-27*
