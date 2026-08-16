'use client';
import { useEffect, useState } from 'react';
import { listIncidents, type Incident } from '@/lib/nagraksha';

interface LatestIncidentState {
  incident: Incident | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the most recent incident from the backend (used by the Responder,
 * Rescue and ASHA role workspaces so their actions target a real incident).
 */
export function useLatestIncident(): LatestIncidentState {
  const [state, setState] = useState<LatestIncidentState>({
    incident: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    listIncidents(1)
      .then(({ incidents }) => {
        if (cancelled) return;
        setState({ incident: incidents[0] ?? null, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({
          incident: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load latest incident',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
