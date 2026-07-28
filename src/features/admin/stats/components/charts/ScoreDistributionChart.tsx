'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface ScoreDistributionBucket {
  range: string;
  count: number;
  passing: boolean;
}

export interface ScoreDistributionChartProps {
  data: ScoreDistributionBucket[];
  label: string;
  emptyLabel: string;
}

export const ScoreDistributionChart = ({
  data,
  label,
  emptyLabel,
}: ScoreDistributionChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center text-sm text-neutral-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-72 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="range"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-surface-muted)' }}
            contentStyle={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell
                key={entry.range}
                fill={entry.passing ? 'var(--brand-trust)' : 'var(--border-strong)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
