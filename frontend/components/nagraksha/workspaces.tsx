'use client';

import { Camera, ClipboardCheck, FileCheck2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DispatchLane,
  FeatureCard,
  FirstAidChecklist,
  HospitalRecommendationCard,
  IncidentTable,
  LocalTimeline,
  PageTitle,
  RiskAdvisoryCard,
  RoleEmpty,
  StatusBadge,
  StockFreshnessBadge,
} from './shared';
import type { ReactNode } from 'react';
import type { Role } from './shell';

export function VictimWorkspace({ active, onSos }: { active: boolean; onSos: () => void }) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        eyebrow="Emergency home"
        title="Snakebite support, without delay."
        subtitle="Keep the person still, follow first aid, and use the demo control below only to explore this presentation."
        action={
          <StatusBadge
            label={active ? 'DEMO ACTIVE' : 'READY'}
            tone={active ? 'warning' : 'success'}
          />
        }
      />
      {active ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-7">
            <p className="text-xs font-bold tracking-[0.14em] text-destructive">
              DEMO SOS · NR-DEMO-1042
            </p>
            <h2 className="mt-2 text-2xl font-semibold">DEMO ACTIVE</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Presentation state only. No request, location, notification, or real-world dispatch
              was transmitted.
            </p>
            <div className="mt-5">
              <DispatchLane title="RESPONDER" status="ACCEPTED" eta="7 min" />
              <DispatchLane title="RESCUE" status="ALERTED" />
              <DispatchLane title="AMBULANCE / HOSPITAL" status="ACCEPTED" eta="11 min" />
            </div>
            <div className="mt-5 border-t border-destructive/15 pt-5">
              <p className="mb-4 text-xs font-bold tracking-[0.12em] text-muted-foreground">
                STATIC INCIDENT TIMELINE
              </p>
              <LocalTimeline />
              <p className="mt-2 pl-5 text-xs text-muted-foreground">
                Demo dispatching · presentation state · no hidden operation
              </p>
            </div>
          </section>
          <div className="flex flex-col gap-6">
            <HospitalRecommendationCard />
            <FirstAidChecklist />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-destructive/30 bg-card p-5 sm:p-8">
            <p className="text-xs font-bold tracking-[0.14em] text-destructive">EMERGENCY ACTION</p>
            <h2 className="mt-2 text-xl font-semibold">Need immediate guidance?</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Triggers a real SOS dispatch: your location is sent to nearby responders, rescue, and
              the nearest hospital with confirmed antivenom stock.
            </p>
            <Button
              type="button"
              onClick={onSos}
              className="mt-6 min-h-20 w-full rounded-xl bg-destructive px-6 text-lg font-bold text-primary-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive sm:min-h-24"
            >
              SOS — SNAKEBITE
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">SOS · live dispatch</p>
          </section>
          <FirstAidChecklist />
        </div>
      )}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <RiskAdvisoryCard />
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-bold tracking-[0.12em] text-primary">EMERGENCY GUIDE</p>
          <h2 className="mt-2 font-semibold">
            Identification is optional. Never delay emergency care.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Snake ID and myth education are secondary tools for later review.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <FeatureCard
              icon={Camera}
              title="Snake ID"
              detail="Optional presentation only."
              action="Review"
            />
            <FeatureCard
              icon={FileCheck2}
              title="Myth Buster"
              detail="MYTH → FACT → ACTION."
              action="Review"
            />
            <FeatureCard
              icon={ClipboardCheck}
              title="Guide"
              detail="Safe steps and what to avoid."
              action="Open"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
