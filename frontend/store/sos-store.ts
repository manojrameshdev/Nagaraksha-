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
      set({ incidentId: res.incidentId, dispatchLanes: res.lanes, sosLoading: false });
      return res.incidentId;
    } catch (e) {
      set({ sosError: e instanceof Error ? e.message : 'SOS failed', sosLoading: false });
      return null;
    }
  },

  setIncident: (incident) => set({ incident, dispatchLanes: incident.dispatchAttempts }),

  updateFromWsEvent: ({ event, data }) => {
    if (event === 'dispatch_attempted' || event === 'dispatch_accepted') {
      // Reload dispatch attempts from the full incident or merge the incoming attempt
      const attempt = data as unknown as DispatchAttempt;
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
