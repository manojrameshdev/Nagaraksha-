'use client';

import {
  Camera,
  ClipboardCheck,
  FileCheck2,
  Hospital,
  LayoutDashboard,
  MapPin,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { GrokChat } from './chat';
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

const QUICK_LINKS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hospitals', label: 'Hospitals', icon: Hospital },
  { href: '/risk', label: 'Risk advisory', icon: MapPin },
  { href: '/myth-buster', label: 'Myth Buster', icon: FileCheck2 },
  { href: '/snake-id', label: 'Snake ID', icon: Camera },
  { href: '/guide', label: 'Guide', icon: ClipboardCheck },
];

export function VictimWorkspace({ active, onSos }: { active: boolean; onSos: () => void }) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        eyebrow="Emergency home"
        title="Snakebite support, without delay."
        subtitle="Keep the person still, follow first aid, and trigger SOS if someone has been bitten."
        action={
          <StatusBadge label={active ? 'ACTIVE' : 'READY'} tone={active ? 'warning' : 'success'} />
        }
      />
      {active ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-7">
            <p className="text-xs font-bold tracking-[0.14em] text-destructive">SOS · NR-1042</p>
            <h2 className="mt-2 text-2xl font-semibold">DISPATCH ACTIVE</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Your location is being shared with nearby responders, rescue, and the nearest hospital
              with confirmed antivenom stock.
            </p>
            <div className="mt-5">
              <DispatchLane title="RESPONDER" status="ACCEPTED" eta="7 min" />
              <DispatchLane title="RESCUE" status="ALERTED" />
              <DispatchLane title="AMBULANCE / HOSPITAL" status="ACCEPTED" eta="11 min" />
            </div>
            <div className="mt-5 border-t border-destructive/15 pt-5">
              <p className="mb-4 text-xs font-bold tracking-[0.12em] text-muted-foreground">
                INCIDENT TIMELINE
              </p>
              <LocalTimeline />
              <p className="mt-2 pl-5 text-xs text-muted-foreground">
                Dispatch in progress · updates streaming live
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
              detail="Photo or description identification."
              action="Open"
              href="/snake-id"
            />
            <FeatureCard
              icon={FileCheck2}
              title="Myth Buster"
              detail="MYTH → FACT → ACTION."
              action="Open"
              href="/myth-buster"
            />
            <FeatureCard
              icon={ClipboardCheck}
              title="Guide"
              detail="Safe steps and what to avoid."
              action="Open"
              href="/guide"
            />
          </div>
        </section>
      </div>
      <section className="mt-4 rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-bold tracking-[0.12em] text-primary">QUICK NAVIGATION</p>
        <h2 className="mt-2 font-semibold">Jump to a platform page</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Open the live operational pages of the NagRaksha network.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
            >
              <Icon aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
      <div className="mt-4">
        <GrokChat />
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
      subtitle="Review the incoming incident, first aid, and response timeline."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-accent/35 bg-accent/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-foreground">
                INCOMING INCIDENT
              </p>
              <h2 className="mt-2 text-xl font-semibold">NR-1042</h2>
              <p className="mt-1 text-sm text-muted-foreground">Kasaragod · location shared</p>
            </div>
            <StatusBadge label="INCOMING" tone="warning" />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" className="min-h-11">
              Accept
            </Button>
            <Button variant="outline" className="min-h-11">
              Decline
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
              <dt className="text-muted-foreground">Response ETA</dt>
              <dd className="font-semibold">7 min</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Symptoms</dt>
              <dd className="font-semibold">Pending log</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Transmission</dt>
              <dd className="font-semibold text-destructive">In progress</dd>
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
      subtitle="Location, species observation, capture, release, and navigation for the active field alert."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-destructive">
                ACTIVE RESCUE ALERT
              </p>
              <h2 className="mt-2 text-xl font-semibold">NR-1042</h2>
            </div>
            <StatusBadge label="ACTIVE" tone="warning" />
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
            <p className="flex gap-3">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              Pallikere panchayat · location shared
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
            Open navigation
          </Button>
        </section>
        <div className="grid gap-4">
          <RoleEmpty role="rescue" />
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Capture and release log</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              08 capture records · 05 releases.
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
      subtitle="Review the recommended destination, stock freshness, alternative, and handoff packet."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-bold tracking-[0.12em] text-primary">ACTIVE TRANSPORT</p>
          <h2 className="mt-2 text-xl font-semibold">NR-1042</h2>
          <p className="mt-2 text-sm text-muted-foreground">Kasaragod → District Hospital A</p>
          <div className="mt-5 rounded-lg bg-secondary p-4">
            <p className="text-xs font-bold tracking-[0.12em] text-primary">HANDOFF</p>
            <p className="mt-2 text-sm leading-6">Packet ready for review. ETA 18 min.</p>
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
      subtitle="Incoming cases, stock freshness, pre-arrival review, and wound trend information."
    >
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Incoming cases</h2>
            <StatusBadge label="INCOMING" tone="warning" />
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
              Wound trend and symptom fields are recorded for the receiving team.
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
      subtitle="Household assessment, village risk, district coverage, and follow-up areas."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-destructive/25 bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Coverage gaps</h2>
            <StatusBadge label="FOLLOW-UP" tone="danger" />
          </div>
          <p className="mt-2 text-3xl font-semibold">69 households</p>
          <p className="mt-1 text-sm text-muted-foreground">179 of 248 visits complete</p>
          <Button variant="outline" className="mt-5 min-h-11">
            Review follow-up areas
          </Button>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Household assessment</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="flex justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Village risk</span>
              <strong>HIGH</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Last audit</span>
              <strong>Today</strong>
            </p>
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">District risk</h2>
        <div className="mt-4 flex min-h-40 items-center justify-center rounded-lg bg-secondary text-center">
          <div>
            <MapPin className="mx-auto size-6 text-primary" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold">Kasaragod · elevated activity band</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Live GIS and risk updates arrive with field data
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
      subtitle="Local search, filtering, and partner management."
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
        <Button className="min-h-11">Add stakeholder</Button>
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
      subtitle="System seams, audit trail, event outbox, knowledge-base inspection, and responder/stakeholder views."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">System overview</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="flex justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Incident activity</span>
              <strong>128 records</strong>
            </p>
            <p className="flex justify-between border-b border-border pb-3">
              <span className="text-muted-foreground">Audit trail</span>
              <strong>642 events</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-muted-foreground">Event outbox</span>
              <strong>14 rows</strong>
            </p>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-foreground p-5 text-primary-foreground">
          <p className="text-xs font-bold tracking-[0.12em] text-accent">ARCHITECTURE</p>
          <h2 className="mt-2 text-xl font-semibold">Backend-authoritative seams</h2>
          <div className="mt-5 grid gap-3 text-sm text-primary-foreground/75">
            <p>UI → page/workspace state</p>
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
            Inspection surfaces show live system state from the backend.
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
