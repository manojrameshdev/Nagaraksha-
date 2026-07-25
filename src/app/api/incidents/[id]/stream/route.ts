import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getBus } from "@/lib/eventbus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/incidents/[id]/stream — Server-Sent Events stream of live incident
// state (System Design: "Client state updates through WebSocket/SSE").
//
// The victim UI opens this right after /api/sos returns. The outbox worker
// emits DispatchAttempted / DispatchAccepted / IncidentStateChanged events;
// this endpoint forwards them to the client as SSE frames.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const incident = await db.incident.findUnique({
    where: { id },
    include: {
      dispatchAttempts: { orderBy: [{ category: "asc" }, { sequence: "asc" }] },
    },
  });
  if (!incident) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const bus = getBus();

      const send = (event: string, data: any) => {
        const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          /* client disconnected */
        }
      };

      // 1) initial snapshot so the client can render immediately
      send("snapshot", {
        incident,
        ts: new Date().toISOString(),
      });

      const onAttempted = (incidentId: string, payload: any) => {
        if (incidentId === id) send("dispatch_attempted", payload);
      };
      const onAccepted = (incidentId: string, payload: any) => {
        if (incidentId === id) send("dispatch_accepted", payload);
      };
      const onStateChanged = (incidentId: string, payload: any) => {
        if (incidentId === id) send("incident_state", payload);
      };

      bus.on("DispatchAttempted", onAttempted);
      bus.on("DispatchAccepted", onAccepted);
      bus.on("IncidentStateChanged", onStateChanged);

      // heartbeat to keep the connection alive through proxies
      const hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          /* gone */
        }
      }, 12000);

      // close handler
      const cleanup = () => {
        clearInterval(hb);
        bus.off("DispatchAttempted", onAttempted);
        bus.off("DispatchAccepted", onAccepted);
        bus.off("IncidentStateChanged", onStateChanged);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);

      // If the incident is already in a terminal state, close after the snapshot.
      if (incident.state === "HANDED_OFF" || incident.state === "CLOSED") {
        setTimeout(cleanup, 2500);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
