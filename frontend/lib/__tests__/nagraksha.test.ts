import { describe, it, expect } from 'vitest';
import { getHealth, triggerSos, getHospitals, getAuthToken, getStats } from '../nagraksha';

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
});
