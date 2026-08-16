import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CareCorridorTimeline } from '../care-corridor-timeline';
import type { CareCorridorTimeline as TimelineType } from '@/lib/nagraksha';

const mockTimeline: TimelineType = {
  incidentId: 'inc-test-123',
  presentingHospital: {
    id: 'hosp-malavalli-phc',
    name: 'Malavalli Taluk PHC',
    lat: 12.386,
    lng: 77.0545,
    phone: '08231-242222',
    address: 'Malavalli, Mandya',
    distanceKm: 2.4,
    stock: null,
  },
  activeReferral: {
    id: 'ref-test-001',
    incidentId: 'inc-test-123',
    fromHospitalId: 'hosp-malavalli-phc',
    toHospitalId: 'hosp-mandya-dh',
    status: 'PENDING',
    urgency: 'CRITICAL_IMMEDIATE',
    missingCapabilities: ['VENTILATION', 'ICU'],
    clinicalReason: 'Progressive neurotoxic eyelid ptosis >40% threatens respiratory arrest.',
    createdAt: '2026-08-16T10:25:00Z',
    updatedAt: '2026-08-16T10:25:00Z',
  },
  destinationHospital: {
    id: 'hosp-mandya-dh',
    name: 'Mandya District Hospital',
    lat: 12.523,
    lng: 76.898,
    phone: '08232-224055',
    address: 'Mandya City',
    distanceKm: 22.0,
    stock: null,
  },
  stages: [
    {
      index: 1,
      stageKey: 'SOS_REPORTED',
      title: 'Incident & SOS Activated',
      status: 'COMPLETED',
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
      clinicalReason: 'Progressive neurotoxic eyelid ptosis >40% threatens respiratory arrest.',
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
};

describe('CareCorridorTimeline Component', () => {
  it('renders all 8 stages with titles and status indicators', () => {
    render(
      <CareCorridorTimeline timeline={mockTimeline} incidentId="inc-test-123" role="victim" />,
    );

    expect(screen.getByText(/Care Corridor — Capability-Aware Referral/i)).toBeTruthy();
    expect(screen.getByText('Incident & SOS Activated')).toBeTruthy();
    expect(screen.getByText('Presenting Facility Triage')).toBeTruthy();
    expect(screen.getByText('Clinical Observation & VenomScore')).toBeTruthy();
    expect(screen.getByText('Facility Capability Gap')).toBeTruthy();
    expect(screen.getByText('Capable Receiving Facility')).toBeTruthy();
    expect(screen.getByText('Receiving Hospital Acceptance')).toBeTruthy();
    expect(screen.getByText('Inter-Facility 108 Ambulance Transit')).toBeTruthy();
    expect(screen.getByText('Arrival & Closed-Loop Handoff')).toBeTruthy();
  });

  it('displays capability gap alert with missing ventilation and reason', () => {
    render(
      <CareCorridorTimeline timeline={mockTimeline} incidentId="inc-test-123" role="victim" />,
    );

    expect(screen.getByText(/Capability Deficit at Current Facility/i)).toBeTruthy();
    expect(screen.getByText(/VENTILATION, ICU/i)).toBeTruthy();
    expect(screen.getByText(/Mandya District Hospital/i)).toBeTruthy();
  });

  it('shows action buttons for hospital role and triggers onAction callback on accept', async () => {
    const handleAction = vi.fn();
    render(
      <CareCorridorTimeline
        timeline={mockTimeline}
        incidentId="inc-test-123"
        role="hospital"
        onAction={handleAction}
      />,
    );

    const acceptBtn = screen.getByRole('button', { name: /Accept & Reserve Ventilator/i });
    expect(acceptBtn).toBeTruthy();

    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(handleAction).toHaveBeenCalled();
    });
  });
});
