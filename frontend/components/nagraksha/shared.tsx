'use client';
/* eslint-disable security/detect-object-injection -- static presentation-only index maps */

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Clock3, CloudOff, Info, MapPin, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
const toneClasses: Record<Tone, string> = {
  success: 'border-primary/25 bg-secondary text-primary',
  warning: 'border-accent/40 bg-accent/10 text-foreground',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-primary/20 bg-secondary text-primary',
};

export function DemoModeBadge() {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-accent/45 bg-accent/10 px-3 text-[10px] font-bold tracking-[0.12em] text-foreground">
      DEMO MODE · LOCAL DATA
    </span>
  );
}
export function ConnectivityIndicator({
  state = 'online',
}: {
  state?: 'online' | 'offline' | 'limited';
}) {
  const config = {
    online: [Wifi, 'Online', 'text-primary'],
    offline: [CloudOff, 'Offline', 'text-destructive'],
    limited: [Wifi, 'Limited connection', 'text-foreground'],
  } as const;
  const [Icon, label, tone] = config[state];
  return (
    <span className={cn('inline-flex min-h-8 items-center gap-2 text-xs font-semibold', tone)}>
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'danger'
        ? AlertTriangle
        : tone === 'warning'
          ? Clock3
          : Info;
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold',
        toneClasses[tone],
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
export function StockFreshnessBadge({
  status,
  detail,
}: {
  status: 'confirmed' | 'stale' | 'unknown';
  detail: string;
}) {
  const tone = status === 'confirmed' ? 'success' : status === 'stale' ? 'warning' : 'danger';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <StatusBadge
        label={status === 'confirmed' ? 'AVAILABLE / VERIFIED' : status.toUpperCase()}
        tone={tone}
      />
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className="border-b border-border pb-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}
export function AlertBanner({
  title,
  children,
  tone = 'info',
}: {
  title: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={cn('flex gap-3 rounded-xl border p-4', toneClasses[tone])}>
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 opacity-90">{children}</p>
      </div>
    </div>
  );
}
export function RiskAdvisoryCard() {
  return (
    <section className="rounded-xl border border-accent/35 bg-accent/10 p-5">
      <div className="flex gap-3">
        <MapPin className="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-foreground">
            RISK ADVISORY · STATIC
          </p>
          <h3 className="mt-2 font-semibold">High activity reported in grassland areas</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Severity: elevated. Confidence: moderate. This is a local presentation, not a live risk
            calculation.
          </p>
        </div>
      </div>
    </section>
  );
}
export function HospitalRecommendationCard() {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-bold tracking-[0.12em] text-primary">HOSPITAL RECOMMENDATION</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">District Hospital A</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            ETA 18 min · static presentation value
          </p>
        </div>
        <StatusBadge label="CONFIRMED" tone="success" />
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <StockFreshnessBadge status="confirmed" detail="Verified 8 min ago" />
      </div>
      <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Alternative:</span> Hospital B · ETA 9 min ·
        stock UNKNOWN / STALE
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Stock status is not a guarantee of treatment availability.
      </p>
    </section>
  );
}
export function DispatchLane({
  title,
  status,
  eta,
}: {
  title: string;
  status: string;
  eta?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">Static presentation lane</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label={status} tone={status === 'ACCEPTED' ? 'success' : 'warning'} />
        {eta && <span className="text-xs font-semibold text-primary">ETA {eta}</span>}
      </div>
    </div>
  );
}
export function EmptyState({
  title = 'No active incidents',
  detail = 'Demo data — not connected to emergency services.',
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <Info className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Loading demo data">
      <div className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
      <div className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
      <div className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />
    </div>
  );
}
export function OfflineState() {
  return (
    <AlertBanner title="Offline — live incident updates unavailable" tone="warning">
      Emergency guidance remains available locally. Do not interpret this presentation state as a
      transmitted request.
    </AlertBanner>
  );
}
export function FirstAidChecklist() {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">First aid now</h3>
        <StatusBadge label="GUIDANCE" tone="info" />
      </div>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          Keep still and calm; immobilize the limb.
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          Remove rings, watches, or tight clothing near swelling.
        </li>
        <li className="flex gap-2">
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          Do not cut, suck, ice, tourniquet, or apply chemicals.
        </li>
      </ul>
    </section>
  );
}
export function IncidentTable({
  rows = ['NR-DEMO-1042', 'NR-DEMO-1038', 'NR-DEMO-1031'],
}: {
  rows?: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead className="bg-muted text-xs tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Incident</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">District</th>
            <th className="px-4 py-3">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row} className="border-t border-border">
              <td className="px-4 py-4 font-semibold">{row}</td>
              <td className="px-4 py-4">
                <StatusBadge
                  label={index === 0 ? 'ACTIVE DEMO' : 'CLOSED DEMO'}
                  tone={index === 0 ? 'warning' : 'neutral'}
                />
              </td>
              <td className="px-4 py-4 text-muted-foreground">Kasaragod</td>
              <td className="px-4 py-4 text-muted-foreground">{index + 2} min ago</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function RoleEmpty({ role }: { role: string }) {
  return (
    <EmptyState
      title={
        role === 'rescue'
          ? 'No additional rescue queue items'
          : `No ${role.toLowerCase()} queue items`
      }
    />
  );
}
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold tracking-[0.12em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function FeatureCard({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  action: string;
}) {
  return (
    <button
      type="button"
      className="group min-h-28 rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <p className="mt-4 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      <span className="mt-3 block text-xs font-semibold text-primary">{action} →</span>
    </button>
  );
}
export function LocalTimeline() {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="size-2.5 rounded-full bg-primary" />
        <span className="mt-1 h-8 w-px bg-border" />
      </div>
      <div>
        <p className="text-sm font-semibold">Demo acknowledgement</p>
        <p className="text-xs text-muted-foreground">Presentation state · local only</p>
      </div>
    </div>
  );
}
