'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface LlmBreakdownBarChartProps {
  data: Array<{ name: string; value: number }>;
  emptyLabel: string;
  label: string;
}

export function LlmBreakdownBarChart({ data, emptyLabel, label }: LlmBreakdownBarChartProps) {
  const rows = data
    .filter((row) => row.value > 0)
    .slice(0, 7)
    .reverse();
  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-72 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 18, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            tickFormatter={(value) => `$${Number(value).toFixed(3)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={118}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(4)}`, label]}
            contentStyle={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <Bar
            dataKey="value"
            name={label}
            fill="var(--brand-action)"
            radius={[0, 6, 6, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
