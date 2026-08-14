'use client';
import { useEffect, useState } from 'react';
import { useGeolocation } from '@/hooks/use-geolocation';
import { getHospitals, type Hospital } from '@/lib/nagraksha';
import { StockUpdate } from '@/components/stock-update';

const FALLBACK = { latitude: 12.8003, longitude: 77.5954 };

const STOCK_COLORS: Record<string, string> = {
  IN_STOCK: 'bg-green-100 text-green-700',
  LOW: 'bg-yellow-100 text-yellow-700',
  OUT_OF_STOCK: 'bg-red-100 text-red-700',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

export default function HospitalsPage() {
  const { coords, loading: geoLoading } = useGeolocation();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (geoLoading) return;
    const { latitude: lat, longitude: lng } = coords ?? FALLBACK;
    getHospitals(lat, lng)
      .then(({ hospitals: h }) => setHospitals(h))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load hospitals'))
      .finally(() => setLoading(false));
  }, [coords, geoLoading]);

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Nearest Hospitals</h1>
      {loading && <p className="text-muted-foreground">Locating nearest hospitals...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {hospitals.map((h) => (
        <div key={h.id} className="rounded-lg border p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold">{h.name}</h2>
              <p className="text-sm text-muted-foreground">{h.address}</p>
            </div>
            <span className="text-sm font-medium">{h.distanceKm?.toFixed(1)} km</span>
          </div>
          {h.stock && (
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                STOCK_COLORS[h.stock.status] ?? STOCK_COLORS.UNKNOWN
              }`}
            >
              {h.stock.status.replace('_', ' ')} — {h.stock.product}
            </span>
          )}
          {h.phone && (
            <a href={`tel:${h.phone}`} className="text-sm text-blue-600 underline block">
              {h.phone}
            </a>
          )}
          <StockUpdate hospitalId={h.id} />
        </div>
      ))}
    </main>
  );
}
