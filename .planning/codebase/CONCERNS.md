# Codebase Concerns & Known Limitations

**Analysis Date:** 2026-07-27

## Resolved Issues & Upgrades

1. **Next.js `/api` Connection Rewrite:** Fixed client fetch failures by adding `async rewrites()` in `frontend/next.config.ts` mapping relative `/api/*` calls to `http://127.0.0.1:8000/api/*`.
2. **Automated Testing Suite:** Implemented 49 unit and integration tests across backend (`pytest backend/tests`, 33 tests passing) and frontend (`vitest`, 16 tests passing).
3. **Automated Setup & Process Management:** Created `setup.py` (5-step installer) and `start.py` (process launcher with `--status` and health polling).
4. **Pre-Commit Code Quality Gates:** Configured Husky pre-commit hooks enforcing Prettier formatting and ESLint rules.

---

## Technical Debt & Feature Gaps

### 1. Snake Photo Identification (CV Mock)
- **Location:** `backend/app/routes/snake_id.py`
- **Current State:** Returns species classification, venom severity, confidence, and medical disclaimers based on text/keyword input rather than a live PyTorch/TensorFlow CNN model.
- **Impact:** Disclaimer (*"Do NOT delay medical care based on photo classification"*) is clearly displayed to prevent improper user reliance.

### 2. Multi-Tier LLM Fallback Chain
- **Location:** `backend/app/llm.py`
- **Current State:** Local GGUF models (`model/*.gguf`) are optional. If unavailable, the system falls back to Grok (xAI) API, Gemini (Google) API, or grounded RAG medical chunks directly.

### 3. Road-Graph Routing vs Haversine Formula
- **Location:** `backend/app/domain.py`
- **Current State:** Calculates travel times using Haversine distance multiplied by a rural road network winding factor (1.3x).

---

*Updated: 2026-07-27*
