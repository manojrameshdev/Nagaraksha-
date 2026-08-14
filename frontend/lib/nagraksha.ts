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
  target: string;
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
  createdAt: string;
  updatedAt: string;
  dispatchAttempts: DispatchAttempt[];
  symptomObservations: SymptomObservation[];
  snakeObservations: unknown[];
}

export interface SosResponse {
  incidentId: string;
  lanes: DispatchAttempt[];
  hospitals: Hospital[];
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
export const acceptDispatch = (id: string) =>
  apiFetch<{ acceptedAttemptId: string }>(`/api/incidents/${id}/accept`, {
    method: 'PATCH',
    body: '{}',
  });
export const declineDispatch = (id: string) =>
  apiFetch<{ declinedAttemptId: string }>(`/api/incidents/${id}/decline`, {
    method: 'PATCH',
    body: '{}',
  });

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
