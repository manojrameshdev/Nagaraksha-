'use client';
import { useState, useEffect } from 'react';

interface GeolocationState {
  coords: { latitude: number; longitude: number } | null;
  error: string | null;
  loading: boolean;
}

const GEOLOCATION_SUPPORTED = typeof window !== 'undefined' && 'geolocation' in navigator;

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>(() =>
    GEOLOCATION_SUPPORTED
      ? { coords: null, error: null, loading: true }
      : { coords: null, error: 'Geolocation is not supported', loading: false },
  );

  useEffect(() => {
    if (!GEOLOCATION_SUPPORTED) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          error: null,
          loading: false,
        }),
      (err) => setState({ coords: null, error: err.message, loading: false }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  return state;
}
