import { apiFetch } from './api';

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  phone: string;
  address: string;
  distanceKm: number;
  stock: {
    status: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW' | 'UNKNOWN';
    product: string;
    quantityBand: string;
    verifiedAt: string;
    verifiedBy: string;
  } | null;
}

export interface DispatchAttempt {
  id: string;
  incidentId: string;
  category: string;
  candidateName: string;
  candidateRole: string;
  distanceKm?: number;
  etaMin?: number;
  sequence: number;
  outcome: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  acceptedAt: string | null;
}

export interface SymptomObservation {
  id: string;
  incidentId: string;
  code: string;
  label: string;
  severity: string;
  value: string | null;
  observedAt: string;
  author: string;
}

export interface Incident {
  id: string;
  state: string;
  lat: number;
  lng: number;
  address: string | null;
  biteTime?: string | null;
  createdAt: string;
  updatedAt: string;
  dispatchAttempts: DispatchAttempt[];
  symptomObservations: SymptomObservation[];
  snakeObservations: unknown[];
}

export interface SosResponse {
  incident: Incident;
  ref: string;
  rankedHospitals: Hospital[];
  dispatchedAt: string;
  streamUrl: string;
  wsUrl: string;
  auditUrl: string;
}

export interface StatsResponse {
  totals: {
    incidents: number;
    hospitals: number;
    riskAreas: number;
    mythConversations: number;
    mythsBusted: number;
    knowledgeChunks: number;
  };
  incidentsByState: Record<string, number>;
  stockDistribution: Record<string, number>;
  incidentTrend14d: { date: string; count: number }[];
  annualDeathsIndia: number;
  parallelDispatchLanes: number;
}

export interface RiskResponse {
  area: string;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'UNKNOWN';
  score: number;
  weather: string;
  season: string;
  likelySnakes: string[];
  advisory: string;
  origin: { lat: number; lng: number };
}

export interface KnowledgeResult {
  id: string;
  docId: string;
  title: string;
  category: string;
  content?: string;
  score?: number;
}

