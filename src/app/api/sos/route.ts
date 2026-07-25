import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { genIncidentRef } from "@/lib/nagraksha";
import { appendOutbox, audit, getRankedHospitals, getBus } from "@/lib/eventbus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sos — one tap creates an incident, writes an IncidentCreated event
// to the outbox IN THE SAME TRANSACTION, returns immediately. The outbox
// worker then fans out three independent dispatch jobs (System Design §3).
// The victim's UI subscribes to /api/incidents/[id]/stream for live state.
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

  // Transactional incident write + outbox append (System Design step 3+4).
  const incident = await db.$transaction(async (tx) => {
    const inc = await tx.incident.create({
      data: { lat, lng, address, biteTime, bodyPart, snakeType, state: "DISPATCHING" },
    });
    await tx.outboxEvent.create({
      data: {
        type: "IncidentCreated",
        aggregateId: inc.id,
        payload: JSON.stringify({ lat: inc.lat, lng: inc.lng, incidentId: inc.id }),
        state: "PENDING",
      },
    });
    return inc;
  });

  // Ensure the bus + outbox worker are running so the IncidentCreated event
  // gets drained and fans out the three dispatch lanes.
  getBus();

  await audit({
    incidentId: incident.id,
    actor: "victim",
    action: "SOS_TRIGGERED",
    entity: "Incident",
    metadata: { lat, lng, address },
  });

  const rankedHospitals = await getRankedHospitals(lat, lng);

  return NextResponse.json({
    incident,
    streamUrl: `/api/incidents/${incident.id}/stream`,
    auditUrl: `/api/incidents/${incident.id}/audit`,
    ref: genIncidentRef(),
    rankedHospitals,
    dispatchedAt: new Date().toISOString(),
    note: "Incident committed + IncidentCreated event appended to outbox. The dispatch worker is fanning out three lanes in parallel; subscribe to streamUrl for live state.",
  });
}
