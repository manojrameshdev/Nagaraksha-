'use client';
import { useEffect, useState } from 'react';
import { getHealth } from '@/lib/nagraksha';

export function HealthIndicator() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then(({ ok: isOk }) => setOk(isOk))
      .catch(() => setOk(false));
  }, []);

  if (ok === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
        ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {ok ? 'Backend Online' : 'Backend Offline'}
    </span>
  );
}
