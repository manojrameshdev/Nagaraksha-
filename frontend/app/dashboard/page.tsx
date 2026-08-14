'use client';
import { useEffect, useState } from 'react';
import { getStats, listIncidents, type StatsResponse, type Incident } from '@/lib/nagraksha';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStats()
      .then((s) => {
        if (cancelled) return;
        setStats(s);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load stats');
      });
    listIncidents(10)
      .then(({ incidents: i }) => {
        if (cancelled) return;
        setIncidents(i);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load incidents');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {error && <p className="text-red-500">{error}</p>}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Incidents', value: stats.totals.incidents },
            { label: 'Hospitals', value: stats.totals.hospitals },
            { label: 'Risk Areas', value: stats.totals.riskAreas },
            { label: 'Myths Busted', value: stats.totals.mythsBusted },
            { label: 'Knowledge Chunks', value: stats.totals.knowledgeChunks },
            { label: 'Annual Deaths (India)', value: stats.annualDeathsIndia.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>
      )}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Incidents</h2>
        <div className="space-y-2">
          {incidents.map((inc) => (
            <Link
              key={inc.id}
              href={`/incidents/${inc.id}`}
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
            >
              <span className="text-sm font-mono truncate">{inc.id}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  inc.state === 'HANDED_OFF'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {inc.state}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
