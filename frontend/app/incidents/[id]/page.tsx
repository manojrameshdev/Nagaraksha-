'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useIncidentSocket } from '@/hooks/use-incident-socket';
import { useSosStore } from '@/store/sos-store';
import { getIncident } from '@/lib/nagraksha';

export default function IncidentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const incident = useSosStore((s) => s.incident);
  const dispatchLanes = useSosStore((s) => s.dispatchLanes);
  const wsConnected = useSosStore((s) => s.wsConnected);
  const setIncident = useSosStore((s) => s.setIncident);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useIncidentSocket(id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getIncident(id)
      .then(({ incident: fetched }) => {
        if (cancelled) return;
        setIncident(fetched);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load incident');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, setIncident]);

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Failed to load incident</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (loading && !incident) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading incident...</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">SOS Active</h1>
        <span
          className={`text-sm px-2 py-1 rounded-full ${
            wsConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {wsConnected ? '● Live' : '◌ Reconnecting...'}
        </span>
      </div>

      {incident && (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Incident State</p>
          <p className="text-lg font-semibold">{incident.state}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {incident.address ?? `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}`}
          </p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Dispatch Lanes</h2>
        <div className="space-y-3">
          {dispatchLanes.length === 0 && <p className="text-muted-foreground">Dispatching...</p>}
          {dispatchLanes.map((lane) => (
            <div key={lane.id} className="rounded-lg border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{lane.category}</p>
                <p className="text-sm text-muted-foreground">{lane.target}</p>
              </div>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  lane.outcome === 'ACCEPTED'
                    ? 'bg-green-100 text-green-700'
                    : lane.outcome === 'DECLINED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {lane.outcome}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
