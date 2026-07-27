'use client';

import { useEffect, useRef, useState } from 'react';

export type GeoLocation = {
  lat: number;
  lng: number;
  /** Human-readable address label, populated when reverse geocoding is available */
  label: string;
  /** 'gps' | 'default' */
  source: 'gps' | 'default';
};

/** Bannerghatta Forest Edge — fallback when geolocation is unavailable */
const DEFAULT: GeoLocation = {
  lat: 12.8003,
  lng: 77.5954,
  label: 'Bannerghatta Forest Edge, Bengaluru',
  source: 'default',
};

/**
 * useGeolocation — resolves the user's current GPS position on first call.
 *
 * - Requests `navigator.geolocation` immediately on mount.
 * - Falls back to DEFAULT coordinates if the browser denies or is unavailable.
 * - Returns `loading: true` until the first position/error is received.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!navigator?.geolocation) {
      // Defer to avoid sync setState-in-effect lint rule
      const timer = setTimeout(() => {
        setLoading(false);
        setError('Geolocation not supported by this browser');
      }, 0);
      return () => clearTimeout(timer);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        const { latitude, longitude } = pos.coords;
        const label = `GPS location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        setLocation({ lat: latitude, lng: longitude, label, source: 'gps' });
        setLoading(false);
      },
      (err) => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, []);

  return { location, loading, error };
}
