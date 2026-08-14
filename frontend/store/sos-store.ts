import { create } from 'zustand';
import type { Incident, DispatchAttempt, SosResponse } from '@/lib/nagraksha';
import { triggerSos as apiTriggerSos, getIncident } from '@/lib/nagraksha';
import type { IncidentSocketEvent } from '@/lib/realtime';

interface SosState {
  incidentId: string | null;
  incident: Incident | null;
  dispatchLanes: DispatchAttempt[];
  wsConnected: boolean;
  sosLoading: boolean;
  sosError: string | null;
}

interface SosActions {
  triggerSos: (_lat: number, _lng: number, _address?: string) => Promise<string | null>;
  setIncident: (_incident: Incident) => void;
  updateFromWsEvent: (_e: IncidentSocketEvent) => void;
  setWsConnected: (_connected: boolean) => void;
  reset: () => void;
}

const initialState: SosState = {
  incidentId: null,
  incident: null,
  dispatchLanes: [],
  wsConnected: false,
  sosLoading: false,
  sosError: null,
};

export const useSosStore = create<SosState & SosActions>((set, get) => ({
  ...initialState,

  triggerSos: async (lat, lng, address) => {
    set({ sosLoading: true, sosError: null });
    try {
      const res: SosResponse = await apiTriggerSos({ lat, lng, address });
      set({
        incidentId: res.incident.id,
        dispatchLanes: res.incident.dispatchAttempts,
        sosLoading: false,
      });
      return res.incident.id;
    } catch (e) {
      set({ sosError: e instanceof Error ? e.message : 'SOS failed', sosLoading: false });
      return null;
    }
  },

  setIncident: (incident) => set({ incident, dispatchLanes: incident.dispatchAttempts }),

  updateFromWsEvent: ({ event, data }) => {
    if (event === 'dispatch_attempted' || event === 'dispatch_accepted') {
      // The WS payload uses attemptId (backend row id) and candidateName/candidateRole;
      // map it onto the DispatchAttempt shape before merging.
      const raw = data as Record<string, unknown>;
      const attempt: DispatchAttempt = {
        id: (raw.attemptId as string) ?? '',
        incidentId: (raw.incidentId as string) ?? '',
        category: (raw.category as string) ?? '',
        candidateName: (raw.candidateName as string) ?? '',
        candidateRole: (raw.candidateRole as string) ?? '',
        distanceKm: (raw.distanceKm as number) ?? undefined,
        etaMin: (raw.etaMin as number) ?? undefined,
        sequence: (raw.sequence as number) ?? 0,
        outcome: event === 'dispatch_accepted' ? 'ACCEPTED' : 'PENDING',
        acceptedAt: (raw.acceptedAt as string) ?? null,
      };
      set((state) => ({
        dispatchLanes: state.dispatchLanes.some((l) => l.id === attempt.id)
          ? state.dispatchLanes.map((l) => (l.id === attempt.id ? { ...l, ...attempt } : l))
          : [...state.dispatchLanes, attempt],
      }));
    } else if (event === 'incident_state') {
      set((state) =>
        state.incident
          ? { incident: { ...state.incident, state: (data as { state: string }).state } }
          : {},
      );
    }
    // Refresh full incident after any event for consistency
    const { incidentId } = get();
    if (incidentId) {
      getIncident(incidentId)
        .then(({ incident }) => set({ incident, dispatchLanes: incident.dispatchAttempts }))
        .catch(() => {
          /* silent */
        });
    }
  },

  setWsConnected: (connected) => set({ wsConnected: connected }),
  reset: () => set(initialState),
}));
