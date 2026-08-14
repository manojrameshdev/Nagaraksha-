'use client';
import { useState } from 'react';
import { acceptDispatch, declineDispatch } from '@/lib/nagraksha';

interface Props {
  incidentId: string;
  onAction?: () => void;
}

export function DispatchActions({ incidentId, onAction }: Props) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handle = async (action: 'accept' | 'decline') => {
    setLoading(action);
    setMessage(null);
    try {
      if (action === 'accept') await acceptDispatch(incidentId);
      else await declineDispatch(incidentId);
      setMessage(action === 'accept' ? 'Dispatch accepted.' : 'Dispatch declined.');
      onAction?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-3 items-center">
      <button
        onClick={() => handle('accept')}
        disabled={!!loading}
        className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading === 'accept' ? 'Accepting...' : 'Accept'}
      </button>
      <button
        onClick={() => handle('decline')}
        disabled={!!loading}
        className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading === 'decline' ? 'Declining...' : 'Decline'}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
