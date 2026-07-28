'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, Label, ResponsiveContainer } from 'recharts';

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
  'var(--blue-500)',
  'var(--orange-500)',
  'var(--purple-500)',
  'var(--green-600)',
  'var(--error)',
  'var(--yellow-500)',
  'var(--secondary-4)',
  'var(--neutral-warm-7)',
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
    <div className="h-72 w-full" role="img" aria-label={label}>
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
            <Label
              value={centerValue}
              position="center"
              dy={-6}
              fill="var(--text-primary)"
              fontSize={20}
              fontWeight={700}
            />
            <Label
              value={centerLabel.toUpperCase()}
              position="center"
              dy={14}
              fill="var(--text-secondary)"
              fontSize={10}
              fontWeight={500}
            />
          </Pie>
          <Tooltip content={<DonutTooltip valueFormatter={valueFormatter} />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            iconSize={10}
            formatter={(value) => <span className="text-sm text-neutral-700">{value}</span>}
            wrapperStyle={{ paddingTop: 'var(--space-3)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
