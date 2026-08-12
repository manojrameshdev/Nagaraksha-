"""ChromaDB RAG — replaces scikit-learn TF-IDF.

Uses ChromaDB's DefaultEmbeddingFunction (ONNX-based, no PyTorch dependency,
~40MB, fast cold start) for semantic retrieval over the curated knowledge base.

Same public API as the old rag.py: retrieve(), rag_answer(), ensure_kb_seeded().
"""
from __future__ import annotations

import re
import threading
from pathlib import Path

from . import database as db
from .llm import generate, is_available
from .knowledge_base_data import CHUNKS as KB_SEED

_DB_PATH = str(Path(__file__).resolve().parent.parent / "chroma_db")

_lock = threading.Lock()
_client = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is not None:
        return _collection
    with _lock:
        if _collection is not None:
            return _collection
        try:
            import chromadb
            from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

            _client = chromadb.PersistentClient(path=_DB_PATH)
            _collection = _client.get_or_create_collection(
                name="nagraksha_kb",
                embedding_function=DefaultEmbeddingFunction(),
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as e:
            print(f"[RAG] ChromaDB unavailable ({e}), using fallback retrieval")
            _collection = None
    return _collection


# ── fallback TF-IDF (used if ChromaDB is not installed) ──────────────

_tfidf_index: dict = {"chunks": [], "vectorizer": None, "matrix": None, "count": -1}
_tfidf_lock = threading.Lock()


def _ensure_tfidf_index():
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT id, docId, title, category, content, tags FROM KnowledgeChunk ORDER BY docId"
        ).fetchall()
    chunks = [dict(r) for r in rows]
    if not chunks:
        return
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        docs = [f"{c['title']} {c['tags'] or ''} {c['content']}" for c in chunks]
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        matrix = vec.fit_transform(docs)
        with _tfidf_lock:
            _tfidf_index["chunks"] = chunks
            _tfidf_index["vectorizer"] = vec
            _tfidf_index["matrix"] = matrix
            _tfidf_index["count"] = len(chunks)
    except ImportError:
        with _tfidf_lock:
            _tfidf_index["chunks"] = chunks
            _tfidf_index["count"] = len(chunks)


def _retrieve_tfidf(query: str, k: int) -> list[dict]:
    import numpy as np
    _ensure_tfidf_index()
    chunks = _tfidf_index.get("chunks", [])
    vec = _tfidf_index.get("vectorizer")
    matrix = _tfidf_index.get("matrix")
    if not chunks or vec is None or matrix is None:
        # pure text match fallback
        q_lower = query.lower()
        results = []
        for c in chunks[:k]:
            if q_lower in (c.get("content") or "").lower() or q_lower in (c.get("title") or "").lower():
                results.append({**c, "score": 0.5})
        return results[:k]
    from sklearn.metrics.pairwise import cosine_similarity
    q_vec = vec.transform([query])
    sims = cosine_similarity(q_vec, matrix)[0]
    boosts = [1.08 if c["category"] == "MYTH" else 1.06 if c["category"] == "FIRST_AID" else 1.0
              for c in chunks]
    sims_adj = sims * np.array(boosts)
    top = np.argsort(sims_adj)[::-1][:k]
    return [
        {**chunks[i], "score": round(float(sims_adj[i]), 3)}
        for i in top if sims_adj[i] > 0
    ]


# ── public retrieval API ──────────────────────────────────────────────

def retrieve(query: str, k: int = 5) -> list[dict]:
    """Semantic retrieval. Returns top-k chunks. Falls back to TF-IDF if ChromaDB unavailable."""
    col = _get_collection()
    if col is not None:
        try:
            results = col.query(query_texts=[query], n_results=k)
            docs = results["documents"][0]
            dists = results["distances"][0]
            metas = results["metadatas"][0]
            ids = results["ids"][0]
            return [
                {
                    "id": rid, "text": doc,
                    "score": round(1.0 - dist, 3),
                    "source": meta.get("source", "nagraksha_kb"),
                    "category": meta.get("category", "GENERAL"),
                    "title": meta.get("title", ""),
                    "docId": meta.get("docId", rid),
                    "content": doc,
                }
                for rid, doc, dist, meta in zip(ids, docs, dists, metas)
            ]
        except Exception as e:
            print(f"[RAG] ChromaDB query failed ({e}), using TF-IDF fallback")
    return _retrieve_tfidf(query, k)


