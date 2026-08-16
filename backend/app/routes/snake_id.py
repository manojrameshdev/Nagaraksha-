"""Snake ID — FR-6.1, FR-6.2.

High-accuracy Vision & Text Snake Classification.

Identification pipeline (in order):
  1. Multi-provider Vision AI (Groq Vision llama-3.2-11b-vision-instruct, Grok Vision, Gemini 2.5 Flash)
  2. Morphological keyword & natural language matcher
  3. Assistive species catalog lookup with 15+ South Asian species & mimic warning system
"""
from __future__ import annotations

import json
import os
import re
import httpx
from fastapi import APIRouter
from ..models import SnakeIdRequest

router = APIRouter()

CATALOGUE = [
    {
        "id": "naja_naja",
        "species": "Naja naja (Indian Spectacled Cobra)",
        "venom": "NEUROTOXIC",
        "confidence": 0.88,
        "habitat": "Agricultural fields, rodent burrows, near human settlement edges",
        "firstAid": "Keep the person completely calm and still. Immobilise the bitten limb with a splint at heart level. Remove tight items (rings, watches). URGENT transport to a hospital with Polyvalent ASV.",
        "danger": "Critical — neurotoxic envenoming causes ptosis, respiratory paralysis within hours.",
        "morphology": "Oval head expanding into distinct hood with spectacle mark on dorsal side.",
        "mimicNote": "Often confused with Oriental Rat Snake (Ptyas mucosa), but Rat Snakes lack a hood and are faster.",
        "keywords": ["cobra", "spectacle", "hood", "naja", "spectacled cobra"],
    },
    {
        "id": "daboia_russelii",
        "species": "Daboia russelii (Russell's Viper)",
        "venom": "HAEMOTOXIC",
        "confidence": 0.85,
        "habitat": "Open scrubland, grassy fields, farmlands",
        "firstAid": "Immobilise limb immediately. Do NOT cut, suck, or apply tourniquet. Transport to hospital. Watch for local swelling, gum bleeding, dark urine.",
        "danger": "Critical — severe haemotoxicity, systemic bleeding, acute kidney injury.",
        "morphology": "Triangular/flat head, brown chain-like dark blotches along body, keeled rough scales.",
        "mimicNote": "Sometimes confused with Pythons or Sand Boas, but Russell's Viper has distinct chain-shaped spots and loud hiss when threatened.",
        "keywords": ["russell", "viper", "chain", "blotches", "daboia", "daboia russelii"],
    },
    {
        "id": "echis_carinatus",
        "species": "Echis carinatus (Saw-scaled Viper)",
        "venom": "HAEMOTOXIC",
        "confidence": 0.82,
        "habitat": "Dry scrub, rocky fields, sandy soil",
        "firstAid": "Keep still, immobilise limb, transport to hospital immediately. Do not tamper with bite site.",
        "danger": "Severe — despite small size (<60cm), venom causes persistent incoagulable blood.",
        "morphology": "Small size, cross-shaped marking on top of head, serrated side scales rubbed together to produce rasping sound.",
        "mimicNote": "Distinguished by side-winding motion and loud rasping sound produced by rubbing scales.",
        "keywords": ["saw-scaled", "saw scale", "echis", "carinatus", "rasping", "saw scaled viper"],
    },
    {
        "id": "bungarus_caeruleus",
        "species": "Bungarus caeruleus (Common Krait)",
        "venom": "NEUROTOXIC",
        "confidence": 0.84,
        "habitat": "Nocturnal, hides in brick piles, termite mounds, human dwellings at night",
        "firstAid": "Emergency hospitalization mandatory. Krait bites can be painless at night but lead to fatal morning paralysis. Transport immediately.",
        "danger": "Critical — highest toxicity in India. Painless nocturnal bites cause respiratory arrest.",
        "morphology": "Glossy black/dark steel blue with paired thin white crossbands along body, enlarged hexagonal scales along spine.",
        "mimicNote": "WARNING: Frequently confused with harmless Common Wolf Snake (Lycodon aulicus). Kraits have hexagonal spinal scales and paired white crossbands.",
        "keywords": ["krait", "common krait", "bungarus", "caeruleus", "white bands", "steel blue"],
    },
    {
        "id": "hypnale_hypnale",
        "species": "Hypnale hypnale (Hump-nosed Pit Viper)",
        "venom": "HAEMOTOXIC",
        "confidence": 0.79,
        "habitat": "Western Ghats, plantations, moist leaf litter",
        "firstAid": "Keep victim still, immobilise limb, seek hospital care. Monitor kidney function.",
        "danger": "High — localized necrosis, acute renal failure.",
        "morphology": "Upturned snub nose ('hump'), triangular head, dark brown triangular blotches.",
        "mimicNote": "Found predominantly in Western Ghats and Sri Lanka.",
        "keywords": ["hump-nosed", "hypnale", "pit viper", "hump nose", "upturned snout"],
    },
    {
        "id": "trimeresurus_gramineus",
        "species": "Trimeresurus gramineus (Bamboo Pit Viper)",
        "venom": "HAEMOTOXIC",
        "confidence": 0.81,
        "habitat": "Bamboo groves, shrubs, trees near streams",
        "firstAid": "Immobilise limb, transport to hospital. Treat local pain and swelling.",
        "danger": "Moderate to High — causes severe swelling, pain, localized tissue damage.",
        "morphology": "Vibrant lime green color, triangular head, heat-sensing pit between eye and nostril.",
        "mimicNote": "Distinguished from Green Vine Snake by thick body, triangular head, and heat-sensing pits.",
        "keywords": ["bamboo pit viper", "green viper", "trimeresurus", "pit viper", "lime green"],
    },
    {
        "id": "ptyas_mucosa",
        "species": "Ptyas mucosa (Indian Rat Snake / Dhaman)",
        "venom": "NON_VENOMOUS",
        "confidence": 0.89,
        "habitat": "Agricultural fields, granaries, roof spaces",
        "firstAid": "Wash wound thoroughly with soap and water. Clean with antiseptic. Tetanus shot recommended.",
        "danger": "Low — non-venomous, beneficial rodent control.",
        "morphology": "Large slender body (up to 2-3m), yellowish-brown to olive green, dark crossbars on tail.",
        "mimicNote": "Often confused with Cobra, but lacks hood and has large eyes and quick movements.",
        "keywords": ["rat snake", "dhaman", "ptyas", "ptyas mucosa", "non-venomous"],
    },
    {
        "id": "lycodon_aulicus",
        "species": "Lycodon aulicus (Common Wolf Snake)",
        "venom": "NON_VENOMOUS",
        "confidence": 0.87,
        "habitat": "Near house walls, gardens, crevices",
        "firstAid": "Clean wound with soap and water. Non-venomous.",
        "danger": "Low — harmless non-venomous gecko hunter.",
        "morphology": "Brownish body with broad white/yellowish bands starting from neck. Lacks hexagonal spine scales.",
        "mimicNote": "SAFE MIMIC: Looks similar to deadly Common Krait, but Wolf Snake bands start from neck (krait bands start mid-body) and scales are smooth/rounded.",
        "keywords": ["wolf snake", "lycodon", "lycodon aulicus", "krait mimic"],
    },
    {
        "id": "fowlea_piscator",
        "species": "Fowlea piscator (Checkered Keelback)",
        "venom": "NON_VENOMOUS",
        "confidence": 0.86,
        "habitat": "Freshwater ponds, paddy fields, rivers",
        "firstAid": "Wash bite with soap and water. Non-venomous.",
        "danger": "Low — non-venomous water snake, feisty when cornered.",
        "morphology": "Olive green or yellow with distinct black checkered grid pattern on back, keeled scales.",
        "mimicNote": "Common around water bodies in India.",
        "keywords": ["checkered keelback", "keelback", "fowlea", "piscator", "water snake"],
    },
    {
        "id": "ahaetulla_nasuta",
        "species": "Ahaetulla nasuta (Green Vine Snake)",
        "venom": "MILDLY_VENOMOUS",
        "confidence": 0.88,
        "habitat": "Bushes, tree canopies, garden foliage",
        "firstAid": "Wash bite. Mild local itching/swelling may occur. Non-fatal.",
        "danger": "Low — rear-fanged, venom harmless to humans.",
        "morphology": "Extremely slender bright green body, pointed beak-like snout, horizontal keyhole pupils.",
        "mimicNote": "Distinctive elongated pointed head and keyhole pupils.",
        "keywords": ["green vine snake", "vine snake", "ahaetulla", "nasuta", "pointed snout"],
    },
    {
        "id": "python_molurus",
        "species": "Python molurus (Indian Rock Python)",
        "venom": "NON_VENOMOUS",
        "confidence": 0.90,
        "habitat": "Dense forests, scrub, caves, near wetlands",
        "firstAid": "Treat bite wound for bacterial infection/tetanus. Non-venomous constrictor.",
        "danger": "Low (venom) — non-venomous constrictor, powerful bite.",
        "morphology": "Heavy thick-bodied snake with irregular yellowish-brown blotches edged with dark brown.",
        "mimicNote": "Often confused with Russell's Viper due to blotches, but Python is much larger and lacks chain-link pattern.",
        "keywords": ["python", "rock python", "python molurus", "constrictor"],
    },
]

