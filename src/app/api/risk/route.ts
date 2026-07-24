import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/risk?lat=&lng= — weather/season-based snake-encounter risk (FR-7.1).
// Returns the nearest seeded risk report + a synthesized advisory.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const lat = Number(url.searchParams.get("lat") ?? 12.8003);
  const lng = Number(url.searchParams.get("lng") ?? 77.5954);

  const reports = await db.riskReport.findMany({ orderBy: { createdAt: "desc" } });
  if (reports.length === 0) {
    return NextResponse.json({ level: "UNKNOWN", score: 0, advisory: "No risk data available." });
  }

  // nearest by straight-line distance
  let nearest = reports[0];
  let best = Infinity;
  for (const r of reports) {
    const d = Math.hypot(r.lat - lat, r.lng - lng);
    if (d < best) { best = d; nearest = r; }
  }

  const advisories: Record<string, string> = {
    LOW: "Encounter risk is low. Standard field precautions apply — carry a light, watch where you step.",
    MODERATE:
      "Moderate encounter risk. Wear closed footwear, use a torch after dark, avoid tall grass and dry woodpiles.",
    HIGH:
      "High encounter risk. Snakes are active in these conditions. Use a stick to probe ahead, keep children away from vegetation edges, keep mobile SOS ready.",
    SEVERE:
      "Severe encounter risk. Post-monsoon conditions strongly favour snake movement. Avoid walking through fields at dusk and dawn; if bitten, do not waste time on folk remedies — trigger SOS immediately.",
  };

  return NextResponse.json({
    area: nearest.area,
    level: nearest.level,
    score: nearest.score,
    weather: nearest.weather,
    season: nearest.season,
    likelySnakes: nearest.likelySnakes ? nearest.likelySnakes.split(",").map((s) => s.trim()) : [],
    advisory: advisories[nearest.level] ?? advisories.MODERATE,
    origin: { lat, lng },
  });
}
