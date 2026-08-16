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

  // Chat (Grok)
  http.post(`${BASE}/api/chat`, async ({ request }) => {
    const body = (await request.json()) as {
      messages: { role: string; content: string }[];
      incident_id?: string | null;
      language?: string | null;
    };
    const latest = body.messages?.at(-1)?.content ?? '';
    const language = body.language ?? 'en';
    if (/bitten|emergency/i.test(latest)) {
      return HttpResponse.json({
        reply:
          'This sounds like an emergency. Tap SOS now and get to a hospital — do not wait. Keep the person still.',
        emergency: true,
        source: 'guard',
        language,
        sources: [],
      });
    }
    if (/ambulance/i.test(latest)) {
      return HttpResponse.json({
        reply: `The ambulance is on its way and is about 9 minutes out, heading to the nearest hospital with antivenom stock (incident ${body.incident_id ?? 'NR-1042'}).`,
        emergency: false,
        source: 'grok',
        language,
        sources: [],
      });
    }
    return HttpResponse.json({
      reply:
        'Never apply a tourniquet. Keep the person still, immobilise the limb, and get to a hospital immediately.',
      emergency: false,
      source: 'grok',
      language,
      sources: [],
    });
  }),

  // Voice transcription (Groq Whisper)
  http.post(`${BASE}/api/transcribe-b64`, () =>
    HttpResponse.json({
      text: 'Where is the ambulance?',
      language: 'en',
      duration: 2.1,
      source: 'groq-whisper',
    }),
  ),

  // Snake ID
  http.post(`${BASE}/api/snake-id`, async ({ request }) => {
    const body = (await request.json()) as { text?: string; image?: string };
    if (!body.text && !body.image) {
      return HttpResponse.json({
        species: null,
        venom: null,
        confidence: null,
        firstAid: null,
        danger: null,
        source: 'none',
        vision_attempted: false,
        vision_provider: null,
        note: 'Please upload a photo or describe the snake.',
        disclaimer: 'Assistive visual identification by AI. This is NOT a medical diagnosis.',
      });
    }
    return HttpResponse.json({
      species: 'Bungarus caeruleus (Common Krait)',
      venom: 'NEUROTOXIC',
      confidence: 0.84,
      habitat: 'Nocturnal, hides in brick piles and human dwellings at night',
      firstAid: 'Emergency hospitalization mandatory. Transport immediately.',
      danger: 'Critical — highest toxicity in India.',
      mimicWarning: 'Frequently confused with the harmless Common Wolf Snake.',
      source: 'morphology-text-matcher',
      vision_attempted: false,
      vision_provider: null,
      note: 'Assistive identification complete. NEVER delay emergency medical care.',
      disclaimer: 'Assistive visual identification by AI. This is NOT a medical diagnosis.',
    });
  }),

  // Care Corridor / Referrals
  http.get(`${BASE}/api/incidents/:incidentId/corridor`, ({ params }) =>
    HttpResponse.json({
      incidentId: params.incidentId,
      presentingHospital: {
        id: 'hosp-malavalli-phc',
        name: 'Malavalli Taluk PHC',
        facilityLevel: 'PHC',
        capabilities: ['ASV', 'EMERGENCY_CARE'],
      },
      activeReferral: {
        id: 'ref-mock-001',
        incidentId: params.incidentId,
        fromHospitalId: 'hosp-malavalli-phc',
        toHospitalId: 'hosp-mandya-dh',
        status: 'PENDING',
        urgency: 'CRITICAL_IMMEDIATE',
        missingCapabilities: ['VENTILATION', 'ICU'],
        clinicalReason: 'Impending respiratory paralysis from progressive neurotoxic envenomation.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      destinationHospital: {
        id: 'hosp-mandya-dh',
        name: 'Mandya District Hospital',
        facilityLevel: 'DH',
        capabilities: ['ASV', 'EMERGENCY_CARE', 'OXYGEN', 'VENTILATION', 'ICU', 'BLOOD_BANK'],
        ventilatorCount: 4,
      },
      stages: [
        {
          index: 1,
          stageKey: 'SOS_REPORTED',
          title: 'Incident & SOS Activated',
          status: 'COMPLETED',
          timestamp: new Date().toISOString(),
        },
        {
          index: 2,
          stageKey: 'PRESENTING_FACILITY',
          title: 'Presenting Facility Triage',
          status: 'COMPLETED',
          facilityName: 'Malavalli Taluk PHC',
          facilityLevel: 'PHC',
        },
        {
          index: 3,
          stageKey: 'CLINICAL_TELEMETRY',
          title: 'Clinical Observation & VenomScore',
          status: 'COMPLETED',
          percentChange: 50,
          ptosisSeverity: 'moderate',
        },
        {
          index: 4,
          stageKey: 'CAPABILITY_GAP',
          title: 'Facility Capability Gap',
          status: 'COMPLETED',
          missingCapabilities: ['VENTILATION', 'ICU'],
          urgency: 'CRITICAL_IMMEDIATE',
        },
        {
          index: 5,
          stageKey: 'REFERRAL_TARGET',
          title: 'Capable Receiving Facility',
          status: 'COMPLETED',
          destinationHospitalName: 'Mandya District Hospital',
          destinationLevel: 'DH',
          ventilatorCount: 4,
        },
        {
          index: 6,
          stageKey: 'HOSPITAL_ACCEPTANCE',
          title: 'Receiving Hospital Acceptance',
          status: 'IN_PROGRESS',
        },
        {
          index: 7,
          stageKey: 'AMBULANCE_TRANSIT',
          title: 'Inter-Facility 108 Ambulance Transit',
          status: 'PENDING',
        },
        {
          index: 8,
          stageKey: 'PATIENT_ARRIVED',
          title: 'Arrival & Closed-Loop Handoff',
          status: 'PENDING',
        },
      ],
    }),
  ),

  http.post(`${BASE}/api/incidents/:incidentId/evaluate-referral`, ({ params }) =>
    HttpResponse.json({
      incidentId: params.incidentId,
      capabilityGap: {
        referral_required: true,
        required_capabilities: ['ASV', 'EMERGENCY_CARE', 'ICU', 'VENTILATION'],
        missing_capabilities: ['ICU', 'VENTILATION'],
        clinical_reasons: ['Progressive neurotoxic envenomation mandates mechanical ventilation.'],
        urgency: 'CRITICAL_IMMEDIATE',
      },
      recommendedHospital: {
        id: 'hosp-mandya-dh',
        name: 'Mandya District Hospital',
        facilityLevel: 'DH',
        complianceScore: 91.5,
      },
    }),
  ),

  http.patch(`${BASE}/api/referrals/:referralId/accept`, ({ params }) =>
    HttpResponse.json({
      referralId: params.referralId,
      status: 'ACCEPTED',
      acceptedAt: new Date().toISOString(),
      acceptedBy: 'Dr. Ramesh (Mandya DH)',
    }),
  ),

  http.patch(`${BASE}/api/referrals/:referralId/decline`, ({ params }) =>
    HttpResponse.json({
      referralId: params.referralId,
      status: 'DECLINED',
      declinedAt: new Date().toISOString(),
      declinedReason: 'ICU occupied',
    }),
  ),

  // Stakeholder registry
  http.get(`${BASE}/api/stakeholders`, () =>
    HttpResponse.json({
      stakeholders: [
        {
          id: 'stk-1',
          name: 'Kasaragod District Hospital',
          organization: 'Kasaragod District Hospital',
          role: 'Hospital',
          supportType: 'HOSPITAL',
          district: 'Kasaragod',
          addedAt: new Date().toISOString(),
        },
        {
          id: 'stk-2',
          name: 'Forest Rescue Unit',
          organization: 'Forest Rescue Unit',
          role: 'Rescue',
          supportType: 'RESCUE',
          district: 'Kasaragod',
          addedAt: new Date().toISOString(),
        },
      ],
      count: 2,
    }),
  ),

  http.post(`${BASE}/api/stakeholders`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'stk-new',
        name: body.name,
        organization: body.organization,
      },
      { status: 201 },
    );
  }),

  // System audit + outbox (admin workspace)
  http.get(`${BASE}/api/audit`, () =>
    HttpResponse.json({
      count: 3,
      byAction: { SOS_TRIGGERED: 1, STOCK_UPDATED: 2 },
      events: [
        {
          id: 'aud-1',
          incidentId: 'mock-incident-id-123',
          actor: 'victim',
          action: 'SOS_TRIGGERED',
          entity: 'Incident',
          metadata: null,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  ),

  http.get(`${BASE}/api/outbox`, () =>
    HttpResponse.json({
      summary: { pending: 2, processed: 8, failed: 0, total: 10 },
      recent: [],
    }),
  ),

  // ASHA village audit
  http.get(`${BASE}/api/audit/districts`, () =>
    HttpResponse.json({
      districts: [
        { district: 'Kasaragod', gpCount: 3 },
        { district: 'Kannur', gpCount: 2 },
      ],
    }),
  ),

  http.get(`${BASE}/api/audit/district/:district`, ({ params }) =>
    HttpResponse.json({
      district: params.district,
      gramPanchayats: [
        {
          id: 'gp-1',
          gramPanchayat: 'Pallikere',
          district: params.district,
          householdsVisited: 69,
          aggregateRiskScore: 72.4,
          auditDate: new Date().toISOString(),
          riskLabel: 'HIGH',
        },
      ],
    }),
  ),

  http.get(`${BASE}/api/audit/village/:villageAuditId`, ({ params }) =>
    HttpResponse.json({
      villageAudit: {
        id: params.villageAuditId,
        gramPanchayat: 'Pallikere',
        district: 'Kasaragod',
        householdsVisited: 69,
        aggregateRiskScore: 72.4,
        auditDate: new Date().toISOString(),
        lat: 12.5,
        lng: 75.0,
        createdAt: new Date().toISOString(),
      },
      households: [],
    }),
  ),
];