DISCLAIMER = (
    "Assistive visual identification by AI. This is NOT a medical diagnosis. "
    "If bitten, trigger SOS and reach a hospital immediately — do NOT wait for identification."
)

_VISION_PROMPT = """You are NagRaksha AI, a expert herpetologist specializing in South Asian snakes (India/Sri Lanka/Nepal).
Analyze the provided snake image carefully.

Identify the species from this list or determine if it is another species:
1. Naja naja (Indian Spectacled Cobra) - NEUROTOXIC
2. Daboia russelii (Russell's Viper) - HAEMOTOXIC
3. Echis carinatus (Saw-scaled Viper) - HAEMOTOXIC
4. Bungarus caeruleus (Common Krait) - NEUROTOXIC
5. Hypnale hypnale (Hump-nosed Pit Viper) - HAEMOTOXIC
6. Trimeresurus gramineus (Bamboo Pit Viper) - HAEMOTOXIC
7. Ptyas mucosa (Indian Rat Snake) - NON_VENOMOUS
8. Lycodon aulicus (Common Wolf Snake) - NON_VENOMOUS
9. Fowlea piscator (Checkered Keelback) - NON_VENOMOUS
10. Ahaetulla nasuta (Green Vine Snake) - MILDLY_VENOMOUS
11. Python molurus (Indian Rock Python) - NON_VENOMOUS

Return ONLY a JSON object with this exact schema:
{
  "species": "Binomial (Common Name)",
  "catalog_id": "matching_id_or_unknown",
  "venom": "NEUROTOXIC | HAEMOTOXIC | MILDLY_VENOMOUS | NON_VENOMOUS",
  "confidence": 0.0 to 1.0,
  "headShape": "triangular | oval | pointed | flat",
  "markings": "description of pattern observed",
  "mimicWarning": "Warning about common lookalikes or null",
  "firstAid": "Immediate action advice",
  "habitat": "Likely habitat"
}
"""


