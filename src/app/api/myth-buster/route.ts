import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ragAnswer } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/myth-buster — RAG-augmented conversational assistant (FR-5.1, 5.2, 5.3).
// Retrieves relevant chunks from the curated knowledge base, augments the LLM
// system prompt with them, generates a grounded answer with cited sources.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const question: string = String(body?.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const { answer, sources, source } = await ragAnswer(question);

  const mythFlagged = /MYTH:/i.test(answer);
  const citedDocIds = sources.map((s) => s.docId);

  await db.mythThread.create({
    data: {
      question,
      answer,
      mythFlagged,
      sources: JSON.stringify(citedDocIds),
    },
  });

  await db.auditEvent.create({
    data: {
      actor: "public",
      action: "RAG_QUERY",
      entity: "MythThread",
      metadata: JSON.stringify({
        question,
        source,
        retrieved: citedDocIds,
        mythFlagged,
      }),
    },
  });

  return NextResponse.json({
    answer,
    emergency: source === "guard",
    mythFlagged,
    source,
    sources: sources.map((s) => ({
      docId: s.docId,
      title: s.title,
      category: s.category,
      score: s.score,
    })),
  });
}
