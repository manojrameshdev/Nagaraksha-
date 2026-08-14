'use client';
import { useEffect, useState } from 'react';
import { getRisk, type RiskResponse } from '@/lib/nagraksha';
import { useGeolocation } from '@/hooks/use-geolocation';

const LEVEL_STYLES = {
  LOW: 'bg-green-100 text-green-700',
  MODERATE: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  SEVERE: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

export default function RiskPage() {
  const { coords, loading: geoLoading } = useGeolocation();
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (geoLoading) return;
    const lat = coords?.latitude ?? 12.8003;
    const lng = coords?.longitude ?? 77.5954;
    getRisk(lat, lng)
      .then(setRisk)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load risk assessment'));
  }, [coords, geoLoading]);

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Risk Advisory</h1>
      {error && <p className="text-red-500">{error}</p>}
      {risk ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-bold px-3 py-1 rounded-full ${
                LEVEL_STYLES[risk.level] ?? LEVEL_STYLES.UNKNOWN
              }`}
            >
              {risk.level}
            </span>
            <span className="text-sm text-muted-foreground">{risk.area}</span>
          </div>
          <p className="text-base">{risk.advisory}</p>
          {risk.likelySnakes.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1">Likely Snakes</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {risk.likelySnakes.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Season: {risk.season} · Weather: {risk.weather}
          </p>
        </div>
      ) : (
        !error && <p className="text-muted-foreground">Loading risk assessment...</p>
      )}
    </main>
  );
}
