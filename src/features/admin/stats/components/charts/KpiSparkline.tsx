'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

export interface KpiSparklineProps {
  data: Array<number | null>;
  color?: string;
  label: string;
}

export const KpiSparkline = ({ data, color = 'var(--brand-trust)', label }: KpiSparklineProps) => {
  if (data.length === 0) {
    return <div className="h-10 w-full" />;
  }

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <div className="h-10 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
