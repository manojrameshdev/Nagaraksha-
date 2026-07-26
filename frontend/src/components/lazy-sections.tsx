'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * LazySections — code-splits the heavy below-fold sections into separate
 * client-only chunks (ssr: false). This keeps the initial server-side page
 * compile small (only hero + above-fold), so Turbopack dev doesn't OOM the
 * sandbox. The heavy sections compile lazily on the client after hydration.
 */
const Architecture = dynamic(
  () => import('@/components/architecture').then((m) => m.Architecture),
  { ssr: false },
);
const LiveSosDemo = dynamic(() => import('@/components/interactive').then((m) => m.LiveSosDemo), {
  ssr: false,
});
const AuditTrailPanel = dynamic(
  () => import('@/components/interactive').then((m) => m.AuditTrailPanel),
  { ssr: false },
);
const OutboxPanel = dynamic(() => import('@/components/interactive').then((m) => m.OutboxPanel), {
  ssr: false,
});
const KnowledgeBasePanel = dynamic(
  () => import('@/components/interactive').then((m) => m.KnowledgeBasePanel),
  { ssr: false },
);
const StatsStrip = dynamic(() => import('@/components/interactive').then((m) => m.StatsStrip), {
  ssr: false,
});
const RiskPanel = dynamic(() => import('@/components/interactive').then((m) => m.RiskPanel), {
  ssr: false,
});
const SnakeId = dynamic(() => import('@/components/interactive').then((m) => m.SnakeId), {
  ssr: false,
});
const MythBuster = dynamic(() => import('@/components/interactive').then((m) => m.MythBuster), {
  ssr: false,
});

function Fallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-gold" />
      Loading {label}…
    </div>
  );
}

export function LazyArchitecture() {
  return (
    <Suspense fallback={<Fallback label="architecture" />}>
      <Architecture />
    </Suspense>
  );
}

export function LazyLiveSosDemo() {
  return (
    <Suspense fallback={<Fallback label="live SOS demo" />}>
      <LiveSosDemo />
    </Suspense>
  );
}

export function LazyBackendPanels() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Suspense fallback={<Fallback label="audit trail" />}>
        <AuditTrailPanel />
      </Suspense>
      <Suspense fallback={<Fallback label="outbox" />}>
        <OutboxPanel />
      </Suspense>
    </div>
  );
}

export function LazyKnowledgeBase() {
  return (
    <Suspense fallback={<Fallback label="knowledge base" />}>
      <KnowledgeBasePanel />
    </Suspense>
  );
}

export function LazyStatsStrip() {
  return (
    <Suspense fallback={<Fallback label="analytics" />}>
      <StatsStrip />
    </Suspense>
  );
}

export function LazyRiskPanel() {
  return (
    <Suspense fallback={<Fallback label="risk advisory" />}>
      <RiskPanel />
    </Suspense>
  );
}

export function LazySnakeId() {
  return (
    <Suspense fallback={<Fallback label="snake ID" />}>
      <SnakeId />
    </Suspense>
  );
}

export function LazyMythBuster() {
  return (
    <Suspense fallback={<Fallback label="myth buster" />}>
      <MythBuster />
    </Suspense>
  );
}
