# INTEGRATIONS.md — External Integrations

_Last refreshed: 2026-07-27 by gsd-map-codebase_

## Summary

NagRaksha integrates with three external services, all configured via `.env` at the project root. All API calls are made server-side from the Python backend; the frontend never calls external APIs directly.

---

## 1. Grok API (xAI) — PRIMARY LLM + VISION

**Purpose**: Powers the Myth-Buster RAG (`/api/myth-buster`) and Snake ID Vision (`/api/snake-id`)

| Field | Value |
|-------|-------|
| Base URL | `https://api.x.ai/v1/chat/completions` |
| Auth | `Authorization: Bearer <GROK_API_KEY>` |
| Text model | `grok-2-latest` |
| Vision model | `grok-2-vision-latest` |
| Env var | `GROK_API_KEY` |
| Status | ✅ Configured in `.env` |
| Timeout | 60s (text), 30s (vision) |

### Usage Points
- **`/api/myth-buster`**: RAG pipeline sends retrieved KB chunks + user question to `grok-2-latest`
- **`/api/snake-id`** (image input): Base64 image sent to `grok-2-vision-latest` with constrained prompt → returns species number 1-5

### Vision Prompt Strategy
The vision call uses a constrained prompt asking Grok to return only a single digit (1–5) or "unknown". This prevents hallucinated free-text and allows deterministic CATALOGUE lookup.

---

## 2. Gemini API (Google) — SECONDARY LLM FALLBACK

**Purpose**: Fallback LLM if Grok is unavailable

| Field | Value |
|-------|-------|
| Base URL | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` |
| Auth | `?key=<GEMINI_API_KEY>` |
| Model | `gemini-2.0-flash` |
| Env var | `GEMINI_API_KEY` |
| Status | ⚠️ Not configured (commented out in `.env`) |
| Timeout | 60s |

---

## 3. Browser Geolocation API — FRONTEND

**Purpose**: Get user's real GPS coordinates for SOS dispatch and risk advisory

| Field | Value |
|-------|-------|
| API | `navigator.geolocation.getCurrentPosition()` |
| Timeout | 8 seconds |
| Max age | 30 seconds |
| Accuracy | High accuracy enabled |
| Fallback | `lat: 12.8003, lng: 77.5954` (Bannerghatta Forest Edge) |
| Source | `frontend/src/hooks/use-geolocation.ts` |

### Fallback Behavior
- GPS granted → real coordinates passed to `LiveSosDemo` and `RiskPanel`
- GPS denied/timeout → Bannerghatta defaults; UI shows amber "Default location" banner
- Not supported → same fallback; `error` state set

---

## 4. Local GGUF Model — OPTIONAL LOCAL LLM

**Purpose**: Offline-capable LLM inference (highest priority in fallback chain)

| Field | Value |
|-------|-------|
| Location | `model/*.gguf` (auto-detected) |
| Library | llama-cpp-python ≥ 0.3 |
| Status | ⚠️ Not present (no .gguf in `model/`) |

---

## API Gateway (Internal)

All frontend → backend calls go through the AntiGravity IDE Caddy gateway:

```
Frontend (Next.js :3000) → Caddy → ?XTransformPort=8000 → FastAPI (:8000)
```

The `apiUrl()` helper in `frontend/src/lib/api.ts` appends `?XTransformPort=8000` to every relative API path. **No hardcoded `http://localhost:8000` URLs exist** in frontend code.

---

## Integration Status Summary

| Integration | Required | Configured | Fallback |
|------------|---------|------------|---------|
| Grok (text) | Yes (RAG) | ✅ | Retrieval-only mode |
| Grok (vision) | No (snake ID photo) | ✅ | Text keyword match |
| Gemini | No | ❌ | Skipped |
| Local GGUF | No | ❌ | Skipped |
| Browser GPS | No | Runtime | Bannerghatta defaults |