def seed_kb(chunks: list[dict]):
    """Seed ChromaDB knowledge base. Idempotent — skips existing IDs."""
    col = _get_collection()
    if col is None:
        return  # ChromaDB not available; SQLite fallback used
    try:
        existing = set(col.get()["ids"])
        new_chunks = [c for c in chunks if c.get("id") and c["id"] not in existing]
        if not new_chunks:
            return
        col.add(
            ids=[c["id"] for c in new_chunks],
            documents=[f"{c.get('title','')} {c.get('content','')}".strip() for c in new_chunks],
            metadatas=[{
                "source": c.get("source", "nagraksha_kb"),
                "category": c.get("category", "GENERAL"),
                "title": c.get("title", ""),
                "docId": c.get("docId", c["id"]),
            } for c in new_chunks],
        )
        print(f"[RAG] Seeded {len(new_chunks)} chunks into ChromaDB")
    except Exception as e:
        print(f"[RAG] ChromaDB seed failed ({e})")


# ── RAG pipeline ──────────────────────────────────────────────────────

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
- \"SOS sent. Looking for responders.\" not \"Everything will be okay.\"

SAFETY (hard rules):
1. Never recommend folk remedies: cutting, sucking, tourniquets, ice, herbal pastes, mantras.
2. Never claim certainty about a snake species from a description or photo.
3. Never recommend an antivenom dose — dosage is decided by a doctor at the hospital.
4. If the question sounds like an active emergency, reply ONLY: \"This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.\" Then stop.
5. Keep the answer under 130 words unless detail is explicitly requested.

If the user's question is about a common myth, begin with \"MYTH: \" then the myth, then \"FACT: \" then the corrected guidance.
Cite sources at the end as: \"Sources: docId1, docId2\" — using only the docIds you actually used.

RETRIEVED KNOWLEDGE BASE:
{context}"""


def rag_answer(question: str) -> dict:
    """RAG pipeline: retrieve → generate with cloud LLM → fallback chain."""
    retrieved = retrieve(question, 5)

    if EMERGENCY_RE.search(question):
        return {
            "answer": "This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.",
            "sources": retrieved,
            "source": "guard",
        }

    if is_available():
        context_block = "\n\n".join(
            f"[{i+1}] ({r.get('category','?')}) {r.get('title','')}\n    {r.get('content','')}\n    — source: {r.get('docId','')}"
            for i, r in enumerate(retrieved)
        ) or "(no relevant chunks retrieved)"

        system_prompt = SYSTEM_PROMPT.format(context=context_block)
        llm = generate(question, max_tokens=512, system_prompt=system_prompt)

        if llm:
            return {"answer": llm, "sources": retrieved, "source": "rag-llm-chromadb"}

    # fallback: return top retrieved chunk verbatim
    if retrieved:
        top = retrieved[0]
        return {
            "answer": f"{top.get('title','')}\n\n{top.get('content','')}\n\nSources: {top.get('docId','')}",
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
    # 1. Seed SQLite (for TF-IDF fallback)
    with db.get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM KnowledgeChunk").fetchone()["c"]
    if count == 0:
        now = db.now_iso()
        with db.get_conn() as conn:
            for c in KB_SEED:
                conn.execute(
                    "INSERT INTO KnowledgeChunk (id, docId, title, category, content, tags, reviewedBy, reviewedAt, createdAt) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (db.new_id(), c["docId"], c["title"], c["category"], c["content"], c["tags"],
                     "NagRaksha medical review", now, now),
                )

    # 2. Seed ChromaDB (semantic retrieval)
    chroma_chunks = [
        {
            "id": f"kb-{c['docId']}",
            "docId": c["docId"],
            "title": c["title"],
            "category": c["category"],
            "content": c["content"],
        }
        for c in KB_SEED
    ]
    seed_kb(chroma_chunks)
