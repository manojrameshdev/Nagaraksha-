import { create } from 'zustand';

export interface IncidentData {
  id: string;
  ref: string;
  lat: number;
  lng: number;
  biteTime?: string;
  bodyPart?: string;
  snakeType?: string;
  state?: string;
  dispatchedAt?: string;
  rankedHospitals?: any[];
  dispatchAttempts?: any[];
  symptomObservations?: any[];
}

export interface WoundReading {
  id: string;
  timestamp: string;
  swellingAreaPx: number;
  severityScore: number;
  progression: string;
  estimatedVenomSpreadCm?: number;
  recommendedAntivenomVials?: number;
  notes?: string;
}

export interface SosState {
  phase: 'idle' | 'reporting' | 'dispatched' | 'handed_off';
  activeIncidentId: string | null;
  incidentData: IncidentData | null;
  lanes: {
    firstAider: any[];
    snakeRescue: any[];
    hospitalCoordinator: any[];
  };
  woundReadings: WoundReading[];
  latestSeverityScore: number | null;
  latestSeverityTrend: string | null;
  recommendedAntivenomVials: number | null;
  isWsConnected: boolean;

  // Actions
  setPhase: (phase: SosState['phase']) => void;
  setActiveIncident: (id: string, data?: Partial<IncidentData>) => void;
  updateIncidentData: (data: Partial<IncidentData>) => void;
  setLanes: (lanes: SosState['lanes']) => void;
  updateLaneAcceptance: (responderPhoneOrName: string, category: string) => void;
  addWoundReading: (reading: WoundReading) => void;
  setSeverityInfo: (score: number, trend: string, vials?: number) => void;
  setWsConnected: (connected: boolean) => void;
  resetSos: () => void;
}

export const useSosStore = create<SosState>((set) => ({
  phase: 'idle',
  activeIncidentId: null,
  incidentData: null,
  lanes: {
    firstAider: [],
    snakeRescue: [],
    hospitalCoordinator: [],
  },
  woundReadings: [],
  latestSeverityScore: null,
  latestSeverityTrend: null,
  recommendedAntivenomVials: null,
  isWsConnected: false,

  setPhase: (phase) => set({ phase }),

  setActiveIncident: (id, data) =>
    set((state) => ({
      activeIncidentId: id,
      phase: 'dispatched',
      incidentData: state.incidentData ? { ...state.incidentData, ...data, id } : ({ id, ref: '', lat: 12.8, lng: 77.6, ...data } as IncidentData),
    })),

  updateIncidentData: (data) =>
    set((state) => ({
      incidentData: state.incidentData ? { ...state.incidentData, ...data } : null,
    })),

  setLanes: (lanes) => set({ lanes }),

  updateLaneAcceptance: (identifier, category) =>
    set((state) => {
      const updateList = (list: any[]) =>
        list.map((item) => {
          if (item.name === identifier || item.phone === identifier) {
            return { ...item, accept: true, acceptedAt: Date.now() };
          }
          return item;
        });

      return {
        lanes: {
          firstAider: category === 'TRAINED' ? updateList(state.lanes.firstAider) : state.lanes.firstAider,
          snakeRescue: category === 'RESCUE' ? updateList(state.lanes.snakeRescue) : state.lanes.snakeRescue,
          hospitalCoordinator: category === 'AMBULANCE' ? updateList(state.lanes.hospitalCoordinator) : state.lanes.hospitalCoordinator,
        },
      };
    }),

  addWoundReading: (reading) =>
    set((state) => ({
      woundReadings: [...state.woundReadings, reading],
      latestSeverityScore: reading.severityScore,
      latestSeverityTrend: reading.progression,
      recommendedAntivenomVials: reading.recommendedAntivenomVials ?? state.recommendedAntivenomVials,
    })),

  setSeverityInfo: (score, trend, vials) =>
    set((state) => ({
      latestSeverityScore: score,
      latestSeverityTrend: trend,
      recommendedAntivenomVials: vials ?? state.recommendedAntivenomVials,
    })),

  setWsConnected: (connected) => set({ isWsConnected: connected }),

  resetSos: () =>
    set({
      phase: 'idle',
      activeIncidentId: null,
      incidentData: null,
      lanes: { firstAider: [], snakeRescue: [], hospitalCoordinator: [] },
      woundReadings: [],
      latestSeverityScore: null,
      latestSeverityTrend: null,
      recommendedAntivenomVials: null,
      isWsConnected: false,
    }),
}));
