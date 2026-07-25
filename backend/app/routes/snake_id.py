"""Snake ID (CV-style) route — FR-6.1, FR-6.2."""
from __future__ import annotations

import random
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


@router.post("/api/snake-id")
def identify(body: SnakeIdRequest):
    picked = random.choice(CATALOGUE)
    if body.text:
        t = body.text.lower()
        if "hood" in t or "cobra" in t:
            picked = CATALOGUE[0]
        elif "russell" in t or "viper" in t:
            picked = CATALOGUE[1]
        elif "saw" in t or "scales" in t:
            picked = CATALOGUE[2]
        elif "krait" in t:
            picked = CATALOGUE[3]
        elif "rat snake" in t or "non" in t:
            picked = CATALOGUE[4]
    return {
        "species": picked["species"], "venom": picked["venom"],
        "confidence": picked["confidence"], "habitat": picked["habitat"],
        "firstAid": picked["firstAid"], "danger": picked["danger"],
        "note": "Identification is uncertain. Do NOT delay medical care based on this result.",
        "source": "mock",
        "disclaimer": "This is an assistive identification, not a medical diagnosis. If someone has been bitten, trigger SOS and get to a hospital — do not wait for a confirmed ID.",
    }
