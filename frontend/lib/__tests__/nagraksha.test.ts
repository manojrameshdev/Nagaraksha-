import { describe, it, expect } from 'vitest';
import {
  getHealth,
  triggerSos,
  getHospitals,
  getAuthToken,
  getStats,
  submitPtosisReading,
  getVenomScore,
} from '../nagraksha';

describe('NagRaksha API Integration', () => {
  it('getHealth returns ok:true', async () => {
    const result = await getHealth();
    expect(result.ok).toBe(true);
    expect(result.service).toBe('nagraksha-backend');
  });

  it('triggerSos returns the incident with 3 dispatch lanes', async () => {
    const result = await triggerSos({ lat: 12.8003, lng: 77.5954 });
    expect(result.incident.id).toBe('mock-incident-id-123');
    expect(result.incident.dispatchAttempts).toHaveLength(3);
    expect(result.incident.dispatchAttempts[0].outcome).toBe('PENDING');
    expect(result.wsUrl).toBe('/ws/incidents/mock-incident-id-123');
  });

  it('getHospitals returns ranked hospital list', async () => {
    const result = await getHospitals(12.8003, 77.5954);
    expect(result.hospitals).toHaveLength(1);
    expect(result.hospitals[0].stock?.status).toBe('IN_STOCK');
  });

  it('getAuthToken returns JWT for valid victim credentials', async () => {
    const result = await getAuthToken('victim', 'victim-demo');
    expect(result.token).toBe('mock-jwt-token');
    expect(result.role).toBe('victim');
  });

  it('getStats returns totals with expected shape', async () => {
    const result = await getStats();
    expect(result.totals.incidents).toBeGreaterThanOrEqual(0);
    expect(result.incidentTrend14d).toHaveLength(14);
    expect(result.parallelDispatchLanes).toBe(3);
  });

  it('getAuthToken throws ApiError for invalid credentials', async () => {
    const { ApiError } = await import('../api');
    await expect(getAuthToken('admin', 'wrong')).rejects.toThrow(ApiError);
  });

  it('submitPtosisReading resolves a typed SubmitPtosisResponse', async () => {
    const result = await submitPtosisReading('mock-incident-id-123', {
      id: 'local-1',
      incidentId: 'mock-incident-id-123',
      timestamp: new Date().toISOString(),
      rightAperture: 0.1,
      leftAperture: 0.12,
      avgAperture: 0.11,
      baselineAperture: 0.3,
      percentChange: 63.3,
      ptosisDetected: true,
      severity: 'moderate',
      asymmetric: false,
      minutesSinceBite: 12,
    });
    expect(result.id).toBe('ptosis-reading-001');
    expect(result.venomScore.venomType).toBe('UNKNOWN');
    expect(result.venomScore.estimatedAntivenomVials).toBe(10);
  });

  it('getVenomScore returns a typed score shape', async () => {
    const score = await getVenomScore('mock-incident-id-123');
    expect(score.venomType).toBe('UNKNOWN');
    expect(score.estimatedAntivenomVials).toBe(10);
    expect(score.clinicalBasis).toBe('WHO 2016 Table 3');
  });

  it('getCorridorTimeline returns 8 stages with capability gap', async () => {
    const { getCorridorTimeline } = await import('../nagraksha');
    const timeline = await getCorridorTimeline('mock-incident-id-123');
    expect(timeline.stages).toHaveLength(8);
    expect(timeline.presentingHospital?.name).toBe('Malavalli Taluk PHC');
    expect(timeline.activeReferral?.status).toBe('PENDING');
  });

  it('evaluateReferral returns required capabilities and recommended hospital', async () => {
    const { evaluateReferral } = await import('../nagraksha');
    const res = await evaluateReferral('mock-incident-id-123');
    expect(res.capabilityGap.referral_required).toBe(true);
    expect(res.capabilityGap.missing_capabilities).toContain('VENTILATION');
    expect(res.recommendedHospital?.name).toBe('Mandya District Hospital');
  });

  it('acceptReferral returns accepted status', async () => {
    const { acceptReferral } = await import('../nagraksha');
    const res = await acceptReferral('ref-mock-001');
    expect(res.status).toBe('ACCEPTED');
    expect(res.acceptedBy).toBe('Dr. Ramesh (Mandya DH)');
  });
});