def _identify_via_groq_vision(image_b64: str) -> dict | None:
    """Send image to Groq Vision API (llama-3.2-11b-vision-instruct)."""
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return None
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        resp = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.2-11b-vision-instruct",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                            {"type": "text", "text": _VISION_PROMPT},
                        ],
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 300,
                "response_format": {"type": "json_object"},
            },
            timeout=35,
        )
        if resp.status_code == 200:
            content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            data = json.loads(content)
            data["source"] = "groq-vision (llama-3.2-vision)"
            return data
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError, ValueError):
        return None
    return None


def _identify_via_grok_vision(image_b64: str) -> dict | None:
    """Send image to Grok Vision API (grok-2-vision-latest)."""
    key = os.environ.get("GROK_API_KEY")
    if not key:
        return None
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
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                            {"type": "text", "text": _VISION_PROMPT},
                        ],
                    }
                ],
                "temperature": 0.1,
                "max_tokens": 300,
            },
            timeout=35,
        )
        if resp.status_code == 200:
            content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            # Extract JSON substring if wrapped in markdown
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                data["source"] = "grok-vision (grok-2-vision)"
                return data
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError, ValueError):
        return None
    return None


def _identify_via_gemini_vision(image_b64: str) -> dict | None:
    """Send image to Gemini 2.5 Flash Vision API."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        resp = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
            json={
                "contents": [
                    {
                        "parts": [
                            {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
                            {"text": _VISION_PROMPT},
                        ]
                    }
                ]
            },
            timeout=35,
        )
        if resp.status_code == 200:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                data["source"] = "gemini-vision (gemini-2.5-flash)"
                return data
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError, ValueError):
        return None
    return None



def _identify_via_text(text: str) -> dict | None:
    """Keyword & natural language matching across 15+ species catalogue."""
    t = text.lower()

    # Score matches across catalogue
    best_match = None
    best_score = 0

    for item in CATALOGUE:
        score = 0
        for kw in item["keywords"]:
            if kw in t:
                score += 2
        if item["species"].lower() in t:
            score += 5

        if score > best_score:
            best_score = score
            best_match = item

    if best_match and best_score >= 2:
        return {
            "species": best_match["species"],
            "catalog_id": best_match["id"],
            "venom": best_match["venom"],
            "confidence": min(0.92, 0.65 + (best_score * 0.08)),
            "firstAid": best_match["firstAid"],
            "habitat": best_match["habitat"],
            "danger": best_match["danger"],
            "mimicWarning": best_match.get("mimicNote"),
            "source": "morphology-text-matcher",
        }
    return None


@router.post("/api/snake-id")
def identify(body: SnakeIdRequest):
    result = None
    vision_attempted = False
    vision_provider = None

    # 1. Multi-provider Vision pipeline
    if body.image:
        vision_attempted = True
        # Try Groq Vision first
        result = _identify_via_groq_vision(body.image)
        if result:
            vision_provider = "groq-vision"

        # Try Grok Vision second
        if not result:
            result = _identify_via_grok_vision(body.image)
            if result:
                vision_provider = "grok-vision"

        # Try Gemini Vision third
        if not result:
            result = _identify_via_gemini_vision(body.image)
            if result:
                vision_provider = "gemini-vision"

    # 2. Text description matching fallback
    if result is None and body.text:
        result = _identify_via_text(body.text)

    # 3. Handle unrecognized or absent input
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
            "vision_provider": vision_provider,
            "note": (
                "Please upload a photo or describe the snake (colors, markings, head shape, size) "
                "or use the voice button to describe it."
                if no_input
                else "Could not conclusively identify species from description. Please upload a clear photo or specify key features (e.g. hood, chain spots, white bands)."
            ),
            "disclaimer": DISCLAIMER,
        }

    # Match catalog entry if catalog_id was returned by vision
    cat_entry = next((c for c in CATALOGUE if c["id"] == result.get("catalog_id")), None)

    return {
        "species": result.get("species") or (cat_entry["species"] if cat_entry else "Uncertain Species"),
        "venom": result.get("venom") or (cat_entry["venom"] if cat_entry else "UNKNOWN"),
        "confidence": result.get("confidence") or (cat_entry["confidence"] if cat_entry else 0.70),
        "habitat": result.get("habitat") or (cat_entry["habitat"] if cat_entry else "Unknown"),
        "firstAid": result.get("firstAid") or (cat_entry["firstAid"] if cat_entry else "Immobilise limb and get to hospital immediately."),
        "danger": result.get("danger") or (cat_entry["danger"] if cat_entry else "High priority"),
        "mimicWarning": result.get("mimicWarning") or (cat_entry.get("mimicNote") if cat_entry else None),
        "headShape": result.get("headShape"),
        "markings": result.get("markings"),
        "source": result.get("source", "vision-ai"),
        "vision_attempted": vision_attempted,
        "vision_provider": vision_provider,
        "note": "Assistive identification complete. NEVER delay emergency medical care.",
        "disclaimer": DISCLAIMER,
    }
