'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface GrowthDataPoint {
  date: string;
  newUsers: number;
  newQuizzes: number;
  attempts: number;
  averageScore: number | null;
}

export interface GrowthTrendChartProps {
  data: GrowthDataPoint[];
  isLoading?: boolean;
  labels: {
    chart: string;
    loading: string;
    empty: string;
    users: string;
    quizzes: string;
    attempts: string;
  };
}

export const GrowthTrendChart = ({ data, isLoading, labels }: GrowthTrendChartProps) => {
  if (isLoading) {
    return (
      <div className="flex h-80 w-full items-center justify-center text-sm text-neutral-500">
        {labels.loading}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-80 w-full items-center justify-center text-sm text-neutral-500">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="h-80 w-full" role="img" aria-label={labels.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="date"
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
            contentStyle={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <Legend
            iconSize={10}
            formatter={(value) => <span className="text-sm text-neutral-700">{value}</span>}
            wrapperStyle={{ paddingTop: 'var(--space-5)' }}
          />
          <Area
            type="monotone"
            dataKey="newUsers"
            name={labels.users}
            stroke="var(--blue-500)"
            fill="var(--blue-500)"
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="newQuizzes"
            name={labels.quizzes}
            stroke="var(--green-500)"
            fill="var(--green-500)"
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="attempts"
            name={labels.attempts}
            stroke="var(--orange-500)"
            fill="var(--orange-500)"
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
