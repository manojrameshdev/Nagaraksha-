'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardCheck, MapPin, CheckCircle2, AlertTriangle, Wifi, WifiOff, Send } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface QuestionsState {
  sleeps_on_floor: boolean;
  has_wall_gaps: boolean;
  adequate_lighting: boolean;
  wears_footwear_night: boolean;
  near_agri_field: boolean;
  prior_snakebite: boolean;
  knows_myths_facts: boolean;
  knows_nearest_hospital: boolean;
  notes: string;
}

const initialQuestions: QuestionsState = {
  sleeps_on_floor: true,
  has_wall_gaps: false,
  adequate_lighting: false,
  wears_footwear_night: false,
  near_agri_field: true,
  prior_snakebite: false,
  knows_myths_facts: false,
  knows_nearest_hospital: true,
  notes: '',
};

export function AshaAuditTool() {
  const [gramPanchayat, setGramPanchayat] = useState('Shivalli GP');
  const [district, setDistrict] = useState('Mandya');
  const [ashaWorkerId, setAshaWorkerId] = useState('ASHA-MND-402');
  const [sessionActive, setSessionActive] = useState(false);
  const [villageAuditId, setVillageAuditId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QuestionsState>(initialQuestions);
  const [submitting, setSubmitting] = useState(false);
  const [visitedCount, setVisitedCount] = useState(0);
  const [lastRiskScore, setLastRiskScore] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const startSession = async () => {
    try {
      const res = await fetch(apiUrl('/api/audit/village'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asha_worker_id: ashaWorkerId,
          gram_panchayat: gramPanchayat,
          district: district,
          audit_date: new Date().toISOString().split('T')[0],
          lat: 12.5226,
          lng: 76.8976,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVillageAuditId(data.villageAuditId);
        setSessionActive(true);
      }
    } catch (e) {
      console.warn('Network offline — starting local audit session');
      setVillageAuditId(`local-${Date.now()}`);
      setSessionActive(true);
    }
  };

  const submitHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageAuditId || submitting) return;
    setSubmitting(true);

    const payload = {
      ...questions,
      lat: 12.5226 + (Math.random() - 0.5) * 0.01,
      lng: 76.8976 + (Math.random() - 0.5) * 0.01,
    };

    try {
      if (isOnline && !villageAuditId.startsWith('local-')) {
        const res = await fetch(apiUrl(`/api/audit/village/${villageAuditId}/household`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setLastRiskScore(data.riskScore);
        }
      } else {
        // Compute local score offline
        let risk = 0;
        if (questions.sleeps_on_floor) risk += 25;
        if (questions.has_wall_gaps) risk += 20;
        if (!questions.adequate_lighting) risk += 15;
        if (!questions.wears_footwear_night) risk += 15;
        if (questions.near_agri_field) risk += 10;
        if (questions.prior_snakebite) risk += 10;
        if (!questions.knows_myths_facts) risk += 5;
        setLastRiskScore(risk);
      }

      setVisitedCount((c) => c + 1);
      setQuestions(initialQuestions);
    } catch (err) {
      console.error('Audit submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white tracking-wide">ASHA Worker Gram Panchayat Audit Tool</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-mono ${
            isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isOnline ? 'ONLINE SYNC' : 'OFFLINE QUEUE'}
          </span>
        </div>
      </div>

      {!sessionActive ? (
        <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3 text-xs">
          <p className="text-slate-300">Standardized home visit assessment for snakebite vulnerability mapping across district Gram Panchayats.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">ASHA Worker ID</label>
              <input
                type="text"
                value={ashaWorkerId}
                onChange={(e) => setAshaWorkerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Gram Panchayat</label>
              <input
                type="text"
                value={gramPanchayat}
                onChange={(e) => setGramPanchayat(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>
          </div>
          <button
            onClick={startSession}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition"
          >
            Start Village Household Audit Session
          </button>
        </div>
      ) : (
        <form onSubmit={submitHousehold} className="space-y-4 text-xs">
          <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-800/50 p-2.5 rounded-lg text-indigo-300">
            <span>Session: <strong>{gramPanchayat}</strong> ({district})</span>
            <span>Households Audited: <strong>{visitedCount}</strong></span>
          </div>

          {lastRiskScore !== null && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Last Household Risk Score:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-sm ${
                lastRiskScore >= 70 ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
              }`}>
                {lastRiskScore} / 100 ({lastRiskScore >= 70 ? 'HIGH RISK' : 'LOW RISK'})
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[
              { key: 'sleeps_on_floor', label: 'Household members sleep on floor mats/ground' },
              { key: 'has_wall_gaps', label: 'Unsealed gaps/holes in mud or brick walls' },
              { key: 'adequate_lighting', label: 'Adequate flashlight/torch for night outdoor movement' },
              { key: 'wears_footwear_night', label: 'Wears closed footwear during night walking' },
              { key: 'near_agri_field', label: 'House within 50m of agricultural field / paddy' },
              { key: 'prior_snakebite', label: 'History of snakebite incident in family' },
              { key: 'knows_myths_facts', label: 'Knows first-aid facts (avoids tourniquets/cutting)' },
              { key: 'knows_nearest_hospital', label: 'Knows nearest hospital with ASV stock' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded border border-slate-800/80 cursor-pointer hover:bg-slate-800/40">
                <input
                  type="checkbox"
                  checked={(questions as any)[key]}
                  onChange={(e) => setQuestions({ ...questions, [key]: e.target.checked })}
                  className="mt-0.5 accent-indigo-500 rounded"
                />
                <span className="text-slate-300 leading-tight">{label}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Send className="w-4 h-4" />
            Submit Household Audit Form
          </button>
        </form>
      )}
    </div>
  );
}
