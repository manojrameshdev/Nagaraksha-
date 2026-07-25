import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/outbox — operational view of the event-driven outbox + worker.
// Useful for demoing the System Design's durability + retry semantics.
export async function GET() {
  const [pending, processed, failed, recent] = await Promise.all([
    db.outboxEvent.count({ where: { state: "PENDING" } }),
    db.outboxEvent.count({ where: { state: "PROCESSED" } }),
    db.outboxEvent.count({ where: { state: "FAILED" } }),
    db.outboxEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  return NextResponse.json({
    summary: { pending, processed, failed, total: pending + processed + failed },
    recent: recent.map((e) => ({
      id: e.id,
      type: e.type,
      aggregateId: e.aggregateId,
      state: e.state,
      attempts: e.attempts,
      createdAt: e.createdAt,
      processedAt: e.processedAt,
    })),
  });
}
