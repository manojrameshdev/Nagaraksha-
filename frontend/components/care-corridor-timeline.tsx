'use client';

import { useState } from 'react';
import type { CareCorridorTimeline as TimelineType } from '@/lib/nagraksha';
import { acceptReferral, declineReferral } from '@/lib/nagraksha';
import { useSosStore } from '@/store/sos-store';

interface CareCorridorTimelineProps {
  timeline: TimelineType | null;
  incidentId: string;
  role?: 'victim' | 'hospital';
  onAction?: () => void;
}

export function CareCorridorTimeline({
  timeline,
  incidentId,
  role = 'victim',
  onAction,
}: CareCorridorTimelineProps) {
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetchCorridorTimeline = useSosStore((s) => s.fetchCorridorTimeline);

  const activeReferral = timeline?.activeReferral;
  const stages = timeline?.stages ?? [];

  async function handleAccept() {
    if (!activeReferral) return;
    setActing(true);
    setActionError(null);
    try {
      await acceptReferral(activeReferral.id, {
        acceptedBy: 'Dr. Ramesh (CMO, Mandya DH)',
        notes: 'Ventilator #2 and 10 ASV vials reserved on ICU standby.',
      });
      await fetchCorridorTimeline(incidentId);
      onAction?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to accept referral');
    } finally {
      setActing(false);
    }
  }

  async function handleDecline() {
    if (!activeReferral) return;
    setActing(true);
    setActionError(null);
    try {
      await declineReferral(activeReferral.id, {
        declinedBy: 'Hospital Coordinator',
        reason: 'ICU full / all ventilators currently occupied',
      });
      await fetchCorridorTimeline(incidentId);
      onAction?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to decline referral');
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            Care Corridor — Capability-Aware Referral
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Closed-loop inter-facility clinical coordination & tracking
          </p>
        </div>
        {activeReferral && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              activeReferral.status === 'ACCEPTED' || activeReferral.status === 'ARRIVED'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : activeReferral.status === 'IN_TRANSIT'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : activeReferral.status === 'DECLINED'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {activeReferral.status.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Hospital Role Decision Panel */}
      {role === 'hospital' && activeReferral && activeReferral.status === 'PENDING' && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Action Required · Incoming Inter-Facility Referral
              </p>
              <h3 className="text-base font-bold text-amber-950 dark:text-amber-100 mt-0.5">
                Urgent Transfer Request: {activeReferral.urgency.replace('_', ' ')}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                <span className="font-semibold">Clinical Reason:</span>{' '}
                {activeReferral.clinicalReason}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Missing at Source:</span>{' '}
                {activeReferral.missingCapabilities.join(', ')}
              </p>
            </div>
          </div>

          {actionError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 p-2 rounded">
              {actionError}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleAccept}
              disabled={acting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 px-4 rounded-md transition shadow-sm cursor-pointer"
            >
              {acting ? 'Confirming...' : '✓ Accept & Reserve Ventilator / Bed'}
            </button>
            <button
              onClick={handleDecline}
              disabled={acting}
              className="bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground text-sm font-medium py-2.5 px-4 rounded-md transition cursor-pointer"
            >
              Re-Route / Decline
            </button>
          </div>
        </div>
      )}

      {/* Vertical 8-Stage Progress Timeline */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {stages.map((stage) => {
          const isDone = stage.status === 'COMPLETED';
          const isInProgress = stage.status === 'IN_PROGRESS';
          const isDeclined = stage.status === 'DECLINED';

          return (
            <div key={stage.index} className="relative group">
              {/* Dot Icon */}
              <div
                className={`absolute -left-6 top-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                  isDone
                    ? 'bg-emerald-500 border-emerald-600 text-white'
                    : isInProgress
                      ? 'bg-amber-500 border-amber-600 text-white animate-bounce'
                      : isDeclined
                        ? 'bg-rose-500 border-rose-600 text-white'
                        : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isDone ? '✓' : isDeclined ? '✕' : stage.index}
              </div>

              {/* Stage Content */}
              <div className="rounded-lg border bg-background/50 p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">{stage.title}</h4>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                      isDone
                        ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50'
                        : isInProgress
                          ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/50 font-semibold'
                          : isDeclined
                            ? 'text-rose-700 bg-rose-50'
                            : 'text-muted-foreground bg-muted/40'
                    }`}
                  >
                    {isDone
                      ? 'Completed'
                      : isInProgress
                        ? 'In Progress'
                        : isDeclined
                          ? 'Declined'
                          : 'Pending'}
                  </span>
                </div>

                {/* Stage-Specific Content */}
                {stage.stageKey === 'PRESENTING_FACILITY' && stage.facilityName && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{stage.facilityName}</span> (
                    {stage.facilityLevel})
                  </p>
                )}

                {stage.stageKey === 'CLINICAL_TELEMETRY' &&
                  stage.percentChange !== undefined &&
                  stage.percentChange !== null && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Ptosis Reduction:</span>{' '}
                      {stage.percentChange}%{' · '}
                      <span className="font-semibold text-foreground">Severity:</span>{' '}
                      {stage.ptosisSeverity}
                    </div>
                  )}

                {stage.stageKey === 'CAPABILITY_GAP' &&
                  stage.missingCapabilities &&
                  stage.missingCapabilities.length > 0 && (
                    <div className="rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-2 text-xs text-rose-800 dark:text-rose-200">
                      <p className="font-semibold">⚠️ Capability Deficit at Current Facility:</p>
                      <p>{stage.missingCapabilities.join(', ')}</p>
                      {stage.clinicalReason && (
                        <p className="mt-0.5 italic">{stage.clinicalReason}</p>
                      )}
                    </div>
                  )}

                {stage.stageKey === 'REFERRAL_TARGET' && stage.destinationHospitalName && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Target Facility:</span>{' '}
                    {stage.destinationHospitalName} ({stage.destinationLevel})
                    {stage.ventilatorCount
                      ? ` · ${stage.ventilatorCount} ICU Ventilators Available`
                      : ''}
                  </div>
                )}

                {stage.stageKey === 'HOSPITAL_ACCEPTANCE' && (
                  <div className="text-xs text-muted-foreground">
                    {stage.acceptedAt ? (
                      <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                        ✓ Case accepted by {stage.acceptedBy ?? 'Receiving Hospital'}
                      </p>
                    ) : stage.declinedReason ? (
                      <p className="text-rose-700 font-medium">
                        ✕ Declined: {stage.declinedReason}
                      </p>
                    ) : (
                      <p className="italic">Awaiting coordinator acceptance...</p>
                    )}
                  </div>
                )}

                {stage.stageKey === 'AMBULANCE_TRANSIT' && stage.transportStartedAt && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    🚑 108 ALS Ambulance in transit with telemetry stream
                  </p>
                )}

                {stage.stageKey === 'PATIENT_ARRIVED' && stage.arrivedAt && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    🎯 Patient admitted at receiving facility ICU — closed-loop completed.
                  </p>
                )}

                {stage.details && <p className="text-xs text-muted-foreground">{stage.details}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
