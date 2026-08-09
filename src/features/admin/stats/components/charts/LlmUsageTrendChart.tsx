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

export type LlmTrendMode = 'cost' | 'traffic' | 'reliability' | 'latency';

interface LlmUsageTrendChartProps {
  data: LlmUsageDailyPoint[];
  mode: LlmTrendMode;
  labels: {
    chart: string;
    cost: string;
    success: string;
    failed: string;
    fallback: string;
    latency: string;
    empty: string;
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function LlmUsageTrendChart({ data, mode, labels }: LlmUsageTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-neutral-500">
        {labels.empty}
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    fallbackRate: ratio(point.fallbackOperations, point.logicalOperations),
    averageLatencyMs:
      point.logicalOperations > 0 ? point.totalLatencyMs / point.logicalOperations : 0,
  }));

  return (
    <div className="h-72 w-full" role="img" aria-label={labels.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={54}
            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
            tickFormatter={mode === 'reliability' ? (value) => `${value}%` : undefined}
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
          />
          {mode === 'cost' ? (
            <Area
              type="monotone"
              dataKey="costUsd"
              name={labels.cost}
              stroke="var(--brand-action)"
              fill="var(--brand-action)"
              fillOpacity={0.14}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ) : null}
          {mode === 'traffic' ? (
            <>
              <Area
                type="monotone"
                dataKey="successfulOperations"
                name={labels.success}
                stroke="var(--success)"
                fill="var(--success)"
                fillOpacity={0.12}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="failedOperations"
                name={labels.failed}
                stroke="var(--error)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </>
          ) : null}
          {mode === 'reliability' ? (
            <Line
              type="monotone"
              dataKey="fallbackRate"
              name={labels.fallback}
              stroke="var(--purple-500)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          {mode === 'latency' ? (
            <Line
              type="monotone"
              dataKey="averageLatencyMs"
              name={labels.latency}
              stroke="var(--info)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
