'use client';

import React, { useEffect, useState } from 'react';
import { Map, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface GramPanchayatRisk {
  gramPanchayat: string;
  district: string;
  lat: number;
  lng: number;
  householdsVisited: number;
  aggregateRiskScore: number;
  riskLabel: string;
}

export function DistrictRiskMap() {
  const [district, setDistrict] = useState('Mandya');
  const [panchayats, setPanchayats] = useState<GramPanchayatRisk[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock initial GP data for Mandya demo
  const fallbackPanchayats: GramPanchayatRisk[] = [
    { gramPanchayat: 'Shivalli GP', district: 'Mandya', lat: 12.52, lng: 76.89, householdsVisited: 42, aggregateRiskScore: 74.5, riskLabel: 'HIGH' },
    { gramPanchayat: 'Koppa GP', district: 'Mandya', lat: 12.60, lng: 76.95, householdsVisited: 38, aggregateRiskScore: 58.2, riskLabel: 'MODERATE' },
    { gramPanchayat: 'Basaralu GP', district: 'Mandya', lat: 12.45, lng: 76.82, householdsVisited: 50, aggregateRiskScore: 32.0, riskLabel: 'LOW' },
    { gramPanchayat: 'Kergodu GP', district: 'Mandya', lat: 12.55, lng: 76.91, householdsVisited: 29, aggregateRiskScore: 68.0, riskLabel: 'HIGH' },
  ];

  useEffect(() => {
    const fetchDistrictData = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/audit/district/${district}`));
        if (res.ok) {
          const data = await res.json();
          if (data.gramPanchayats && data.gramPanchayats.length > 0) {
            setPanchayats(data.gramPanchayats);
          } else {
            setPanchayats(fallbackPanchayats);
          }
        } else {
          setPanchayats(fallbackPanchayats);
        }
      } catch (e) {
        setPanchayats(fallbackPanchayats);
      } finally {
        setLoading(false);
      }
    };

    fetchDistrictData();
  }, [district]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white tracking-wide">District Gram Panchayat Vulnerability Heatmap</h3>
        </div>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="bg-slate-950 border border-slate-700 text-xs text-white rounded px-2.5 py-1 font-medium"
        >
          <option value="Mandya">Mandya District</option>
          <option value="Tumkur">Tumkur District</option>
          <option value="Hassan">Hassan District</option>
          <option value="Ramanagara">Ramanagara District</option>
        </select>
      </div>

      {/* Grid of GP Risk Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {panchayats.map((gp, i) => {
          let cardColor = 'bg-slate-950 border-emerald-800/60 text-emerald-400';
          let badgeBg = 'bg-emerald-950 border-emerald-800 text-emerald-400';

          if (gp.riskLabel === 'HIGH') {
            cardColor = 'bg-slate-950 border-rose-800/60 text-rose-400';
            badgeBg = 'bg-rose-950 border-rose-800 text-rose-400';
          } else if (gp.riskLabel === 'MODERATE') {
            cardColor = 'bg-slate-950 border-amber-800/60 text-amber-400';
            badgeBg = 'bg-amber-950 border-amber-800 text-amber-400';
          }

          return (
            <div key={i} className={`p-3.5 rounded-lg border flex flex-col justify-between ${cardColor}`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{gp.gramPanchayat}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${badgeBg}`}>
                    {gp.riskLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 my-1">
                  <span className="text-2xl font-extrabold text-white">{Math.round(gp.aggregateRiskScore)}</span>
                  <span className="text-slate-500 text-[10px]">/ 100 Risk</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 mt-2">
                <span>Audited: {gp.householdsVisited} homes</span>
                <MapPin className="w-3 h-3 text-slate-500" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
