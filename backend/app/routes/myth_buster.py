"""Myth-buster RAG route — FR-5.1, 5.2, 5.3."""
from __future__ import annotations

import json
from fastapi import APIRouter
from ..models import MythRequest
from .. import database as db
from ..rag import rag_answer
from ..eventbus import audit

router = APIRouter()


@router.post("/api/myth-buster")
def ask(body: MythRequest):
    result = rag_answer(body.question)
    myth_flagged = "MYTH:" in result["answer"]
    cited = [s["docId"] for s in result["sources"]]
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO MythThread (id, question, answer, mythFlagged, sources, createdAt) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (db.new_id(), body.question, result["answer"], 1 if myth_flagged else 0,
             json.dumps(cited), db.now_iso()),
        )
    audit(incident_id=None, actor="public", action="RAG_QUERY", entity="MythThread",
          metadata={"question": body.question, "source": result["source"],
                    "retrieved": cited, "mythFlagged": myth_flagged})
    return {
        "answer": result["answer"],
        "emergency": result["source"] == "guard",
        "mythFlagged": myth_flagged,
        "source": result["source"],
        "sources": [{"docId": s["docId"], "title": s["title"], "category": s["category"],
                      "score": s["score"]} for s in result["sources"]],
    }
