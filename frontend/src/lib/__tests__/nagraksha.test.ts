import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  roadKm,
  etaMin,
  minsAgo,
  stockFreshness,
  rankHospitals,
} from '../nagraksha';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  it('returns a positive distance for different points', () => {
    const dist = haversineKm(12.97, 77.59, 13.03, 77.56);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('roadKm', () => {
  it('multiplies straight-line distance by 1.32 and rounds', () => {
    expect(roadKm(10)).toBe(13.2);
    expect(roadKm(0)).toBe(0);
  });
});

describe('etaMin', () => {
  it('uses urban speed (26 km/h) for distances <= 25 km', () => {
    expect(etaMin(13)).toBe(30);
  });

  it('uses rural speed (42 km/h) for distances > 25 km', () => {
    expect(etaMin(30)).toBe(43);
  });

  it('returns at least 2 minutes', () => {
    expect(etaMin(0.1)).toBe(2);
  });
});

describe('minsAgo', () => {
  it('returns 0 for future dates', () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(minsAgo(future)).toBe(0);
  });

  it('returns positive minutes for past dates', () => {
    const past = new Date(Date.now() - 60000).toISOString();
    expect(minsAgo(past)).toBeGreaterThanOrEqual(1);
  });
});

describe('stockFreshness', () => {
  it('marks OUT stock as stale with red tone', () => {
    const result = stockFreshness('OUT', new Date().toISOString());
    expect(result.stale).toBe(true);
    expect(result.tone).toBe('red');
    expect(result.label).toContain('Out of stock');
  });

  it('marks recent CONFIRMED stock as not stale', () => {
    const result = stockFreshness('CONFIRMED', new Date().toISOString());
    expect(result.stale).toBe(false);
    expect(result.tone).toBe('green');
  });
});

describe('rankHospitals', () => {
  const origin = { lat: 12.97, lng: 77.59 };

  it('ranks CONFIRMED stock above LOW stock', () => {
    const hospitals = [
      {
        id: '1', name: 'Low Stock Hospital', lat: 12.97, lng: 77.59,
        address: null, contact: null,
        stock: { product: 'ASV', status: 'LOW' as const, quantityBand: null, verifiedAt: new Date().toISOString(), verifiedBy: null },
      },
      {
        id: '2', name: 'Confirmed Stock Hospital', lat: 12.97, lng: 77.59,
        address: null, contact: null,
        stock: { product: 'ASV', status: 'CONFIRMED' as const, quantityBand: null, verifiedAt: new Date().toISOString(), verifiedBy: null },
      },
    ];
    const ranked = rankHospitals(origin, hospitals);
    expect(ranked[0].id).toBe('2');
    expect(ranked[0].recommended).toBe(true);
  });

  it('includes distance, eta, score, and freshness on each result', () => {
    const hospitals = [
      {
        id: '1', name: 'Test Hospital', lat: 12.97, lng: 77.59,
        address: 'Addr', contact: '123',
        stock: { product: 'ASV', status: 'CONFIRMED' as const, quantityBand: '10-20', verifiedAt: new Date().toISOString(), verifiedBy: 'dr' },
      },
    ];
    const ranked = rankHospitals(origin, hospitals);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({
      distanceKm: expect.any(Number),
      etaMin: expect.any(Number),
      score: expect.any(Number),
      rank: 1,
      recommended: true,
    });
  });

  it('penalises stale CONFIRMED stock', () => {
    const oldDate = new Date(Date.now() - 7260000).toISOString();
    const hospitals = [
      {
        id: '1', name: 'Stale But Confirmed', lat: 12.97, lng: 77.59,
        address: null, contact: null,
        stock: { product: 'ASV', status: 'CONFIRMED' as const, quantityBand: null, verifiedAt: oldDate, verifiedBy: null },
      },
    ];
    const ranked = rankHospitals(origin, hospitals);
    expect(ranked[0].freshness.stale).toBe(true);
  });
});
