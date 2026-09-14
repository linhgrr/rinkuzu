'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PersonalLearningTrendPointViewModel } from '@/features/admin/stats/types/personal-learning-view-model';

interface PersonalLearningTrendChartProps {
  data: PersonalLearningTrendPointViewModel[];
  labels: {
    chart: string;
    created: string;
    completed: string;
    failed: string;
    learners: string;
    empty: string;
  };
}

export function PersonalLearningTrendChart({ data, labels }: PersonalLearningTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-neutral-500">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="h-72 w-full" role="img" aria-label={labels.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="period"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <Legend />
          <Bar
            dataKey="jobsCreated"
            name={labels.created}
            fill="var(--blue-500)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="jobsCompleted"
            name={labels.completed}
            fill="var(--green-500)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="jobsFailed"
            name={labels.failed}
            fill="var(--red-500)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="activeLearners"
            name={labels.learners}
            stroke="var(--purple-500)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
