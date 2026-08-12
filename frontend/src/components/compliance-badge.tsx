'use client';

import React from 'react';

interface ComplianceBadgeProps {
  score: number;
  showDetails?: boolean;
}

export function ComplianceBadge({ score, showDetails = false }: ComplianceBadgeProps) {
  let badgeColor = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
  let dotColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
  let label = 'Verified Stock';

  if (score < 50) {
    badgeColor = 'bg-rose-950/60 text-rose-400 border-rose-800/50';
    dotColor = 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]';
    label = 'Unreliable Data';
  } else if (score < 80) {
    badgeColor = 'bg-amber-950/60 text-amber-400 border-amber-800/50';
    dotColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';
    label = 'Check Required';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border backdrop-blur-sm ${badgeColor}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="font-semibold">{Math.round(score)}%</span>
      {showDetails && <span className="text-[11px] opacity-80">· {label}</span>}
    </div>
  );
}
