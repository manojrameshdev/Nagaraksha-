'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useIncidentSocket } from '@/hooks/use-incident-socket';
import { useSosStore } from '@/store/sos-store';
import { getIncident } from '@/lib/nagraksha';
import { DispatchActions } from '@/components/dispatch-actions';
import { SymptomLogger } from '@/components/symptom-logger';

// WASM model is browser-only — load the VenomScore camera component on the
// client only (never SSR'd, never statically bundled).
const VenomScore = dynamic(() => import('@/components/venom-score'), { ssr: false });

export default function IncidentPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const incident = useSosStore((s) => s.incident);
  const dispatchLanes = useSosStore((s) => s.dispatchLanes);
  const wsConnected = useSosStore((s) => s.wsConnected);
  const venomScore = useSosStore((s) => s.venomScore);
  const setIncident = useSosStore((s) => s.setIncident);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Demo role switch via ?role=hospital. SSR-safe lazy initializer (window
  // only accessed on the client; server and first client render both show the
  // loading branch, so no hydration mismatch) — the react-hooks
  // set-state-in-effect gate forbids a synchronous setState in a mount effect.
  const [role] = useState<'victim' | 'hospital'>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('role') === 'hospital'
      ? 'hospital'
      : 'victim',
  );

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

  function refreshIncident() {
    if (!id) return;
    getIncident(id)
      .then(({ incident: fetched }) => setIncident(fetched))
      .catch(() => {
        /* store keeps last known state */
      });
  }

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
                <p className="text-sm text-muted-foreground">
                  {lane.candidateName || 'Responder pending'}
                </p>
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

      <DispatchActions incidentId={id} onAction={refreshIncident} />
      <SymptomLogger incidentId={id} onLogged={refreshIncident} />

      {role === 'hospital' ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold mb-3">VenomScore Pre-arrival Assessment</h2>
          {venomScore === null ? (
            <p className="text-muted-foreground">Awaiting VenomScore data…</p>
          ) : (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Venom Type</p>
                  <p className="text-lg font-bold">{venomScore.venomType}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Antivenom</p>
                  <p className="text-3xl font-bold text-red-600">
                    {venomScore.estimatedAntivenomVials} vials
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Dry bite probability</p>
                  <p className="font-semibold">
                    {Math.round(venomScore.dryBiteProbability * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confidence</p>
                  <p className="font-semibold capitalize">{venomScore.confidenceLevel}</p>
                </div>
              </div>
              {venomScore.criticalAlert && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {venomScore.criticalAlert}
                </div>
              )}
              {venomScore.ventilatorRequired && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  VENTILATOR STANDBY REQUIRED
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Clinical basis:</span>{' '}
                {venomScore.clinicalBasis}
              </p>
              <p className="text-xs text-muted-foreground">{venomScore.disclaimer}</p>
            </div>
          )}
          {/* The static HospitalWorkspace (components/nagraksha/workspaces.tsx)
              remains the compliance/stock demo surface and is intentionally NOT
              wired to live data — this live packet is the ?role=hospital surface. */}
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold mb-3">VenomScore Tracking</h2>
          <VenomScore
            incidentId={id}
            biteTimestamp={incident?.biteTime ?? new Date().toISOString()}
          />
        </section>
      )}
    </main>
  );
}
