"""Local + cloud LLM module.

Fallback chain (tried in order until one succeeds):
  1. Local GGUF model from model/ folder (via llama-cpp-python)
  2. Grok API (xAI) — requires GROK_API_KEY in .env
  3. Gemini API (Google) — requires GEMINI_API_KEY in .env

If none are available/working, generate() returns None and the
caller (rag.py) falls back to retrieval-only mode.
"""
from __future__ import annotations

import glob
import os
import threading
from pathlib import Path

import httpx

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "model"

_lock = threading.Lock()
_model = None
_model_path = None


# ── helpers ──────────────────────────────────────────────────────────

def _env(key: str) -> str | None:
    return os.environ.get(key)


def _trim(text: str) -> str:
    return text.strip()


# ── local GGUF ───────────────────────────────────────────────────────

def _find_model() -> str | None:
    ggufs = glob.glob(os.path.join(MODEL_DIR, "*.gguf"))
    return ggufs[0] if ggufs else None


def _load_gguf():
    global _model, _model_path
    path = _find_model()
    if not path:
        _model = None
        _model_path = None
        return
    if _model is not None and _model_path == path:
        return
    from llama_cpp import Llama
    _model = Llama(model_path=path, verbose=False)
    _model_path = path


def _generate_gguf(prompt: str, max_tokens: int, temperature: float) -> str | None:
    global _model
    with _lock:
        if _model is None:
            _load_gguf()
        if _model is None:
            return None
        try:
            result = _model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=0.9,
                stop=["</s>", "\n\n\n"],
                echo=False,
            )
            text = result.get("choices", [{}])[0].get("text", "").strip()
            return text if text else None
        except (RuntimeError, ValueError, KeyError, IndexError):
            return None


# ── Groq (Groq Inc.) ──────────────────────────────────────────────────

def _generate_groq(system: str, user: str, max_tokens: int, temperature: float) -> str | None:
    key = _env("GROQ_API_KEY")
    if not key:
        return None
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user})
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _trim(text) if text else None
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        return None


# ── Grok (xAI) ────────────────────────────────────────────────────────

def _generate_grok(system: str, user: str, max_tokens: int, temperature: float) -> str | None:
    key = _env("GROK_API_KEY")
    if not key:
        return None
    try:
        resp = httpx.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "grok-2-latest",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _trim(text) if text else None
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        return None


def grok_chat(
    messages: list[dict],
    max_tokens: int = 512,
    temperature: float = 0.7,
    *,
    system_prompt: str = "",
) -> str | None:
    """Conversational completion via Grok (xAI) only.

    ``messages`` is a list of ``{"role": "user"|"assistant", "content": str}``
    dicts representing prior turns. Returns None when the API key is
    missing or the call fails — callers fall back gracefully.
    """
    key = _env("GROK_API_KEY")
    if not key:
        return None
    try:
        payload: list[dict] = []
        if system_prompt:
            payload.append({"role": "system", "content": system_prompt})
        for m in messages[-12:]:  # keep long conversations bounded
            payload.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        resp = httpx.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "grok-2-latest",
                "messages": payload,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _trim(text) if text else None
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        return None


# ── Gemini (Google) ──────────────────────────────────────────────────

def _generate_gemini(system: str, user: str, max_tokens: int, temperature: float) -> str | None:
    key = _env("GEMINI_API_KEY")
    if not key:
        return None
    try:
        resp = httpx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            headers={"Content-Type": "application/json", "X-Goog-Api-Key": key},
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"{system}\n\nUser question: {user}"}],
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": max_tokens,
                    "temperature": temperature,
                },
            },
            timeout=60,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return None
        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        return _trim(text) if text else None
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        return None



# ── public API ───────────────────────────────────────────────────────

def generate(
    prompt: str,
    max_tokens: int = 512,
    temperature: float = 0.7,
    *,
    system_prompt: str = "",
) -> str | None:
    """Generate text trying local GGUF → Groq → Grok → Gemini in order.

    ``prompt`` is the user message.  ``system_prompt`` is the system
    instruction (only used by cloud providers; the local GGUF model
    receives it concatenated).

    Returns None if every provider fails/absent — callers always fall
    back to retrieval-only mode.
    """
    # 1. Local GGUF
    if _find_model():
        full = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        out = _generate_gguf(full, max_tokens, temperature)
        if out is not None:
            return out

    # 2. Groq
    if _env("GROQ_API_KEY"):
        out = _generate_groq(system_prompt, prompt, max_tokens, temperature)
        if out is not None:
            return out

    # 3. Grok
    if _env("GROK_API_KEY"):
        out = _generate_grok(system_prompt, prompt, max_tokens, temperature)
        if out is not None:
            return out

    # 4. Gemini
    if _env("GEMINI_API_KEY"):
        out = _generate_gemini(system_prompt, prompt, max_tokens, temperature)
        if out is not None:
            return out

    return None


def is_available() -> bool:
    """Check if ANY LLM provider is available (local model file or API key)."""
    return bool(
        _find_model()
        or _env("GROQ_API_KEY")
        or _env("GROK_API_KEY")
        or _env("GEMINI_API_KEY")
    )


WOUND_ANALYSIS_PROMPT = """\
You are a clinical AI assisting snakebite first responders.
Analyze this wound photograph taken after a reported snakebite.
The pixel measurement system detected approximately {area_px} discolored pixels
out of a 640x480 frame ({pct:.1f}% of image area).

Return ONLY a JSON object with exactly these fields, no markdown, no explanation:
{{"severity_score": <integer 0-100>, "progression": "<rapid|moderate|slow|insufficient_data>", "estimated_venom_spread_cm": <float>, "recommended_antivenom_vials": <integer 1-10>, "notes": "<one clinical observation>"}}

Base your assessment on: wound discoloration extent visible in the image, estimated tissue involvement.
Do NOT guess species. Focus purely on observable envenomation severity.
"""


async def analyze_wound_image(img_b64: str, swelling_area_px: int) -> dict:
    """Call Gemini Vision to score wound severity. Returns structured dict."""
    import json as _json
    key = _env("GEMINI_API_KEY")
    total_px = 640 * 480
    pct = (swelling_area_px / total_px) * 100
    prompt = WOUND_ANALYSIS_PROMPT.format(area_px=swelling_area_px, pct=pct)

    fallback = {
        "severity_score": min(100, round(pct * 4)),
        "progression": "insufficient_data",
        "estimated_venom_spread_cm": round(pct * 0.3, 1),
        "recommended_antivenom_vials": max(1, min(10, round(pct / 10))),
        "notes": "Pixel-based estimate only — Gemini Vision unavailable.",
    }

    if not key:
        return fallback

    try:
        import httpx as _httpx
        resp = _httpx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            headers={"Content-Type": "application/json", "X-Goog-Api-Key": key},
            json={
                "contents": [{
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
                    ],
                }],
                "generationConfig": {"maxOutputTokens": 256, "temperature": 0.1},
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return fallback
        candidates = resp.json().get("candidates", [])
        if not candidates:
            return fallback
        raw = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        # strip possible markdown fences
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return _json.loads(raw)
    except (httpx.HTTPError, ValueError, KeyError, IndexError, _json.JSONDecodeError):
        return fallback


