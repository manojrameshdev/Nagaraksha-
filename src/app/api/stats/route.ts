import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stats — aggregated analytics for coverage planning (FR-9.1, FR-9.2).
export async function GET() {
  const [incidents, hospitals, riskReports, mythThreads] = await Promise.all([
    db.incident.findMany({ select: { id: true, state: true, createdAt: true } }),
    db.hospital.findMany({ include: { antivenomStock: true } }),
    db.riskReport.findMany(),
    db.mythThread.findMany({ select: { id: true, mythFlagged: true, createdAt: true } }),
  ]);

  const byState: Record<string, number> = {};
  for (const i of incidents) byState[i.state] = (byState[i.state] ?? 0) + 1;

  const stockCounts: Record<string, number> = {};
  for (const h of hospitals) {
    const s = h.antivenomStock[0]?.status ?? "UNKNOWN";
    stockCounts[s] = (stockCounts[s] ?? 0) + 1;
  }

  // last 14 days incident volume (for a sparkline)
  const days: { date: string; count: number }[] = [];
  for (let d = 13; d >= 0; d--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - d);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const count = incidents.filter((i) => i.createdAt >= day && i.createdAt < next).length;
    days.push({ date: day.toISOString().slice(0, 10), count });
  }

  return NextResponse.json({
    totals: {
      incidents: incidents.length,
      hospitals: hospitals.length,
      riskAreas: riskReports.length,
      mythConversations: mythThreads.length,
      mythsBusted: mythThreads.filter((m) => m.mythFlagged).length,
    },
    incidentsByState: byState,
    stockDistribution: stockCounts,
    incidentTrend14d: days,
    // Hero stat — India's annual snakebite deaths (source: NagRaksha SRS context)
    annualDeathsIndia: 58000,
    parallelDispatchLanes: 3,
  });
}
