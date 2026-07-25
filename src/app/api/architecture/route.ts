import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/architecture — the NagRaksha system architecture manifest.
// Data-driven from the System Design document so the frontend can render the
// layered diagram, the 9 core domains, the 8-step SOS sequence with failure
// behavior, the RBAC roles, and live operational stats (outbox + KB corpus).
export async function GET() {
  const [kbCount, outbox] = await Promise.all([
    db.knowledgeChunk.count(),
    db.outboxEvent.groupBy({ by: ["state"], _count: true }),
  ]);

  const outboxSummary = { PENDING: 0, PROCESSED: 0, FAILED: 0 };
  for (const g of outbox) outboxSummary[g.state as keyof typeof outboxSummary] = g._count;

  return NextResponse.json({
    // ---- Layered architecture (System Design §1) ----
    layers: [
      {
        name: "Client",
        tone: "#2BB673",
        components: [
          "React/TypeScript PWA",
          "Role-based routes",
          "Service worker (offline shell)",
          "IndexedDB (non-sensitive queued UI state)",
          "Responsive hospital/admin console",
        ],
      },
      {
        name: "API",
        tone: "#4FBF9A",
        components: [
          "REST endpoints",
          "WebSocket/SSE for live incident state",
          "Authentication + RBAC at API boundary",
        ],
      },
      {
        name: "Core domains",
        tone: "#D69E2E",
        components: [
          "Incident", "Dispatch", "Responder", "Hospital/Inventory",
          "Routing", "Clinical Handoff", "Notification", "Content/AI", "Analytics",
        ],
      },
      {
        name: "Data",
        tone: "#E0B443",
        components: [
          "SQLite/PostgreSQL + PostGIS (geospatial)",
          "Redis (presence, locks, rate limits — optional)",
        ],
      },
      {
        name: "Async",
        tone: "#E5484D",
        components: [
          "Outbox table (durable events)",
          "In-process event bus + worker",
          "Fan-out, retries, escalation",
          "Notification delivery",
        ],
      },
      {
        name: "External",
        tone: "#8FA39B",
        components: [
          "Maps/routing provider",
          "Weather API",
          "Web Push / browser push",
          "Optional SMS gateway",
          "Object storage (snake photos)",
        ],
      },
    ],

    // ---- 9 core domain modules ----
    domains: [
      { id: "incident", name: "Incident", desc: "Creates + owns the SOS lifecycle and state machine.", icon: "ShieldAlert" },
      { id: "dispatch", name: "Dispatch", desc: "Fans out three responder lanes in parallel; escalation on timeout.", icon: "Split" },
      { id: "responder", name: "Responder", desc: "Trained individuals, rescue teams, ambulances — availability + coverage radius.", icon: "Users" },
      { id: "hospital", name: "Hospital / Inventory", desc: "Live, hospital-updatable antivenom stock registry.", icon: "Droplet" },
      { id: "routing", name: "Routing", desc: "Antivenom-aware hospital ranking (stock first, ETA second).", icon: "Route" },
      { id: "handoff", name: "Clinical Handoff", desc: "Structured symptom timeline delivered to the doctor pre-arrival.", icon: "Stethoscope" },
      { id: "notification", name: "Notification", desc: "SSE / Web Push fan-out; SMS fallback for low connectivity.", icon: "Bell" },
      { id: "content", name: "Content / AI", desc: "RAG myth-buster + CV snake-id + weather risk advisory.", icon: "BrainCircuit" },
      { id: "analytics", name: "Analytics", desc: "Coverage planning, funding reports, anonymised statistics.", icon: "TrendingUp" },
    ],

    // ---- 8-step critical SOS sequence (System Design §3) ----
    sequence: [
      { step: 1, action: "Client obtains best available foreground location", failure: "If denied, allow manual location/pin; do not block UI indefinitely.", tone: "#2BB673" },
      { step: 2, action: "POST /incidents with idempotency key", failure: "Retry safely; same key returns same incident.", tone: "#4FBF9A" },
      { step: 3, action: "Database commits incident", failure: "Only after commit return accepted incident ID.", tone: "#D69E2E" },
      { step: 4, action: "Outbox/event emits IncidentCreated", failure: "Worker retries until processed.", tone: "#E0B443" },
      { step: 5, action: "Dispatch jobs start independently — trained, rescue, ambulance", failure: "One branch failure cannot block others.", tone: "#E5484D" },
      { step: 6, action: "Delivery attempts are recorded", failure: "Timeout expands search radius / next candidate.", tone: "#B42318" },
      { step: 7, action: "Acceptance uses atomic compare-and-set", failure: "Prevents two responders claiming one exclusive slot.", tone: "#7fd6ad" },
      { step: 8, action: "State event reaches victim UI", failure: "Reconnect fetches canonical server state.", tone: "#E0B443" },
    ],

    // ---- RBAC roles (System Design §7) ----
    roles: [
      { role: "victim", desc: "Raises or reports an SOS; one tap, minimal data.", tone: "#E5484D" },
      { role: "responder", desc: "Trained village first responder; accepts, navigates, logs symptoms.", tone: "#2BB673" },
      { role: "rescue", desc: "Captures + relocates the snake safely.", tone: "#D69E2E" },
      { role: "ambulance", desc: "Transports victim; turn-by-turn routing + hospital antivenom status.", tone: "#4FBF9A" },
      { role: "hospital", desc: "Receives case + dosage-relevant history; updates antivenom stock.", tone: "#7fd6ad" },
      { role: "admin", desc: "Coverage planning, funding reports, analytics.", tone: "#E0B443" },
    ],

    // ---- RAG pipeline (SRS FR-5.1) ----
    rag: {
      corpusChunks: kbCount,
      reviewedBy: "NagRaksha medical review (demo corpus)",
      sources: "WHO SEARO snakebite guidelines · NCBI envenoming reviews · India NAPSE",
      retrieval: "TF-IDF (in-process; no external embedding model in the SDK)",
      generation: "z-ai-web-dev-sdk chat, grounded in retrieved chunks with citations",
      categories: ["FIRST_AID", "MYTH", "SPECIES", "RISK", "ANTIVENOM", "PROTOCOL"],
    },

    // ---- Live operational stats ----
    outbox: outboxSummary,

    // ---- Logical flow (System Design §2) ----
    logicalFlow:
      "PWA → API Gateway/Auth → Incident Service → transactional incident write → Dispatch Orchestrator → three independent dispatch jobs → WebSocket/SSE → victim UI. Hospital routing queries fresh inventory state before ETA ranking.",
  });
}
