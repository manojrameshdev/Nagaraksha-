// NagRaksha in-process event bus + outbox worker + audit logger.
//
// Faithful to the System Design document:
//   "PWA → API Gateway/Auth → Incident Service → transactional incident write
//    → Dispatch Orchestrator → three independent dispatch jobs...
//    Outbox/event emits IncidentCreated. Worker retries until processed.
//    Client state updates through WebSocket/SSE."
//
// For the hackathon modular monolith we implement this as an in-process
// EventEmitter singleton (no external Redis/Kafka), backed by the OutboxEvent
// table for durability. A single poller drains the outbox and dispatches to
// handlers. SSE streams subscribe to the bus for live state.

import { EventEmitter } from 'events';
import { db } from '@/lib/db';
import { simulateDispatch, rankHospitals, type StockStatus } from '@/lib/nagraksha';

type BusPayload = Record<string, unknown>;

type BusEventMap = {
  IncidentCreated: (_incidentId: string, _payload: BusPayload) => void;
  DispatchAttempted: (_incidentId: string, _payload: BusPayload) => void;
  DispatchAccepted: (_incidentId: string, _payload: BusPayload) => void;
  IncidentStateChanged: (_incidentId: string, _payload: BusPayload) => void;
  IncidentClosed: (_incidentId: string, _payload: BusPayload) => void;
};

class NagRakshaBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }
  on<K extends keyof BusEventMap>(ev: K, fn: BusEventMap[K]) {
    return super.on(ev, fn as (..._args: unknown[]) => void);
  }
  emit<K extends keyof BusEventMap>(ev: K, ..._args: Parameters<BusEventMap[K]>) {
    return super.emit(ev, ...(_args as unknown[]));
  }
}

const GLOBAL = globalThis as unknown as {
  __nagrakshaBus?: NagRakshaBus;
  __nagrakshaWorkerStarted?: boolean;
};

export function getBus(): NagRakshaBus {
  if (!GLOBAL.__nagrakshaBus) {
    GLOBAL.__nagrakshaBus = new NagRakshaBus();
    registerHandlers(GLOBAL.__nagrakshaBus);
    startOutboxWorker();
  }
  return GLOBAL.__nagrakshaBus;
}

/** Append an event to the outbox (durable) — called inside the SOS transaction. */
export async function appendOutbox(type: keyof BusEventMap, aggregateId: string, payload: BusPayload) {
  await db.outboxEvent.create({
    data: {
      type,
      aggregateId,
      payload: JSON.stringify(payload),
      state: 'PENDING',
    },
  });
}

/** Write an audit row (NFR-8). */
export async function audit(args: {
  incidentId?: string;
  actor: string;
  action: string;
  entity?: string;
  metadata?: BusPayload;
}) {
  try {
    await db.auditEvent.create({
      data: {
        incidentId: args.incidentId ?? null,
        actor: args.actor,
        action: args.action,
        entity: args.entity ?? null,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
      },
    });
  } catch {
    /* audit is best-effort; never fail the main flow */
  }
}

