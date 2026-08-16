'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import { getDistrictAudit, listAuditDistricts, type VillageAuditSummary } from '@/lib/nagraksha';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RISK_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MODERATE: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
};

export default function AshaAuditPage() {
  const [districts, setDistricts] = useState<{ district: string; gpCount: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [panchayats, setPanchayats] = useState<VillageAuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAuditDistricts()
      .then(({ districts: d }) => {
        if (cancelled) return;
        setDistricts(d);
        if (d.length > 0) setSelected(d[0].district);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load audit districts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    getDistrictAudit(selected)
      .then(({ gramPanchayats: g }) => {
        if (cancelled) return;
        setPanchayats(g);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load district audit');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ASHA Village Audit</h1>
          <p className="text-muted-foreground">
            Gram-panchayat risk profiles from household visits, aggregated per district.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'min-h-9')}>
          <ArrowLeft aria-hidden="true" />
          Back to emergency home
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {districts.map((d) => (
          <button
            key={d.district}
            type="button"
            onClick={() => {
              setPanchayats([]);
              setError(null);
              setSelected(d.district);
            }}
            aria-pressed={selected === d.district}
            className={cn(
              'min-h-9 rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              selected === d.district
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50',
            )}
          >
            {d.district} · {d.gpCount} GP
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading district audit…</p>}

      {!loading && !error && panchayats.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No audit data for this district yet. ASHA household visits will appear here.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {panchayats.map((gp) => (
          <section key={gp.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold">{gp.gramPanchayat}</h2>
                  <p className="text-xs text-muted-foreground">{gp.district}</p>
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold',
                  RISK_STYLES[gp.riskLabel ?? 'LOW'] ?? RISK_STYLES.LOW,
                )}
              >
                {gp.riskLabel ?? '—'}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
              {gp.householdsVisited} households visited
            </div>
            {gp.aggregateRiskScore != null && (
              <p className="mt-1 text-sm text-muted-foreground">
                Aggregate risk score:{' '}
                <strong className="text-foreground">{gp.aggregateRiskScore.toFixed(1)}</strong>
              </p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
