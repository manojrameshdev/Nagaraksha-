'use client';

import {
  Camera,
  ClipboardCheck,
  FileCheck2,
  Hospital,
  LayoutDashboard,
  Loader2,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { GrokChat } from './chat';
import { DispatchActions } from '@/components/dispatch-actions';
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
import {
  addStakeholder,
  getOutbox,
  getStats,
  getSystemAudit,
  listStakeholders,
  type AuditEvent,
  type Stakeholder,
  type StatsResponse,
} from '@/lib/nagraksha';
import { useLatestIncident } from '@/hooks/use-latest-incident';
import type { FormEvent, ReactNode } from 'react';
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
  const { incident, loading, error } = useLatestIncident();
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
              <h2 className="mt-2 text-xl font-semibold">
                {loading ? 'Loading…' : incident ? incident.id : 'No active incident'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {incident
                  ? (incident.address ?? `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}`)
                  : (error ?? 'Trigger an SOS from the emergency home to open a lane.')}
              </p>
            </div>
            <StatusBadge
              label={incident ? incident.state.replaceAll('_', ' ') : 'IDLE'}
              tone={incident ? 'warning' : 'neutral'}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {incident ? (
              <DispatchActions incidentId={incident.id} />
            ) : (
              <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}>
                Go to emergency home
              </Link>
            )}
          </div>
        </section>
        <FirstAidChecklist />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Incident details</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">State</dt>
              <dd className="font-semibold">
                {incident ? incident.state.replaceAll('_', ' ') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-muted-foreground">Symptoms</dt>
              <dd className="font-semibold">
                {incident && incident.symptomObservations.length > 0
                  ? `${incident.symptomObservations.length} logged`
                  : 'Pending log'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Live tracking</dt>
              <dd className="font-semibold text-primary">WebSocket</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Local timeline</h2>
          <div className="mt-4">
            <LocalTimeline />
          </div>
          {incident && (
            <Link
              href={`/incidents/${incident.id}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 min-h-11 w-full')}
            >
              Open incident page
            </Link>
          )}
        </section>
      </div>
    </WorkspaceFrame>
  );
}
function RescueWorkspace() {
  const { incident, loading, error } = useLatestIncident();
  const mapsHref = incident
    ? `https://www.google.com/maps/dir/?api=1&destination=${incident.lat},${incident.lng}`
    : null;
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
              <h2 className="mt-2 text-xl font-semibold">
                {loading ? 'Loading…' : incident ? incident.id : 'No active alert'}
              </h2>
            </div>
            <StatusBadge
              label={incident ? 'ACTIVE' : 'IDLE'}
              tone={incident ? 'warning' : 'neutral'}
            />
          </div>
          <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
            <p className="flex gap-3">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              {incident
                ? (incident.address ?? `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}`)
                : (error ?? 'Location pending — no active incident yet.')}
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
          {mapsHref ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 min-h-11')}
            >
              <MapPin aria-hidden="true" />
              Open navigation
            </a>
          ) : (
            <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 min-h-11')}>
              Go to emergency home
            </Link>
          )}
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
  const { incident } = useLatestIncident();
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
          <Link
            href="/asha-audit"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 min-h-11')}
          >
            Review follow-up areas
          </Link>
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
          {incident && (
            <Link
              href={`/incidents/${incident.id}`}
              className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 min-h-9 text-xs')}
            >
              View latest incident
            </Link>
          )}
        </div>
      </section>
    </WorkspaceFrame>
  );
}
const STAKEHOLDER_COLUMNS: Array<{ key: keyof Stakeholder; label: string }> = [
  { key: 'name', label: 'ORGANIZATION' },
  { key: 'supportType', label: 'TYPE' },
  { key: 'role', label: 'ROLE' },
  { key: 'district', label: 'DISTRICT' },
];

export function StakeholderWorkspace() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    organization: '',
    role: '',
    support_type: '',
    district: '',
    contact: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  function loadStakeholders() {
    setLoading(true);
    setError(null);
    listStakeholders()
      .then(({ stakeholders: s }) => setStakeholders(s))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load stakeholders'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    listStakeholders()
      .then(({ stakeholders: s }) => {
        if (cancelled) return;
        setStakeholders(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load stakeholders');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = query.trim()
    ? stakeholders.filter((s) =>
        [s.name, s.organization, s.role, s.supportType, s.district]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query.trim().toLowerCase())),
      )
    : stakeholders;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMessage(null);
    try {
      await addStakeholder({
        name: form.name || form.organization,
        organization: form.organization,
        role: form.role || 'partner',
        support_type: form.support_type || 'COMMUNITY',
        district: form.district,
        contact: form.contact || undefined,
      });
      setShowForm(false);
      setForm({
        name: '',
        organization: '',
        role: '',
        support_type: '',
        district: '',
        contact: '',
      });
      setFormMessage('Stakeholder added.');
      loadStakeholders();
    } catch (e2) {
      setFormMessage(e2 instanceof Error ? e2.message : 'Add failed');
    } finally {
      setSubmitting(false);
    }
  }

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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <Button className="min-h-11" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {showForm ? 'Cancel' : 'Add stakeholder'}
        </Button>
      </div>

      {formMessage && <p className="mt-3 text-sm text-muted-foreground">{formMessage}</p>}

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <input
            required
            aria-label="Organization"
            placeholder="Organization *"
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
          />
          <input
            aria-label="Name"
            placeholder="Contact name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
          />
          <select
            aria-label="Support type"
            value={form.support_type}
            onChange={(e) => setForm({ ...form, support_type: e.target.value })}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
          >
            {['COMMUNITY', 'HOSPITAL', 'RESCUE', 'GOVERNMENT'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            required
            aria-label="District"
            placeholder="District *"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
          />
          <input
            aria-label="Contact"
            placeholder="Contact (phone / email)"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
          />
          <Button type="submit" disabled={submitting} className="min-h-11">
            {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submitting ? 'Adding…' : 'Add to registry'}
          </Button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-muted text-xs tracking-wide text-muted-foreground">
            <tr>
              {STAKEHOLDER_COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-3">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={STAKEHOLDER_COLUMNS.length} className="px-4 py-8 text-center">
                  Loading stakeholders…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={STAKEHOLDER_COLUMNS.length}
                  className="px-4 py-8 text-center text-destructive"
                >
                  {error}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={STAKEHOLDER_COLUMNS.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No stakeholders match.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  {STAKEHOLDER_COLUMNS.map((c, index) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-4',
                        index === 0 ? 'font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {String(s[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspaceFrame>
  );
}
export function AdminWorkspace() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [outbox, setOutbox] = useState<{
    pending: number;
    processed: number;
    failed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getStats(), getSystemAudit(), getOutbox()]).then(([s, a, o]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setStats(s.value);
      if (a.status === 'fulfilled') setAudit(a.value.events);
      if (o.status === 'fulfilled') setOutbox(o.value.summary);
      const failed = [s, a, o].filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        const reason = failed[0].status === 'rejected' ? failed[0].reason : null;
        setError(reason instanceof Error ? reason.message : 'Some system data could not be loaded');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WorkspaceFrame
      eyebrow="System / admin"
      title="What needs system oversight?"
      subtitle="System seams, audit trail, event outbox, knowledge-base inspection, and responder/stakeholder views."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">System overview</h2>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          {loading ? (
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="mt-4 grid gap-3 text-sm">
              <p className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Incident activity</span>
                <strong>{stats?.totals.incidents ?? '—'} records</strong>
              </p>
              <p className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Hospitals</span>
                <strong>{stats?.totals.hospitals ?? '—'}</strong>
              </p>
              <p className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground">Audit trail</span>
                <strong>{audit.length} recent events</strong>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Event outbox</span>
                <strong>
                  {outbox
                    ? `${outbox.pending} pending · ${outbox.processed} processed · ${outbox.failed} failed`
                    : '—'}
                </strong>
              </p>
            </div>
          )}
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
          {audit.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-muted text-xs tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 10).map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-4 font-semibold">{e.actor}</td>
                      <td className="px-4 py-4">{e.action}</td>
                      <td className="px-4 py-4 text-muted-foreground">{e.entity}</td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <IncidentTable />
          )}
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
