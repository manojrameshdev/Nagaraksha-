"""Snake ID — FR-6.1, FR-6.2.

Identification chain (in order):
  1. If image (base64) is provided and GROK_API_KEY is set → Grok Vision (grok-2-vision-latest)
  2. If text is provided → deterministic keyword matching against CATALOGUE
  3. Otherwise → prompt user to describe the snake (no random guess)
"""
from __future__ import annotations

import os
import httpx
from fastapi import APIRouter
from ..models import SnakeIdRequest

router = APIRouter()

CATALOGUE = [
    {"species": "Naja naja (Indian Cobra)", "venom": "NEUROTOXIC", "confidence": 0.82,
     "habitat": "Fields, rodent burrows, near human settlement edges",
     "firstAid": "Keep the person still and calm, immobilise the bitten limb with a splint at heart level, remove rings/watches, transport to hospital immediately. Do not cut, suck, or apply tourniquets.",
     "danger": "High — neurotoxic envenoming can progress within hours."},
    {"species": "Daboia russelii (Russell's Viper)", "venom": "HAEMOTOXIC", "confidence": 0.78,
     "habitat": "Open scrub, agricultural fields, rodent-rich areas",
     "firstAid": "Keep still, immobilise the limb, do not apply ice or tourniquet, transport to a hospital with antivenom. Watch for swelling, bleeding gums, low urine output.",
     "danger": "Severe — can cause bleeding and kidney injury."},
    {"species": "Echis carinatus (Saw-scaled Viper)", "venom": "HAEMOTOXIC", "confidence": 0.71,
     "habitat": "Dry scrub, sandy soil, dry crop fields",
     "firstAid": "Keep still and calm, immobilise the limb, transport to hospital. Do not cut the wound.",
     "danger": "Severe despite small size — haemotoxic envenoming."},
    {"species": "Bungarus caeruleus (Common Krait)", "venom": "NEUROTOXIC", "confidence": 0.69,
     "habitat": "Hides near termite mounds, rodent burrows; nocturnal",
     "firstAid": "Keep the person still — krait bites may be painless but life-threatening. Immobilise and transport urgently. Watch for drooping eyelids, abdominal pain.",
     "danger": "Severe — painless bite, delayed neurotoxicity."},
    {"species": "Ptyas mucosa (Oriental Rat Snake)", "venom": "NON_VENOMOUS", "confidence": 0.86,
     "habitat": "Near fields, granaries, water — fast-moving, large",
     "firstAid": "Non-venomous but clean any bite wound with soap and water. Still seek medical review for tetanus risk.",
     "danger": "Low — non-venomous, defensive bite only."},
]

DISCLAIMER = (
    "This is an assistive identification, not a medical diagnosis. "
    "If someone has been bitten, trigger SOS and get to a hospital — do not wait for a confirmed ID."
)

_GROK_VISION_PROMPT = (
    "You are a snake identification assistant for NagRaksha, an emergency snakebite response app in India. "
    "Look at the snake in the image. Identify which of these five species it most likely is, or say 'unknown':\n"
    "1. Naja naja (Indian Cobra) — NEUROTOXIC\n"
    "2. Daboia russelii (Russell's Viper) — HAEMOTOXIC\n"
    "3. Echis carinatus (Saw-scaled Viper) — HAEMOTOXIC\n"
    "4. Bungarus caeruleus (Common Krait) — NEUROTOXIC\n"
    "5. Ptyas mucosa (Oriental Rat Snake) — NON_VENOMOUS\n\n"
    "Reply with ONLY the species number (1-5) or 'unknown'. Do not add any explanation."
)


def _identify_via_grok_vision(image_b64: str) -> dict | None:
    """Send image to Grok Vision API. Returns a CATALOGUE entry or None on failure."""
    key = os.environ.get("GROK_API_KEY")
    if not key:
        return None
    # Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    try:
        resp = httpx.post(
            "https://api.x.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "grok-2-vision-latest",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "high"}},
                            {"type": "text", "text": _GROK_VISION_PROMPT},
                        ],
                    }
                ],
                "max_tokens": 10,
                "temperature": 0.0,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            return None
        reply = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        # Parse the single-digit reply
        idx_map = {"1": 0, "2": 1, "3": 2, "4": 3, "5": 4}
        if reply in idx_map:
            entry = dict(CATALOGUE[idx_map[reply]])  # nosec B311
            entry["confidence"] = 0.75  # vision model — moderate confidence
            entry["source"] = "grok-vision"
            return entry
        return None
    except Exception:
        return None


def _identify_via_text(text: str) -> dict | None:
    """Deterministic keyword match against common descriptors. Returns CATALOGUE entry or None."""
    t = text.lower()
    if "hood" in t or "cobra" in t or "naja" in t or "spectacled" in t:
        return {**CATALOGUE[0], "source": "keyword"}
    if "russell" in t or ("viper" in t and "saw" not in t):
        return {**CATALOGUE[1], "source": "keyword"}
    if "saw" in t or "echis" in t or "carinatus" in t:
        return {**CATALOGUE[2], "source": "keyword"}
    if "krait" in t or "bungarus" in t:
        return {**CATALOGUE[3], "source": "keyword"}
    if "rat snake" in t or "ptyas" in t or "non-venomous" in t or "nonvenomous" in t:
        return {**CATALOGUE[4], "source": "keyword"}
    return None


@router.post("/api/snake-id")
def identify(body: SnakeIdRequest):
    result = None
    vision_attempted = False

    # 1. Vision (image + Grok key)
    if body.image and os.environ.get("GROK_API_KEY"):
        vision_attempted = True
        result = _identify_via_grok_vision(body.image)

    # 2. Text keyword matching
    if result is None and body.text:
        result = _identify_via_text(body.text)

    # 3. No usable input — guide the user instead of guessing
    if result is None:
        no_input = not body.image and not body.text
        return {
            "species": None,
            "venom": None,
            "confidence": None,
            "firstAid": None,
            "danger": None,
            "source": "none",
            "vision_attempted": vision_attempted,
            "note": (
                "Please describe the snake (colour, markings, size, head shape) in the text box "
                "so we can give you a better identification."
                if no_input else
                "Could not match the snake from your description. Try adding more details: "
                "colour, hood, banding pattern, approximate size."
            ),
            "disclaimer": DISCLAIMER,
        }

    return {
        "species": result["species"],
        "venom": result["venom"],
        "confidence": result["confidence"],
        "habitat": result["habitat"],
        "firstAid": result["firstAid"],
        "danger": result["danger"],
        "source": result.get("source", "keyword"),
        "vision_attempted": vision_attempted,
        "note": "Identification is uncertain. Do NOT delay medical care based on this result.",
        "disclaimer": DISCLAIMER,
    }

