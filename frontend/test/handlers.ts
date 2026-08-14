import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8000';

export const handlers = [
  // Health
  http.get(`${BASE}/api/health`, () =>
    HttpResponse.json({ ok: true, service: 'nagraksha-backend', version: '2.0.0', language: 'python' }),
  ),

  // Auth
  http.post(`${BASE}/api/auth/token`, async ({ request }) => {
    const body = (await request.json()) as { role: string; secret: string };
    if (body.role === 'victim' && body.secret === 'victim-demo') {
      return HttpResponse.json({ token: 'mock-jwt-token', role: 'victim' });
    }
    return HttpResponse.json({ detail: 'Invalid role or secret' }, { status: 401 });
  }),

  // SOS
  http.post(`${BASE}/api/sos`, () =>
    HttpResponse.json({
      incidentId: 'mock-incident-id-123',
      lanes: [
        {
          id: 'lane-1',
          incidentId: 'mock-incident-id-123',
          category: 'AMBULANCE',
          target: '+91-9999999999',
          sequence: 1,
          outcome: 'PENDING',
          acceptedAt: null,
        },
        {
          id: 'lane-2',
          incidentId: 'mock-incident-id-123',
          category: 'HOSPITAL',
          target: 'Apollo Hospital',
          sequence: 2,
          outcome: 'PENDING',
          acceptedAt: null,
        },
        {
          id: 'lane-3',
          incidentId: 'mock-incident-id-123',
          category: 'POISON_CONTROL',
          target: '1800-425-2233',
          sequence: 3,
          outcome: 'PENDING',
          acceptedAt: null,
        },
      ],
      hospitals: [],
    }),
  ),

  // Incidents
  http.get(`${BASE}/api/incidents`, () =>
    HttpResponse.json({
      incidents: [
        {
          id: 'mock-incident-id-123',
          state: 'DISPATCHING',
          lat: 12.8003,
          lng: 77.5954,
          address: 'Bengaluru',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dispatchAttempts: [],
          symptomObservations: [],
          snakeObservations: [],
        },
      ],
    }),
  ),

  http.get(`${BASE}/api/incidents/:id`, () =>
    HttpResponse.json({
      incident: {
        id: 'mock-incident-id-123',
        state: 'DISPATCHING',
        lat: 12.8003,
        lng: 77.5954,
        address: 'Bengaluru',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dispatchAttempts: [],
        symptomObservations: [],
        snakeObservations: [],
      },
    }),
  ),

  // Hospitals
  http.get(`${BASE}/api/hospitals`, () =>
    HttpResponse.json({
      hospitals: [
        {
          id: 'hospital-1',
          name: 'Apollo Hospitals',
          lat: 12.8103,
          lng: 77.5854,
          phone: '+91-80-2941-4444',
          address: 'Jayanagar',
          distanceKm: 1.4,
          stock: {
            status: 'IN_STOCK',
            product: 'Polyvalent Antivenom',
            quantityBand: 'HIGH',
            verifiedAt: new Date().toISOString(),
            verifiedBy: 'Dr. Sharma',
          },
        },
      ],
      origin: { lat: 12.8003, lng: 77.5954 },
    }),
  ),

  // Stats
  http.get(`${BASE}/api/stats`, () =>
    HttpResponse.json({
      totals: {
        incidents: 5,
        hospitals: 12,
        riskAreas: 8,
        mythConversations: 23,
        mythsBusted: 19,
        knowledgeChunks: 45,
      },
      incidentsByState: { DISPATCHING: 2, HANDED_OFF: 3 },
      stockDistribution: { IN_STOCK: 8, LOW: 3, OUT_OF_STOCK: 1 },
      incidentTrend14d: Array.from({ length: 14 }, (_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
        count: Math.floor(Math.random() * 3),
      })).reverse(),
      annualDeathsIndia: 58000,
      parallelDispatchLanes: 3,
    }),
  ),

  // Risk
  http.get(`${BASE}/api/risk`, () =>
    HttpResponse.json({
      area: 'Bengaluru Urban',
      level: 'MODERATE',
      score: 45,
      weather: 'Partly cloudy',
      season: 'Monsoon',
      likelySnakes: ['Indian Cobra', "Russell's Viper"],
      advisory: 'Moderate encounter risk. Wear closed footwear.',
      origin: { lat: 12.8003, lng: 77.5954 },
    }),
  ),

  // Knowledge Base
  http.get(`${BASE}/api/knowledge-base`, () =>
    HttpResponse.json({
      query: 'tourniquet',
      results: [
        {
          id: 'kb-1',
          docId: 'doc-1',
          title: 'Tourniquets are dangerous',
          category: 'MYTH',
          content: 'Do not apply tourniquets — they cause tissue death.',
        },
      ],
    }),
  ),
];