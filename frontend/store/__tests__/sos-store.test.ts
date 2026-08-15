import { describe, it, expect, afterEach } from 'vitest';
import { useSosStore } from '../sos-store';
import type { VenomScoreResult, PtosisReading } from '@/lib/nagraksha';

const venomScore: VenomScoreResult = {
  venomType: 'NEUROTOXIC',
  overallSeverity: 62,
  dryBiteProbability: 0.1,
  estimatedAntivenomVials: 8,
  confidenceLevel: 'moderate',
  clinicalBasis: 'WHO 2016 Table 3',
  disclaimer: 'Confirm with 20WBCT',
  criticalAlert: 'Respiratory depression risk — monitor breathing',
  ventilatorRequired: true,
  ptosisReadingCount: 3,
  woundReadingCount: 0,
  minutesSinceBite: 30,
};

const reading: PtosisReading = {
  id: 'r-1',
  incidentId: 'inc-1',
  timestamp: '2026-08-15T00:00:00.000Z',
  rightAperture: 0.1,
  leftAperture: 0.12,
  avgAperture: 0.11,
  baselineAperture: 0.3,
  percentChange: 63.3,
  ptosisDetected: true,
  severity: 'moderate',
  asymmetric: false,
  minutesSinceBite: 12,
};

describe('sos-store venom score state', () => {
  afterEach(() => {
    useSosStore.getState().reset();
  });

  it('updateFromWsEvent VENOM_SCORE_UPDATE sets venomScore from data.venomScore', () => {
    useSosStore.getState().updateFromWsEvent({
      event: 'VENOM_SCORE_UPDATE',
      data: { venomScore },
    });
    expect(useSosStore.getState().venomScore).toEqual(venomScore);
  });

  it('addPtosisReading appends to ptosisReadings', () => {
    useSosStore.getState().addPtosisReading(reading);
    expect(useSosStore.getState().ptosisReadings).toHaveLength(1);
    expect(useSosStore.getState().ptosisReadings[0].id).toBe('r-1');

    useSosStore.getState().addPtosisReading({ ...reading, id: 'r-2' });
    expect(useSosStore.getState().ptosisReadings).toHaveLength(2);
    expect(useSosStore.getState().ptosisReadings[1].id).toBe('r-2');
  });

  it('setVenomScore(null) clears venomScore', () => {
    useSosStore.getState().setVenomScore(venomScore);
    expect(useSosStore.getState().venomScore).toEqual(venomScore);

    useSosStore.getState().setVenomScore(null);
    expect(useSosStore.getState().venomScore).toBeNull();
  });
});
