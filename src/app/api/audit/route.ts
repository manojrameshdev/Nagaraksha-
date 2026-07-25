import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/audit — recent global audit events (NFR-8 timestamped trail).
// Used by the demo's AuditTrailPanel to make the event-driven backend visible
// without depending on a specific incident id.
export async function GET() {
  const events = await db.auditEvent.findMany({
    orderBy: { timestamp: "desc" },
    take: 24,
  });

  const byAction: Record<string, number> = {};
  for (const e of events) byAction[e.action] = (byAction[e.action] ?? 0) + 1;

  return NextResponse.json({
    count: events.length,
    byAction,
    events: events.map((e) => ({
      id: e.id,
      incidentId: e.incidentId,
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      metadata: e.metadata ? safeParse(e.metadata) : null,
      timestamp: e.timestamp,
    })),
  });
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return s; }
}
