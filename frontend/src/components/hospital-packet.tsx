'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Clock, AlertCircle, Syringe, HeartPulse, UserCheck, ChevronRight } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { ComplianceBadge } from './compliance-badge';

interface HospitalPacketProps {
  incidentId: string;
}

export function HospitalPacket({ incidentId }: HospitalPacketProps) {
  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!incidentId) return;

    const fetchPacket = async () => {
      try {
        const res = await fetch(apiUrl(`/api/wound/${incidentId}/packet`));
        if (res.ok) {
          const data = await res.json();
          setPacket(data);
        }
      } catch (e) {
        console.error('Failed to load pre-arrival packet:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPacket();
    const interval = setInterval(fetchPacket, 10000);
    return () => clearInterval(interval);
  }, [incidentId]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-400 text-sm animate-pulse">
        Loading hospital pre-arrival intelligence packet...
      </div>
    );
  }

  if (!packet) return null;

  return (
    <div className="bg-slate-900 border border-emerald-900/60 rounded-xl p-5 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white tracking-wide">Hospital Pre-Arrival Intelligence Packet</h3>
        </div>
        <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono">
          ETA: ~{packet.etaMinutes ?? 12} MIN
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Metric 1: Time elapsed */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Time Since Bite</span>
          </div>
          <p className="text-xl font-bold text-white">{packet.minutesSinceBite || 18} mins</p>
          <span className="text-[10px] text-slate-500">Critical window: &lt;120 mins</span>
        </div>

        {/* Metric 2: Wound Severity */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
            <span>Envenomation Severity</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-bold text-rose-400">{packet.currentSeverityScore ?? 45}</p>
            <span className="text-[10px] text-slate-400 uppercase font-mono">({packet.severityTrend || 'moderate'})</span>
          </div>
          <span className="text-[10px] text-slate-500">Based on vision pixel swelling</span>
        </div>

        {/* Metric 3: Antivenom dosage pre-calc */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Syringe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Polyvalent ASV Prep</span>
          </div>
          <p className="text-xl font-bold text-emerald-400">{packet.recommendedAntivenomVials ?? 4} Vials</p>
          <span className="text-[10px] text-slate-500">Initial loading dose ready</span>
        </div>
      </div>

      {/* Observed Symptoms List */}
      {packet.symptomsObserved && packet.symptomsObserved.length > 0 && (
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
          <span className="text-xs font-semibold text-slate-300 block mb-2">Field-Logged Symptoms</span>
          <div className="flex flex-wrap gap-1.5">
            {packet.symptomsObserved.map((s: any, idx: number) => (
              <span key={idx} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                {s.label || s.code} ({s.severity})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <UserCheck className="w-3.5 h-3.5" /> Ambulance Team In-Transit
        </span>
        <span className="font-mono text-[10px] text-slate-500">Ref: {packet.incidentId?.slice(0, 10)}</span>
      </div>
    </div>
  );
}
