"""Grok chatbot — conversational snakebite guidance for the emergency home.

Primary provider is Grok (xAI) via ``llm.grok_chat``. If the Grok API key is
missing or the call fails, we fall back to the generic LLM chain (local GGUF /
Groq / Grok / Gemini) and finally to a retrieval-only answer.

The endpoint also accepts an ``incident_id`` so the assistant can answer
"where is the ambulance?" from the live dispatch state, and a ``language``
(ISO 639-1) so replies — including the emergency guard — come back in the
user's language.
"""
from __future__ import annotations

import re

from fastapi import APIRouter
from ..models import ChatRequest
from ..llm import grok_chat, generate
from ..rag import EMERGENCY_RE, retrieve
from ..eventbus import audit
from .. import database as db

router = APIRouter()

CHAT_SYSTEM_PROMPT = """You are NagRaksha Mitra, a calm, clinically careful assistant helping people in India with snakes and snakebites. You are having a conversation — keep replies short, plain-language, and practical. Answer in under 130 words unless detail is explicitly requested.

HARD SAFETY RULES:
1. Never recommend folk remedies: cutting, sucking, tourniquets, ice, herbal pastes, or mantras.
2. Never claim certainty about a snake species from a description or photo.
3. Never recommend an antivenom dose — dosage is decided by a doctor at the hospital.
4. If the situation sounds like an active emergency, urge the person to trigger SOS and get to a hospital immediately — do not wait.
5. If the question is about a common myth, format the reply as "MYTH: ..." then "FACT: ...".

You may be given retrieved context from a reviewed knowledge base; use it when relevant, but you can also answer from your own knowledge with the same safety rules."""

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "kn": "Kannada",
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "or": "Odia",
    "ur": "Urdu",
}

EMERGENCY_REPLY = {
    "en": "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.",
    "hi": "यह आपात स्थिति लगती है। अभी SOS दबाएँ और अस्पताल जाएँ — इंतज़ार न करें। व्यक्ति को शांत और स्थिर रखें।",
    "kn": "ಇದು ತುರ್ತು ಪರಿಸ್ಥಿತಿ ಎಂದು ತೋರುತ್ತದೆ. ಈಗ SOS ಒತ್ತಿ ಆಸ್ಪತ್ರೆಗೆ ಹೋಗಿ — ಕಾಯಬೇಡಿ. ವ್ಯಕ್ತಿಯನ್ನು ಸ್ಥಿರವಾಗಿರಿಸಿ.",
    "ta": "இது அவசர நிலை போல் தெரிகிறது. இப்போதே SOS ஐ அழுத்தி மருத்துவமனைக்குச் செல்லுங்கள் — காத்திருக்க வேண்டாம். நபரை அசையாமல் வைத்திருங்கள்.",
    "te": "ఇది అత్యవసర పరిస్థితిలా ఉంది. ఇప్పుడే SOS నొక్కి ఆసుపత్రికి వెళ్లండి — వేచి ఉండకండి. వ్యక్తిని కదలకుండా ఉంచండి.",
    "ml": "ഇത് അടിയന്തരാവസ്ഥ പോലെ തോന്നുന്നു. ഉടൻ SOS അമർത്തി ആശുപത്രിയിലേക്ക് പോകുക — കാത്തിരിക്കരുത്. വ്യക്തിയെ സ്ഥിരമായി നിർത്തുക.",
    "bn": "এটা জরুরি অবস্থা বলে মনে হচ্ছে। এখনই SOS চাপুন এবং হাসপাতালে যান — অপেক্ষা করবেন না। ব্যক্তিকে স্থির রাখুন।",
    "mr": "हे आपत्कालीन परिस्थिती वाटते. आत्ताच SOS दाबा आणि रुग्णालयात जा — थांबू नका. व्यक्तीला स्थिर ठेवा.",
    "gu": "આ કટોકટી જેવું લાગે છે. હમણાં જ SOS દબાવો અને હોસ્પિટલ જાઓ — રાહ ન જુઓ. વ્યક્તિને સ્થિર રાખો.",
    "pa": "ਇਹ ਐਮਰਜੈਂਸੀ ਜਾਪਦਾ ਹੈ। ਹੁਣੇ SOS ਦਬਾਓ ਅਤੇ ਹਸਪਤਾਲ ਜਾਓ — ਉਡੀਕ ਨਾ ਕਰੋ। ਵਿਅਕਤੀ ਨੂੰ ਸਥਿਰ ਰੱਖੋ।",
}


