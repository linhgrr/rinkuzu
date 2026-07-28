'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DonutSlice {
  name: string;
  value: number;
}

export interface LlmCostDonutChartProps {
  data: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  label: string;
  valueFormatter: (value: number) => string;
}

const COLORS = [
  'var(--brand-trust)',
  'var(--brand-action)',
  'var(--info)',
  'var(--purple)',
  'var(--success)',
  'var(--state-review)',
  'var(--state-new)',
  'var(--error)',
];

interface DonutTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DonutSlice }>;
  valueFormatter: (value: number) => string;
}

function DonutTooltip({ active, payload, valueFormatter }: DonutTooltipProps) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-white p-3 shadow-sm">
      <p className="font-medium text-neutral-900">{slice.name}</p>
      <p className="text-sm text-neutral-600">{valueFormatter(slice.value)}</p>
    </div>
  );
}

export const LlmCostDonutChart = ({
  data,
  centerLabel,
  centerValue,
  label,
  valueFormatter,
}: LlmCostDonutChartProps) => {
  if (data.length === 0) {
    return null;
  }

  return (
    <div className="relative h-72 w-full" role="img" aria-label={label}>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-neutral-900">{centerValue}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          {centerLabel}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip valueFormatter={valueFormatter} />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: 'var(--space-3)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