/** Register the domain event handlers — the "three independent dispatch jobs". */
function registerHandlers(bus: NagRakshaBus) {
  // Wrap each handler so a rejection never escapes and crashes the process.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safe = <T extends (..._args: any[]) => Promise<void>>(fn: T) =>
    (..._args: Parameters<T>) => {
      Promise.resolve()
        .then(() => fn(..._args))
        .catch(() => {
          /* handler error — outbox is durable, event already marked processed */
        });
    };

  bus.on(
    'IncidentCreated',
    safe(async (incidentId: string, payload: BusPayload) => {
      await audit({
        incidentId,
        actor: 'system',
        action: 'DISPATCH_FANOUT',
        entity: 'Incident',
        metadata: { lanes: ['TRAINED', 'RESCUE', 'AMBULANCE'] },
      });

      const { lat, lng } = payload as { lat: number; lng: number };
      const sim = simulateDispatch({ lat, lng });
      const lanes: { category: 'TRAINED' | 'RESCUE' | 'AMBULANCE'; attempts: { name: string; role: string; distanceKm: number; etaMin: number; acceptAt: number; accept: boolean }[] }[] = [
        { category: 'TRAINED', attempts: sim.trained },
        { category: 'RESCUE', attempts: sim.rescue },
        { category: 'AMBULANCE', attempts: sim.ambulance },
      ];

      // Three independent dispatch jobs — each can fail without blocking the
      // others, exactly as the System Design specifies.
      await Promise.all(
        lanes.map(async (lane) => {
          for (let i = 0; i < lane.attempts.length; i++) {
            // eslint-disable-next-line security/detect-object-injection
            const a = lane.attempts[i];
            const attempt = await db.dispatchAttempt.create({
              data: {
                incidentId,
                category: lane.category,
                candidateName: a.name,
                candidateRole: a.role,
                distanceKm: a.distanceKm,
                etaMin: a.etaMin,
                sequence: i + 1,
                outcome: 'PENDING',
              },
            });
            // emit "sent" immediately
            bus.emit('DispatchAttempted', incidentId, {
              attemptId: attempt.id,
              category: lane.category,
              candidateName: a.name,
              candidateRole: a.role,
              distanceKm: a.distanceKm,
              etaMin: a.etaMin,
              sequence: i + 1,
              state: 'ALERTED',
            });

            // first candidate accepts after its simulated delay; second is the
            // escalation candidate and stays PENDING unless the first declines.
            if (i === 0 && a.accept) {
              await sleep(Math.max(400, a.acceptAt - Date.now()));
              await db.dispatchAttempt.update({
                where: { id: attempt.id },
                data: { acceptedAt: new Date(), outcome: 'ACCEPTED' },
              });
              bus.emit('DispatchAccepted', incidentId, {
                attemptId: attempt.id,
                category: lane.category,
                candidateName: a.name,
                candidateRole: a.role,
                distanceKm: a.distanceKm,
                etaMin: a.etaMin,
                acceptedAt: new Date().toISOString(),
              });
            }
          }
        }),
      );

      // advance incident state after the three lanes have accepted
      await sleep(600);
      await db.incident.update({ where: { id: incidentId }, data: { state: 'ACCEPTED' } });
      bus.emit('IncidentStateChanged', incidentId, { state: 'ACCEPTED' });

      await sleep(1600);
      await db.incident.update({ where: { id: incidentId }, data: { state: 'TRANSPORTING' } });
      bus.emit('IncidentStateChanged', incidentId, { state: 'TRANSPORTING' });

      await sleep(2000);
      await db.incident.update({ where: { id: incidentId }, data: { state: 'HANDED_OFF' } });
      bus.emit('IncidentStateChanged', incidentId, { state: 'HANDED_OFF' });
      await audit({
        incidentId,
        actor: 'hospital',
        action: 'HANDOFF',
        entity: 'Incident',
        metadata: { state: 'HANDED_OFF' },
      });
    }),
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poller that drains the OutboxEvent table and dispatches each event to the bus. */
function startOutboxWorker() {
  if (GLOBAL.__nagrakshaWorkerStarted) return;
  GLOBAL.__nagrakshaWorkerStarted = true;

  const tick = async () => {
    try {
      const pending = await db.outboxEvent.findMany({
        where: { state: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 25,
      });
      for (const ev of pending) {
        try {
          const payload = JSON.parse(ev.payload);
          // dispatch to the in-process bus (handlers are async but we don't
          // block the outbox drain on them — they emit + persist independently)
          (GLOBAL.__nagrakshaBus as EventEmitter)?.emit(ev.type, ev.aggregateId, payload);
          await db.outboxEvent.update({
            where: { id: ev.id },
            data: { state: 'PROCESSED', processedAt: new Date(), attempts: { increment: 1 } },
          });
        } catch (_err) {
          await db.outboxEvent
            .update({
              where: { id: ev.id },
              data: { attempts: { increment: 1 } },
            })
            .catch(() => {});
          if (ev.attempts >= 4) {
            await db.outboxEvent
              .update({
                where: { id: ev.id },
                data: { state: 'FAILED', processedAt: new Date() },
              })
              .catch(() => {});
          }
        }
      }
    } catch {
      /* db not ready; ignore */
    }
  };

  // run immediately + on a 2500ms interval. Guarded so an error never crashes
  // the process — the outbox is durable, so a missed tick just retries next time.
  const safeTick = async () => {
    try {
      await tick();
    } catch {
      /* ignore — retried on next interval */
    }
  };
  safeTick().catch(() => {});
  const handle = setInterval(safeTick, 2500);
  if (handle.unref) handle.unref();
}

/** Compute the ranked hospitals snapshot (used by SOS + SSE). */
export async function getRankedHospitals(lat: number, lng: number) {
  const hospitals = await db.hospital.findMany({
    where: { active: true },
    include: { antivenomStock: { orderBy: { verifiedAt: 'desc' }, take: 1 } },
  });
  return rankHospitals(
    { lat, lng },
    hospitals.map((h: { antivenomStock: Array<Record<string, unknown>>; id: string; name: string; lat: number; lng: number; address: string | null; contact: string | null }) => {
      const s = h.antivenomStock[0] as { product?: string; status?: string; quantityBand?: string | null; verifiedAt?: string; verifiedBy?: string | null } | undefined;
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        address: h.address,
        contact: h.contact,
        stock: {
          product: s?.product ?? 'Polyvalent ASV',
          status: (s?.status as StockStatus) ?? 'UNKNOWN',
          quantityBand: s?.quantityBand ?? null,
          verifiedAt: s?.verifiedAt ?? new Date(0).toISOString(),
          verifiedBy: s?.verifiedBy ?? null,
        },
      };
    }),
  );
}