export interface AuditEvent {
  id: string;
  incidentId: string | null;
  actor: string;
  action: string;
  entity: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface SymptomRequest {
  code: string;
  label: string;
  severity: string;
  value?: string;
  author?: string;
}

export interface StockUpdate {
  product: string;
  status: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LOW';
  quantityBand: string;
  verifiedBy: string;
}

// VenomScore
export interface PtosisReading {
  id: string;
  incidentId: string;
  timestamp: string;
  rightAperture: number;
  leftAperture: number;
  avgAperture: number;
  baselineAperture: number | null;
  percentChange: number | null;
  ptosisDetected: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  asymmetric: boolean;
  minutesSinceBite?: number;
}

export interface VenomScoreResult {
  venomType: 'NEUROTOXIC' | 'HEMOTOXIC' | 'DRY_BITE' | 'UNKNOWN';
  overallSeverity: number;
  dryBiteProbability: number;
  estimatedAntivenomVials: number;
  confidenceLevel: 'low' | 'moderate' | 'high';
  clinicalBasis: string;
  disclaimer: string;
  criticalAlert: string | null;
  ventilatorRequired: boolean;
  ptosisReadingCount: number;
  woundReadingCount: number;
  minutesSinceBite: number;
}

export interface SubmitPtosisResponse {
  id: string;
  venomScore: VenomScoreResult;
}

export const submitPtosisReading = (
  incidentId: string,
  reading: PtosisReading & { baselineAperture?: number | null },
) =>
  apiFetch<SubmitPtosisResponse>(`/api/venom-score/${incidentId}/reading`, {
    method: 'POST',
    body: JSON.stringify({
      right_aperture: reading.rightAperture,
      left_aperture: reading.leftAperture,
      avg_aperture: reading.avgAperture,
      baseline_aperture: reading.baselineAperture ?? null,
      percent_change: reading.percentChange ?? null,
      ptosis_detected: reading.ptosisDetected,
      severity: reading.severity,
      asymmetric: reading.asymmetric,
      minutes_since_bite: reading.minutesSinceBite,
    }),
  });

export const getVenomScore = async (incidentId: string) => {
  const res = await apiFetch<{ venomScore: VenomScoreResult }>(
    `/api/venom-score/${incidentId}/score`,
  );
  return res.venomScore;
};

// Health
export const getHealth = () =>
  apiFetch<{ ok: boolean; service: string; version: string }>('/api/health');

// SOS
export const triggerSos = (body: {
  lat: number;
  lng: number;
  address?: string;
  snake_description?: string;
}) => apiFetch<SosResponse>('/api/sos', { method: 'POST', body: JSON.stringify(body) });

// Incidents
export const listIncidents = (limit = 10) =>
  apiFetch<{ incidents: Incident[] }>(`/api/incidents?limit=${limit}`);
export const getIncident = (id: string) => apiFetch<{ incident: Incident }>(`/api/incidents/${id}`);
export const getIncidentAudit = (id: string) =>
  apiFetch<{ incident: Incident; audit: AuditEvent[]; outbox: unknown[] }>(
    `/api/incidents/${id}/audit`,
  );
export const logSymptom = (id: string, body: SymptomRequest) =>
  apiFetch<{ id: string; incidentId: string }>(`/api/incidents/${id}/symptoms`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const acceptDispatch = (id: string, category?: string) =>
  apiFetch<{ acceptedAttemptId: string }>(
    `/api/incidents/${id}/accept${category ? `?category=${encodeURIComponent(category)}` : ''}`,
    { method: 'PATCH', body: '{}' },
  );
export const declineDispatch = (id: string, category?: string) =>
  apiFetch<{ declinedAttemptId: string }>(
    `/api/incidents/${id}/decline${category ? `?category=${encodeURIComponent(category)}` : ''}`,
    { method: 'PATCH', body: '{}' },
  );

// Hospitals
export const getHospitals = (lat: number, lng: number) =>
  apiFetch<{ hospitals: Hospital[]; origin: { lat: number; lng: number } }>(
    `/api/hospitals?lat=${lat}&lng=${lng}`,
  );
export const updateStock = (hid: string, body: StockUpdate) =>
  apiFetch<unknown>(`/api/hospitals/${hid}/stock`, { method: 'PATCH', body: JSON.stringify(body) });

// Risk, Stats, Audit, Knowledge
export const getRisk = (lat: number, lng: number) =>
  apiFetch<RiskResponse>(`/api/risk?lat=${lat}&lng=${lng}`);
export const getStats = () => apiFetch<StatsResponse>('/api/stats');
export const getSystemAudit = () =>
  apiFetch<{ count: number; byAction: Record<string, number>; events: AuditEvent[] }>('/api/audit');
export const getKnowledgeBase = (q: string, k = 4) =>
  apiFetch<{ query: string; results: KnowledgeResult[] }>(
    `/api/knowledge-base?q=${encodeURIComponent(q)}&k=${k}`,
  );

// Auth
export const getAuthToken = (role: string, secret: string) =>
  apiFetch<{ token: string; role: string }>('/api/auth/token', {
    method: 'POST',
    body: JSON.stringify({ role, secret }),
  });

// ── Care Corridor / Capability-Aware Referral ───────────────────────────

export type FacilityCapability =
  'ASV' | 'OXYGEN' | 'VENTILATION' | 'ICU' | 'BLOOD_BANK' | 'DIALYSIS' | 'EMERGENCY_CARE';

export type FacilityLevel = 'PHC' | 'CHC' | 'SDH' | 'DH' | 'TERTIARY';

export interface CapabilityGapResult {
  referral_required: boolean;
  required_capabilities: FacilityCapability[];
  missing_capabilities: FacilityCapability[];
  clinical_reasons: string[];
  urgency: 'CRITICAL_IMMEDIATE' | 'HIGH_PRIORITY' | 'ROUTINE';
  current_facility_level: string;
  guideline_ref: string;
}

export interface Referral {
  id: string;
  incidentId: string;
  fromHospitalId: string;
  toHospitalId: string;
  toHospitalName?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED';
  urgency: 'CRITICAL_IMMEDIATE' | 'HIGH_PRIORITY' | 'ROUTINE';
  missingCapabilities: FacilityCapability[];
  clinicalReason: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  declinedAt?: string | null;
  declinedReason?: string | null;
  transportStartedAt?: string | null;
  arrivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CorridorStage {
  index: number;
  stageKey: string;
  title: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DECLINED';
  timestamp?: string;
  details?: string;
  facilityName?: string;
  facilityLevel?: string;
  capabilities?: string[];
  ptosisSeverity?: string;
  percentChange?: number | null;
  woundProgression?: string;
  missingCapabilities?: string[];
  urgency?: string;
  clinicalReason?: string | null;
  destinationHospitalName?: string | null;
  destinationLevel?: string | null;
  ventilatorCount?: number;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  declinedReason?: string | null;
  transportStartedAt?: string | null;
  arrivedAt?: string | null;
}

export interface CareCorridorTimeline {
  incidentId: string;
  presentingHospital?: Hospital | null;
  activeReferral?: Referral | null;
  destinationHospital?: Hospital | null;
  stages: CorridorStage[];
}

export const evaluateReferral = (incidentId: string) =>
  apiFetch<{
    incidentId: string;
    presentingHospital: Hospital | null;
    capabilityGap: CapabilityGapResult;
    recommendedHospital: Hospital | null;
    eligibleHospitals: Hospital[];
    allHospitals: Hospital[];
  }>(`/api/incidents/${incidentId}/evaluate-referral`, {
    method: 'POST',
    body: '{}',
  });

export const createReferral = (
  incidentId: string,
  body: {
    fromHospitalId: string;
    toHospitalId: string;
    missingCapabilities: FacilityCapability[];
    clinicalReason: string;
    urgency?: 'CRITICAL_IMMEDIATE' | 'HIGH_PRIORITY' | 'ROUTINE';
  },
) =>
  apiFetch<Referral>(`/api/incidents/${incidentId}/referrals`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const listIncidentReferrals = (incidentId: string) =>
  apiFetch<{ referrals: Referral[] }>(`/api/incidents/${incidentId}/referrals`);

export const acceptReferral = (
  referralId: string,
  body: { acceptedBy?: string; notes?: string } = {},
) =>
  apiFetch<{ referralId: string; status: string; acceptedAt: string; acceptedBy?: string }>(
    `/api/referrals/${referralId}/accept`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );

export const declineReferral = (
  referralId: string,
  body: { declinedBy?: string; reason: string },
) =>
  apiFetch<{ referralId: string; status: string; declinedAt: string; declinedReason: string }>(
    `/api/referrals/${referralId}/decline`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );

export const startTransport = (referralId: string) =>
  apiFetch<{ referralId: string; status: string; transportStartedAt: string }>(
    `/api/referrals/${referralId}/transport`,
    {
      method: 'PATCH',
      body: '{}',
    },
  );

export const confirmArrival = (referralId: string) =>
  apiFetch<{ referralId: string; status: string; arrivedAt: string }>(
    `/api/referrals/${referralId}/arrive`,
    {
      method: 'PATCH',
      body: '{}',
    },
  );

export const getCorridorTimeline = (incidentId: string) =>
  apiFetch<CareCorridorTimeline>(`/api/incidents/${incidentId}/corridor`);
