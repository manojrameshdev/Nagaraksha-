import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/incidents/[id] — canonical incident state (audit trail, FR NFR-8).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      dispatchAttempts: { orderBy: [{ category: "asc" }, { sequence: "asc" }] },
      symptomObservations: { orderBy: { observedAt: "asc" } },
      snakeObservations: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ incident });
}

// PATCH /api/incidents/[id] — advance incident state + append a symptom log
// entry (used by the live demo to simulate the trained responder logging
// symptoms; FR-2.3 / FR-2.4).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const incident = await db.incident.findUnique({ where: { id } });
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (body.state) data.state = String(body.state);
  if (body.snakeType) data.snakeType = String(body.snakeType);

  const updated = await db.incident.update({ where: { id }, data });

  if (Array.isArray(body.symptoms)) {
    for (const s of body.symptoms) {
      await db.symptomObservation.create({
        data: {
          incidentId: id,
          code: String(s.code),
          label: String(s.label),
          severity: s.severity ? String(s.severity) : null,
          value: s.value ? String(s.value) : null,
          author: s.author ? String(s.author) : null,
        },
      });
    }
  }
  if (body.snakeObservation) {
    await db.snakeObservation.create({
      data: {
        incidentId: id,
        imageRef: body.snakeObservation.imageRef ?? null,
        predictedClass: body.snakeObservation.predictedClass ?? null,
        confidence: body.snakeObservation.confidence ?? null,
        venomType: body.snakeObservation.venomType ?? null,
        rescuerSpecies: body.snakeObservation.rescuerSpecies ?? null,
      },
    });
  }

  const full = await db.incident.findUnique({
    where: { id },
    include: {
      dispatchAttempts: { orderBy: [{ category: "asc" }, { sequence: "asc" }] },
      symptomObservations: { orderBy: { observedAt: "asc" } },
      snakeObservations: { orderBy: { createdAt: "asc" } },
    },
  });
  return NextResponse.json({ incident: full });
}
