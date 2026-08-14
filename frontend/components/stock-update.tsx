'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { updateStock } from '@/lib/nagraksha';
import { useAuth } from '@/hooks/use-auth';

interface Props {
  hospitalId: string;
}

export function StockUpdate({ hospitalId }: Props) {
  const { role } = useAuth();
  const [form, setForm] = useState({
    product: 'Polyvalent Antivenom',
    status: 'IN_STOCK' as const,
    quantityBand: 'HIGH',
    verifiedBy: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (role !== 'hospital_admin' && role !== 'system_admin') return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await updateStock(hospitalId, form);
      setMessage('Stock updated successfully.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Update Stock</h3>
      <select
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
        className="rounded border px-2 py-1 text-sm w-full"
      >
        {['IN_STOCK', 'LOW', 'OUT_OF_STOCK'].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <input
        required
        placeholder="Verified by (name)"
        value={form.verifiedBy}
        onChange={(e) => setForm({ ...form, verifiedBy: e.target.value })}
        className="rounded border px-2 py-1 text-sm w-full"
      />
      {message && <p className="text-sm">{message}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? 'Updating...' : 'Update Stock'}
      </button>
    </form>
  );
}
