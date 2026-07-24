import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/hospitals/[id]/stock — hospital updates its antivenom stock.
// FR-4.5 / FR-8.1. Immediately affects future routing (ranking reads fresh).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();

  const status = String(body.status ?? "UNKNOWN");
  const quantityBand = body.quantityBand ? String(body.quantityBand) : null;
  const product = body.product ? String(body.product) : "Polyvalent ASV";
  const verifiedBy = body.verifiedBy ? String(body.verifiedBy) : "Hospital console";

  const hospital = await db.hospital.findUnique({ where: { id } });
  if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  const stock = await db.antivenomStock.create({
    data: {
      hospitalId: id,
      product,
      status,
      quantityBand,
      verifiedAt: new Date(),
      verifiedBy,
    },
  });

  // Keep only the freshest stock record per hospital for reads.
  await db.antivenomStock.deleteMany({
    where: { hospitalId: id, NOT: { id: stock.id } },
  });

  return NextResponse.json({ hospitalId: id, stock });
}
