'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CreatorBarData {
  email: string;
  quizCount: number;
  totalQuestions: number;
}

export interface TopCreatorsBarChartProps {
  data: CreatorBarData[];
  label: string;
  emptyLabel: string;
  quizzesLabel: string;
  questionsLabel: string;
}

interface CreatorTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: CreatorBarData }>;
  quizzesLabel: string;
  questionsLabel: string;
}

const CustomTooltip = ({ active, payload, quizzesLabel, questionsLabel }: CreatorTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-line bg-white p-3 shadow-sm">
        <p className="mb-1 font-medium text-neutral-900">{data.email}</p>
        <p className="text-sm text-neutral-600">
          {quizzesLabel}: <span className="font-semibold">{data.quizCount}</span>
        </p>
        <p className="text-sm text-neutral-600">
          {questionsLabel}: <span className="font-semibold">{data.totalQuestions}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const TopCreatorsBarChart = ({
  data,
  label,
  emptyLabel,
  quizzesLabel,
  questionsLabel,
}: TopCreatorsBarChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center text-sm text-neutral-500">
        {emptyLabel}
      </div>
    );
  }

  const formattedData = data.map((item) => ({
    ...item,
    truncatedEmail: item.email.length > 20 ? `${item.email.substring(0, 20)}…` : item.email,
  }));

  return (
    <div className="h-80 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formattedData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            type="category"
            dataKey="truncatedEmail"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            width={150}
          />
          <Tooltip
            content={<CustomTooltip quizzesLabel={quizzesLabel} questionsLabel={questionsLabel} />}
            cursor={{ fill: 'var(--bg-surface-muted)' }}
          />
          <Bar
            dataKey="quizCount"
            fill="var(--brand-trust)"
            radius={[0, 4, 4, 0]}
            barSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
