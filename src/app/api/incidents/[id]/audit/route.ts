import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/incidents/[id]/audit — full timestamped audit trail (SRS NFR-8).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [incident, audit, outbox] = await Promise.all([
    db.incident.findUnique({
      where: { id },
      include: {
        dispatchAttempts: { orderBy: [{ category: "asc" }, { sequence: "asc" }] },
        symptomObservations: { orderBy: { observedAt: "asc" } },
        snakeObservations: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.auditEvent.findMany({ where: { incidentId: id }, orderBy: { timestamp: "asc" } }),
    db.outboxEvent.findMany({ where: { aggregateId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    incident,
    audit,
    outbox: outbox.map((o) => ({
      id: o.id,
      type: o.type,
      state: o.state,
      attempts: o.attempts,
      createdAt: o.createdAt,
      processedAt: o.processedAt,
      payload: o.payload,
    })),
  });
}
