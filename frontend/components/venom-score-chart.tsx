'use client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { PtosisReading } from '@/lib/nagraksha';

interface VenomScoreChartProps {
  readings: PtosisReading[];
}

export function VenomScoreChart({ readings }: VenomScoreChartProps) {
  const points = readings
    .filter((r) => r.percentChange !== null)
    .map((r, i) => ({ t: i + 1, closure: Number((r.percentChange as number).toFixed(1)) }));

  if (points.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="t" />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip />
        <ReferenceLine y={40} stroke="#f59e0b" label="Ptosis" />
        <ReferenceLine y={70} stroke="#ef4444" label="Severe" />
        <Line type="monotone" dataKey="closure" stroke="#f97316" />
      </LineChart>
    </ResponsiveContainer>
  );
}
