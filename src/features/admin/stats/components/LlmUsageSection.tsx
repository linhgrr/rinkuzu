'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatVndCurrency } from '@/lib/formatters';
import { fetchLlmUsageViewModel } from '@/features/admin/stats/api/llm-usage-api';
import type {
  LlmUsageBreakdownRow,
  LlmUsageViewModel,
} from '@/features/admin/stats/types/llm-usage-view-model';

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function BreakdownTable({
  title,
  rows,
  t,
}: {
  title: string;
  rows: LlmUsageBreakdownRow[];
  t: TranslateFn;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('llmUsageEmpty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="pb-2">{t('llmUsageColKey')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCalls')}</th>
                <th className="pb-2 text-right">{t('llmUsageColTokens')}</th>
                <th className="pb-2 text-right">{t('llmUsageColCost')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-neutral-100">
                  <td className="py-1.5">{row.key}</td>
                  <td className="py-1.5 text-right">{row.calls.toLocaleString()}</td>
                  <td className="py-1.5 text-right">{row.totalTokens.toLocaleString()}</td>
                  <td className="py-1.5 text-right">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function LlmUsageSection() {
  const t = useTranslations('admin');
  const [data, setData] = useState<LlmUsageViewModel | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLlmUsageViewModel()
      .then((vm) => {
        if (active) setData(vm);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-4 text-sm text-neutral-500">{t('llmUsageError')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <p className="py-4 text-sm text-neutral-500">{t('llmUsageLoading')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">
        {t('llmUsageTitle', { days: data.windowDays })}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('llmUsageTotalCost')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatVndCurrency(data.totalCostVnd)}</p>
            <p className="text-sm text-neutral-500">${data.totalCostUsd.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('llmUsageTotalTokens')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totalTokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('llmUsageCalls')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.calls.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownTable title={t('llmUsageByAction')} rows={data.byAction} t={t} />
        <BreakdownTable title={t('llmUsageByModel')} rows={data.byModel} t={t} />
      </div>
    </section>
  );
}
