import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rankHospitals, type StockStatus } from "@/lib/nagraksha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hospitals?lat=&lng= — list active hospitals with antivenom stock,
// ranked NagRaksha-style (confirmed stock first, then ETA). FR-4.2.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const lat = Number(url.searchParams.get("lat") ?? 12.8003);
  const lng = Number(url.searchParams.get("lng") ?? 77.5954);

  const hospitals = await db.hospital.findMany({
    where: { active: true },
    include: { antivenomStock: { orderBy: { verifiedAt: "desc" }, take: 1 } },
  });

  const ranked = rankHospitals(
    { lat, lng },
    hospitals.map((h) => {
      const s = h.antivenomStock[0];
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        address: h.address,
        contact: h.contact,
        stock: {
          product: s?.product ?? "Polyvalent ASV",
          status: (s?.status as StockStatus) ?? "UNKNOWN",
          quantityBand: s?.quantityBand ?? null,
          verifiedAt: s?.verifiedAt ?? new Date(0).toISOString(),
          verifiedBy: s?.verifiedBy ?? null,
        },
      };
    })
  );

  return NextResponse.json({ hospitals: ranked, origin: { lat, lng } });
}
