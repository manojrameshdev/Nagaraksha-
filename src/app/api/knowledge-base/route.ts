import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { retrieve } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/knowledge-base — inspect the curated RAG corpus.
// ?q= performs a retrieval preview (top-k chunks) using the RAG retriever.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  if (q.trim()) {
    const results = await retrieve(q, Number(url.searchParams.get("k") ?? 4));
    return NextResponse.json({ query: q, results });
  }

  const chunks = await db.knowledgeChunk.findMany({
    take: limit,
    orderBy: { category: "asc" },
    select: {
      id: true,
      docId: true,
      title: true,
      category: true,
      tags: true,
      reviewedBy: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json({
    count: chunks.length,
    reviewedBy: "NagRaksha medical review (demo corpus)",
    chunks,
  });
}
