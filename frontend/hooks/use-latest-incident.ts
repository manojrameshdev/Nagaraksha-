'use client';
import { useEffect, useState } from 'react';
import { getIncident, listIncidents, type Incident } from '@/lib/nagraksha';

interface LatestIncidentState {
  incident: Incident | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the most recent incident from the backend (used by the Responder,
 * Rescue and ASHA role workspaces so their actions target a real incident).
 *
 * `GET /api/incidents` returns slim rows (id, state, lat, lng, address, …)
 * without nested arrays, so after picking the latest id we re-fetch the full
 * incident via `GET /api/incidents/{id}` — consumers read
 * `symptomObservations`/`dispatchAttempts`. Falls back to the slim row if the
 * detail fetch fails so the workspace still renders with basic data.
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
        const slim = incidents[0];
        if (!slim) {
          setState({ incident: null, loading: false, error: null });
          return;
        }
        // Upgrade to the full incident so nested arrays are available.
        getIncident(slim.id)
          .then(({ incident }) => {
            if (cancelled) return;
            setState({ incident, loading: false, error: null });
          })
          .catch(() => {
            if (cancelled) return;
            setState({ incident: slim, loading: false, error: null });
          });
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
