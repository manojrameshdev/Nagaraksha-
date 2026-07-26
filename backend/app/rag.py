"""NagRaksha RAG layer (Python).

Retrieval: scikit-learn TF-IDF + cosine similarity over the curated
KnowledgeChunk corpus. Generation: local GGUF model from model/ folder
(via llama-cpp-python), with retrieval-only fallback if no model present.
"""
from __future__ import annotations

import re
import threading
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

from . import database as db
from .llm import generate, is_available
from .knowledge_base_data import CHUNKS as KB_SEED

# ---- index (built once, rebuilt on corpus change) ----
_index_lock = threading.Lock()
_index = {"chunks": [], "vectorizer": None, "matrix": None, "count": -1}


def _load_chunks():
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, docId, title, category, content, tags FROM KnowledgeChunk ORDER BY docId"
        ).fetchall()
    return [dict(r) for r in rows]


def _build_index():
    chunks = _load_chunks()
    if not chunks:
        return
    docs = [f"{c['title']} {c['tags'] or ''} {c['content']}" for c in chunks]
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    matrix = vec.fit_transform(docs)
    _index["chunks"] = chunks
    _index["vectorizer"] = vec
    _index["matrix"] = matrix
    _index["count"] = len(chunks)


def _ensure_index():
    with _index_lock:
        with db.get_conn() as conn:
            count = conn.execute("SELECT COUNT(*) as c FROM KnowledgeChunk").fetchone()["c"]
        if _index["count"] != count:
            _build_index()


def retrieve(query: str, k: int = 4):
    """Return the top-k most relevant chunks for a natural-language query."""
    _ensure_index()
    if not _index["chunks"]:
        return []
    vec = _index["vectorizer"]
    matrix = _index["matrix"]
    q_vec = vec.transform([query])
    sims = cosine_similarity(q_vec, matrix)[0]
    # category boosts: MYTH + FIRST_AID get a small lift to break ties
    boosts = []
    for i, c in enumerate(_index["chunks"]):
        b = 1.0
        if c["category"] == "MYTH":
            b = 1.08
        elif c["category"] == "FIRST_AID":
            b = 1.06
        boosts.append(b)
    sims_adj = sims * np.array(boosts)
    top = np.argsort(sims_adj)[::-1][:k]
    results = []
    for i in top:
        if sims_adj[i] <= 0:
            continue
        c = _index["chunks"][i]
        results.append({
            "id": c["id"], "docId": c["docId"], "title": c["title"],
            "category": c["category"], "content": c["content"],
            "score": round(float(sims_adj[i]), 3),
        })
    return results


EMERGENCY_RE = re.compile(
    r"bitten|bit me|bite (now|just)|snake just|symptom|swelling|bleeding|can't breathe|"
    r"cannot breathe|unconscious|dying|now help|help now|emergency",
    re.IGNORECASE,
)


SYSTEM_PROMPT = """You are NagRaksha Mitra, a calm, clinically careful assistant answering questions about snakes and snakebites in India.

You are given a RETRIEVED KNOWLEDGE BASE below. It is curated and medically reviewed. Answer the user's question using ONLY this retrieved context. If the retrieved context does not contain the answer, say plainly that you do not have reviewed information on that, and suggest they reach a hospital or trigger SOS.

BRAND VOICE:
- Calm urgency. Clinical clarity. Rural accessibility.
- Short, plain-language answers. No jargon, no panic, no false reassurance.
- "SOS sent. Looking for responders." not "Everything will be okay."

SAFETY (hard rules):
1. Never recommend folk remedies: cutting, sucking, tourniquets, ice, herbal pastes, mantras.
2. Never claim certainty about a snake species from a description or photo.
3. Never recommend an antivenom dose — dosage is decided by a doctor at the hospital.
4. If the question sounds like an active emergency, reply ONLY: "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still." Then stop.
5. Keep the answer under 130 words unless detail is explicitly requested.

If the user's question is about a common myth, begin with "MYTH: " then the myth, then "FACT: " then the corrected guidance.
Cite sources at the end as: "Sources: docId1, docId2" — using only the docIds you actually used.

RETRIEVED KNOWLEDGE BASE:
{context}"""


def rag_answer(question: str):
    """RAG pipeline: retrieve → generate with local LLM → fallback chain."""
    retrieved = retrieve(question, 4)

    if EMERGENCY_RE.search(question):
        return {
            "answer": "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.",
            "sources": retrieved,
            "source": "guard",
        }

    if is_available():
        context_block = "\n\n".join(
            f"[{i+1}] ({r['category']}) {r['title']}\n    {r['content']}\n    — source: {r['docId']}"
            for i, r in enumerate(retrieved)
        ) or "(no relevant chunks retrieved)"

        system_prompt = SYSTEM_PROMPT.format(context=context_block)
        llm = generate(question, max_tokens=512, system_prompt=system_prompt)

        if llm:
            return {"answer": llm, "sources": retrieved, "source": "rag-llm"}

    # fallback: return top retrieved chunk verbatim
    if retrieved:
        top = retrieved[0]
        return {
            "answer": f"{top['title']}\n\n{top['content']}\n\nSources: {top['docId']}",
            "sources": retrieved,
            "source": "rag-retrieval-only",
        }

    return {
        "answer": "I'm NagRaksha Mitra. I can help with snake facts, first-aid do's and don'ts, and common myths. If someone has been bitten, please tap SOS now — do not wait.",
        "sources": [],
        "source": "fallback",
    }


def ensure_kb_seeded():
    """Seed the knowledge base from the curated corpus if empty."""
    with db.get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM KnowledgeChunk").fetchone()["c"]
    if count > 0:
        return
    now = db.now_iso()
    with db.get_conn() as conn:
        for c in KB_SEED:
            conn.execute(
                "INSERT INTO KnowledgeChunk (id, docId, title, category, content, tags, reviewedBy, reviewedAt, createdAt) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (db.new_id(), c["docId"], c["title"], c["category"], c["content"], c["tags"],
                 "NagRaksha medical review", now, now),
            )
