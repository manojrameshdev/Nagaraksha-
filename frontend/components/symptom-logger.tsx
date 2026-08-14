'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { logSymptom } from '@/lib/nagraksha';

interface Props {
  incidentId: string;
  onLogged?: () => void;
}

export function SymptomLogger({ incidentId, onLogged }: Props) {
  const [form, setForm] = useState({ code: '', label: '', severity: 'MILD', value: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await logSymptom(incidentId, form);
      setForm({ code: '', label: '', severity: 'MILD', value: '' });
      onLogged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Log Symptom</h3>
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          placeholder="Code (e.g. PTOSIS)"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          required
          placeholder="Label (e.g. Eyelid droop)"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="rounded border px-2 py-1 text-sm"
        />
      </div>
      <select
        value={form.severity}
        onChange={(e) => setForm({ ...form, severity: e.target.value })}
        className="rounded border px-2 py-1 text-sm w-full"
      >
        {['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? 'Logging...' : 'Log Symptom'}
      </button>
    </form>
  );
}
