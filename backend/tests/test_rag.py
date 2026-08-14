"""RAG tests — exercise the TF-IDF fallback path (ChromaDB collection patched
to None) so the pipeline is tested without downloading the ONNX model."""

from unittest.mock import patch

from app import rag


class TestRetrieveFallback:
    def test_retrieve_without_chromadb_returns_list(self, monkeypatch):
        monkeypatch.setattr(rag, "_get_collection", lambda: None)
        results = rag.retrieve("cobra bite symptoms", k=3)
        assert isinstance(results, list)

    def test_retrieve_with_chromadb_unavailable_returns_empty(self, monkeypatch):
        # No KnowledgeChunk rows in the test DB (ensure_kb_seeded is mocked)
        monkeypatch.setattr(rag, "_get_collection", lambda: None)
        assert rag.retrieve("anything", k=5) == []


class TestRagAnswerGuard:
    def test_emergency_short_circuits(self, monkeypatch):
        monkeypatch.setattr(rag, "_get_collection", lambda: None)
        res = rag.rag_answer("my son was just bitten, help now")
        assert res["source"] == "guard"
        assert "SOS" in res["answer"]

    def test_retrieval_only_fallback_uses_top_chunk(self, monkeypatch):
        chunk = {
            "id": "c1", "docId": "doc-1", "title": "First Aid Basics",
            "category": "FIRST_AID", "content": "Wash the wound gently with soap and water.",
            "tags": "first aid", "score": 0.9,
        }
        monkeypatch.setattr(rag, "_get_collection", lambda: None)
        with patch.object(rag, "retrieve", return_value=[chunk]):
            with patch.object(rag, "is_available", return_value=False):
                res = rag.rag_answer("what should I do after a bite")
        assert res["source"] == "rag-retrieval-only"
        assert "Wash the wound gently" in res["answer"]

    def test_no_retrieval_falls_back_to_greeting(self, monkeypatch):
        monkeypatch.setattr(rag, "_get_collection", lambda: None)
        with patch.object(rag, "retrieve", return_value=[]):
            res = rag.rag_answer("tell me a snake fact")
        assert res["source"] == "fallback"
        assert "NagRaksha Mitra" in res["answer"]
