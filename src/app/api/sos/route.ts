import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { genIncidentRef, rankHospitals, simulateDispatch, type ResponderCategory } from "@/lib/nagraksha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sos — one tap creates an incident and fans out three responder
// categories IN PARALLEL (FR-1.2). Returns the incident + dispatch lanes.
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const lat = Number(body?.lat ?? 12.8003);
  const lng = Number(body?.lng ?? 77.5954);
  const biteTime = body?.biteTime ? new Date(body.biteTime) : new Date();
  const bodyPart = body?.bodyPart ?? null;
  const snakeType = body?.snakeType ?? null;
  const address = body?.address ?? null;

  const incident = await db.incident.create({
    data: { lat, lng, address, biteTime, bodyPart, snakeType, state: "DISPATCHING" },
  });

  const sim = simulateDispatch({ lat, lng });
  const hospitals = await db.hospital.findMany({
    where: { active: true },
    include: { antivenomStock: true },
  });
  const ranked = rankHospitals(
    { lat, lng },
    hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      address: h.address,
      contact: h.contact,
      stock: {
        product: h.antivenomStock[0]?.product ?? "Polyvalent ASV",
        status: (h.antivenomStock[0]?.status as any) ?? "UNKNOWN",
        quantityBand: h.antivenomStock[0]?.quantityBand ?? null,
        verifiedAt: h.antivenomStock[0]?.verifiedAt ?? new Date(0).toISOString(),
        verifiedBy: h.antivenomStock[0]?.verifiedBy ?? null,
      },
    }))
  );

  const lanes: { category: ResponderCategory; attempts: any[] }[] = [
    { category: "TRAINED", attempts: sim.trained },
    { category: "RESCUE", attempts: sim.rescue },
    { category: "AMBULANCE", attempts: sim.ambulance },
  ];

  for (const lane of lanes) {
    for (let i = 0; i < lane.attempts.length; i++) {
      const a = lane.attempts[i];
      await db.dispatchAttempt.create({
        data: {
          incidentId: incident.id,
          category: lane.category,
          candidateName: a.name,
          candidateRole: a.role,
          distanceKm: a.distanceKm,
          etaMin: a.etaMin,
          sequence: i + 1,
          acceptedAt: i === 0 && a.accept ? new Date(a.acceptAt) : null,
          outcome: i === 0 && a.accept ? "ACCEPTED" : "PENDING",
        },
      });
    }
  }

  const full = await db.incident.findUnique({
    where: { id: incident.id },
    include: {
      dispatchAttempts: { orderBy: { category: "asc" } },
      symptomObservations: { orderBy: { observedAt: "asc" } },
      snakeObservations: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({
    incident: full,
    ref: genIncidentRef(),
    rankedHospitals: ranked,
    dispatchedAt: new Date().toISOString(),
  });
}
