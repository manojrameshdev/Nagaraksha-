import { http, HttpResponse } from 'msw';

const BASE = 'http://localhost:8000';

const mockVenomScore = {
  venomType: 'UNKNOWN',
  overallSeverity: 0,
  dryBiteProbability: 0,
  estimatedAntivenomVials: 10,
  confidenceLevel: 'low',
  clinicalBasis: 'WHO 2016 Table 3',
  disclaimer: 'Confirm with 20WBCT',
  criticalAlert: null,
  ventilatorRequired: false,
  ptosisReadingCount: 1,
  woundReadingCount: 0,
  minutesSinceBite: 0,
};

export const handlers = [
  // Health
  http.get(`${BASE}/api/health`, () =>
    HttpResponse.json({
      ok: true,
      service: 'nagraksha-backend',
      version: '2.0.0',
      language: 'python',
    }),
  ),

  // Auth
  http.post(`${BASE}/api/auth/token`, async ({ request }) => {
    const body = (await request.json()) as { role: string; secret: string };
    if (body.role === 'victim' && body.secret === 'victim-demo') {
      return HttpResponse.json({ token: 'mock-jwt-token', role: 'victim' });
    }
    return HttpResponse.json({ detail: 'Invalid role or secret' }, { status: 401 });
  }),

  // SOS — matches the real backend response shape (incident + rankedHospitals)
  http.post(`${BASE}/api/sos`, () =>
    HttpResponse.json({
      incident: {
        id: 'mock-incident-id-123',
        state: 'DISPATCHING',
        lat: 12.8003,
        lng: 77.5954,
        address: 'Bengaluru',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dispatchAttempts: [
          {
            id: 'lane-1',
            incidentId: 'mock-incident-id-123',
            category: 'AMBULANCE',
            candidateName: 'Ambulance Service',
            candidateRole: 'ambulance',
            distanceKm: 2.1,
            etaMin: 9,
            sequence: 1,
            outcome: 'PENDING',
            acceptedAt: null,
          },
          {
            id: 'lane-2',
            incidentId: 'mock-incident-id-123',
            category: 'HOSPITAL',
            candidateName: 'Apollo Hospital',
            candidateRole: 'hospital',
            distanceKm: 1.4,
            etaMin: 6,
            sequence: 2,
            outcome: 'PENDING',
            acceptedAt: null,
          },
          {
            id: 'lane-3',
            incidentId: 'mock-incident-id-123',
            category: 'POISON_CONTROL',
            candidateName: 'Poison Control',
            candidateRole: 'poison_control',
            distanceKm: 0,
            etaMin: 0,
            sequence: 3,
            outcome: 'PENDING',
            acceptedAt: null,
          },
        ],
        symptomObservations: [],
        snakeObservations: [],
      },
      ref: 'NR-MOCK-0001',
      rankedHospitals: [],
      dispatchedAt: new Date().toISOString(),
      streamUrl: '/api/incidents/mock-incident-id-123/stream',
      wsUrl: '/ws/incidents/mock-incident-id-123',
      auditUrl: '/api/incidents/mock-incident-id-123/audit',
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

  // VenomScore
  http.post(`${BASE}/api/venom-score/:incidentId/reading`, () =>
    HttpResponse.json({ id: 'ptosis-reading-001', venomScore: mockVenomScore }),
  ),

  http.get(`${BASE}/api/venom-score/:incidentId/score`, () =>
    HttpResponse.json({ venomScore: mockVenomScore }),
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