function WorkspaceFrame({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <PageTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
function ResponderWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="Operations / responder"
      title="What needs a trained responder now?"
      subtitle="Review the incoming demo incident, first aid, and presentation timeline. Accept and decline controls remain local only."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-accent/35 bg-accent/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-foreground">
                INCOMING INCIDENT
              </p>
              <h2 className="mt-2 text-xl font-semibold">NR-DEMO-1042</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kasaragod · location presentation
              </p>
            </div>
            <StatusBadge label="DEMO QUEUE" tone="warning" />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" className="min-h-11">
              Accept demo
            </Button>
            <Button variant="outline" className="min-h-11">
              Decline demo
            </Button>
          </div>
        </section>
        <FirstAidChecklist />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Incident details</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Presentation ETA</dt>
              <dd className="font-semibold">7 min</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Symptoms</dt>
              <dd className="font-semibold">Pending demo log</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Transmission</dt>
              <dd className="font-semibold text-destructive">Not transmitted</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Local timeline</h2>
          <div className="mt-4">
            <LocalTimeline />
          </div>
        </section>
      </div>
    </WorkspaceFrame>
  );
}
function RescueWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="Operations / rescue"
      title="Which field alert needs rescue attention?"
      subtitle="Location, species observation, capture, release, and navigation are static presentation surfaces."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-destructive">
                ACTIVE RESCUE ALERT
              </p>
              <h2 className="mt-2 text-xl font-semibold">NR-DEMO-1042</h2>
            </div>
            <StatusBadge label="PRESENTATION" tone="warning" />
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
            <p className="flex gap-3">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              Pallikere panchayat · location presentation
            </p>
            <p className="flex gap-3">
              <Camera className="size-4 text-primary" aria-hidden="true" />
              Species observation · not verified
            </p>
            <p className="flex gap-3">
              <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
              Capture and release logs available locally
            </p>
          </div>
          <Button variant="outline" className="mt-5 min-h-11">
            Open navigation presentation
          </Button>
        </section>
        <div className="grid gap-4">
          <RoleEmpty role="rescue" />
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Capture and release log</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              08 capture records · 05 releases · static demo records.
            </p>
          </section>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
function AmbulanceWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="Operations / ambulance"
      title="Where should the active transport hand off?"
      subtitle="Review the recommended destination, stock freshness, alternative, and handoff packet. No route calculations or live dispatch are performed."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-bold tracking-[0.12em] text-primary">ACTIVE TRANSPORT</p>
          <h2 className="mt-2 text-xl font-semibold">NR-DEMO-1042</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Kasaragod → District Hospital A · route presentation
          </p>
          <div className="mt-5 rounded-lg bg-secondary p-4">
            <p className="text-xs font-bold tracking-[0.12em] text-primary">HANDOFF</p>
            <p className="mt-2 text-sm leading-6">
              Packet ready for review. ETA 18 min is static demo data.
            </p>
          </div>
        </section>
        <HospitalRecommendationCard />
      </div>
    </WorkspaceFrame>
  );
}
function HospitalWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="Operations / hospital"
      title="Which incoming cases need readiness review?"
      subtitle="Desktop-first presentation of incoming cases, stock freshness, pre-arrival review, and wound trend information."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Incoming cases</h2>
            <StatusBadge label="DEMO DATA" tone="warning" />
          </div>
          <IncidentTable />
        </section>
        <div className="grid gap-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Antivenom stock</h2>
              <StatusBadge label="VERIFICATION" tone="warning" />
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <p className="font-semibold">Polyvalent AVS</p>
                <StockFreshnessBadge status="confirmed" detail="24 vials · verified 8 min ago" />
              </div>
              <div className="border-t border-border pt-4">
                <p className="font-semibold">Emergency reserve</p>
                <StockFreshnessBadge status="unknown" detail="Last check stale" />
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Pre-arrival packet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Wound trend and symptom fields are presentation-only. No clinical decision is
              calculated.
            </p>
          </section>
        </div>
      </div>
    </WorkspaceFrame>
  );
}
function AshaWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="Community / ASHA"
      title="Where are coverage gaps requiring follow-up?"
      subtitle="Static household assessment, village risk, district presentation, and follow-up areas. This is not live GIS."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-destructive/25 bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Coverage gaps</h2>
            <StatusBadge label="FOLLOW-UP" tone="danger" />
          </div>
          <p className="mt-2 text-3xl font-semibold">69 households</p>
          <p className="mt-1 text-sm text-muted-foreground">
            179 of 248 visits complete · demo audit
          </p>
          <Button variant="outline" className="mt-5 min-h-11">
            Review follow-up areas
          </Button>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Household assessment</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="flex justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Village risk</span>
              <strong>HIGH · static</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Last audit</span>
              <strong>Today · demo</strong>
            </p>
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">District risk presentation</h2>
        <div className="mt-4 flex min-h-40 items-center justify-center rounded-lg bg-secondary text-center">
          <div>
            <MapPin className="mx-auto size-6 text-primary" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold">Kasaragod · elevated activity band</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Static presentation · not live GIS or risk calculation
            </p>
          </div>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
function StakeholderWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="Community / registry"
      title="Which partners are in the response network?"
      subtitle="Local search, filtering, and add/edit presentation state only."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground sm:w-80">
          <Search className="size-4" aria-hidden="true" />
          <span className="sr-only">Search stakeholders</span>
          <input
            aria-label="Search stakeholders"
            placeholder="Search stakeholders"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <Button className="min-h-11">Add demo stakeholder</Button>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-muted text-xs tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ORGANIZATION</th>
              <th className="px-4 py-3">TYPE</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">DISTRICT</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Kasaragod District Hospital', 'Hospital', 'Active', 'Kasaragod'],
              ['Forest Rescue Unit', 'Rescue', 'Review', 'Kasaragod'],
              ['Community Health Network', 'Community', 'Active', 'Kannur'],
            ].map((row) => (
              <tr key={row[0]} className="border-t border-border">
                {row.map((cell, index) => (
                  <td
                    key={cell}
                    className={cn(
                      'px-4 py-4',
                      index === 0 ? 'font-semibold' : 'text-muted-foreground',
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WorkspaceFrame>
  );
}
function AdminWorkspace() {
  return (
    <WorkspaceFrame
      eyebrow="System / admin"
      title="What needs system oversight?"
      subtitle="Static system seams, audit trail, event outbox, knowledge-base inspection, and responder/stakeholder views."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">System overview</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="flex justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Incident activity</span>
              <strong>128 demo records</strong>
            </p>
            <p className="flex justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Audit trail</span>
              <strong>642 static events</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Event outbox</span>
              <strong>14 presentation rows</strong>
            </p>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-foreground p-5 text-primary-foreground">
          <p className="text-xs font-bold tracking-[0.12em] text-accent">
            ARCHITECTURE PRESENTATION
          </p>
          <h2 className="mt-2 text-xl font-semibold">Backend-authoritative seams</h2>
          <div className="mt-5 grid gap-3 text-sm text-primary-foreground/75">
            <p>UI → page/workspace presentation state</p>
            <p>Future seam → frontend/src/lib/api.ts</p>
            <p>Realtime seam → existing WebSocket / SSE</p>
            <p>Domain → FastAPI / events / data</p>
          </div>
        </section>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Audit trail</h2>
          <IncidentTable />
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Knowledge base and outbox</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Inspection surfaces are static demo records. No new network behavior is introduced.
          </p>
        </section>
      </div>
    </WorkspaceFrame>
  );
}

export function RoleWorkspace({
  role,
  active,
  onSos,
}: {
  role: Role;
  active: boolean;
  onSos: () => void;
}) {
  if (role === 'Victim') return <VictimWorkspace active={active} onSos={onSos} />;
  if (role === 'Responder') return <ResponderWorkspace />;
  if (role === 'Rescue') return <RescueWorkspace />;
  if (role === 'Ambulance') return <AmbulanceWorkspace />;
  if (role === 'Hospital') return <HospitalWorkspace />;
  if (role === 'ASHA') return <AshaWorkspace />;
  if (role === 'Stakeholder') return <StakeholderWorkspace />;
  return <AdminWorkspace />;
}