def _load_dispatch_context(incident_id: str | None) -> str | None:
    """Build a live dispatch-status block for an incident, if it exists."""
    if not incident_id:
        return None
    try:
        with db.get_conn() as conn:
            inc = conn.execute("SELECT * FROM Incident WHERE id=?", (incident_id,)).fetchone()
            if not inc:
                return None
            inc = dict(inc)
            attempts = [
                dict(a) for a in conn.execute(
                    "SELECT * FROM DispatchAttempt WHERE incidentId=? "
                    "ORDER BY category ASC, sequence ASC",
                    (incident_id,),
                ).fetchall()
            ]
    except Exception:
        return None

    lines = [
        f"- Incident {inc['id']} — state: {inc.get('state') or 'PENDING'}",
        "- Victim location: "
        + (inc.get("address") or f"({inc.get('lat')}, {inc.get('lng')})"),
    ]
    for a in attempts:
        status = a.get("outcome") or "PENDING"
        eta = f", ETA {a['etaMin']} min" if a.get("etaMin") else ""
        dist = f", {a.get('distanceKm')} km away" if a.get("distanceKm") else ""
        accepted = f", accepted at {a['acceptedAt']}" if a.get("acceptedAt") else ""
        lines.append(
            f"- {a.get('category')} lane — {a.get('candidateName')} "
            f"({a.get('candidateRole')}): status {status}{eta}{dist}{accepted}"
        )
    return "\n".join(lines)


def _answer_from_live_status(block: str) -> str:
    """Structured fallback answer for dispatch-status questions (no LLM needed)."""
    lines = block.splitlines()
    ambulance = next((line for line in lines if "AMBULANCE" in line), None)
    hospital = next((line for line in lines if "HOSPITAL" in line), None)
    parts: list[str] = []
    if ambulance:
        parts.append(ambulance.strip())
    if hospital:
        parts.append(hospital.strip())
    if parts:
        return "Live dispatch status:\n" + "\n".join(parts)
    return "No ambulance has been dispatched yet. Trigger SOS to alert the nearest responders."


def _system_prompt(language: str | None, live_status: str | None) -> str:
    parts = [CHAT_SYSTEM_PROMPT]
    if live_status:
        parts.append(
            "\nLIVE DISPATCH STATUS (authoritative — use ONLY this when the user asks about the "
            "ambulance, responder, or hospital status):\n"
            f"{live_status}\n"
            "If asked \"where is the ambulance\", answer directly from this data: say which "
            "vehicle is en route, its ETA, and the destination hospital. If no ambulance lane "
            "exists, say clearly that no ambulance has been dispatched yet."
        )
    if language:
        lang_name = LANGUAGE_NAMES.get(language, language)
        parts.append(f"\nIMPORTANT: The user is speaking {lang_name}. Respond entirely in {lang_name}.")
    return "\n".join(parts)


@router.post("/api/chat")
def chat(body: ChatRequest):
    if not body.messages:
        return {
            "reply": "Ask me anything about snake safety, first aid, or common myths.",
            "emergency": False,
            "source": "fallback",
            "language": body.language or "en",
            "sources": [],
        }

    latest = body.messages[-1].content
    language = body.language or "en"
    live_status = _load_dispatch_context(body.incident_id)

    # Emergency guard — never let the model talk around an active emergency.
    if EMERGENCY_RE.search(latest):
        audit(incident_id=body.incident_id, actor="public", action="CHAT", entity="ChatThread",
              metadata={"emergency": True, "source": "guard", "language": language})
        return {
            "reply": EMERGENCY_REPLY.get(language, EMERGENCY_REPLY["en"]),
            "emergency": True,
            "source": "guard",
            "language": language,
            "sources": [],
        }

    history = [{"role": m.role, "content": m.content} for m in body.messages]
    retrieved = retrieve(latest, 5)
    sources = [
        {"docId": s["docId"], "title": s["title"], "category": s["category"]}
        for s in retrieved
    ]

    # 1. Grok (xAI) — the primary provider.
    reply = grok_chat(history, system_prompt=_system_prompt(language, live_status))
    source = "grok"

    # 2. Generic LLM chain fallback (GGUF → Groq → Grok → Gemini).
    if reply is None:
        reply = generate(latest, max_tokens=512,
                         system_prompt=_system_prompt(language, live_status))
        source = "llm-chain"

    # 2.5. Structured live-status answer for ambulance/dispatch questions.
    if reply is None and live_status and re.search(
        r"ambulance|vehicle|en route|dispatch|responder|hospital", latest, re.IGNORECASE
    ):
        reply = _answer_from_live_status(live_status)
        source = "live-status"

    # 3. Retrieval-only fallback from the reviewed knowledge base.
    if reply is None and retrieved:
        top = retrieved[0]
        reply = f"{top.get('title', '')}\n\n{top.get('content', '')}"
        source = "retrieval"

    # 4. Final canned fallback.
    if reply is None:
        reply = ("I can help with snake facts, first-aid do's and don'ts, and common myths. "
                 "If someone has been bitten, please tap SOS now — do not wait.")
        source = "fallback"

    audit(incident_id=body.incident_id, actor="public", action="CHAT", entity="ChatThread",
          metadata={"source": source, "emergency": False, "language": language})
    return {
        "reply": reply,
        "emergency": False,
        "source": source,
        "language": language,
        "sources": sources,
    }
