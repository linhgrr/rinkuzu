'use client';

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LlmUsageDailyPoint } from '@/features/admin/stats/types/llm-usage-view-model';

interface LlmUsageTrendChartProps {
  data: LlmUsageDailyPoint[];
  labels: {
    chart: string;
    tokens: string;
    cost: string;
    empty: string;
  };
}

export function LlmUsageTrendChart({ data, labels }: LlmUsageTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        {labels.empty}
      </div>
    );
  }

  return (
    <div className="h-64 w-full" role="img" aria-label={labels.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            yAxisId="tokens"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <YAxis yAxisId="cost" orientation="right" hide />
          <Tooltip
            contentStyle={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />
          <Legend />
          <Area
            yAxisId="tokens"
            type="monotone"
            dataKey="totalTokens"
            name={labels.tokens}
            stroke="var(--info)"
            fill="var(--info)"
            fillOpacity={0.14}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            yAxisId="cost"
            type="monotone"
            dataKey="costUsd"
            name={labels.cost}
            stroke="var(--brand-action)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
