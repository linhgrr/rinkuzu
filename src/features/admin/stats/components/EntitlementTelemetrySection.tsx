'use client';

import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchEntitlementTelemetry } from '@/features/admin/stats/api/entitlement-telemetry-api';

function formatRate(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function EntitlementTelemetrySection() {
  const t = useTranslations('admin');
  const { data, error, isLoading } = useSWR(
    '/api/admin/entitlement-usage?window=30d',
    fetchEntitlementTelemetry,
  );

  if (isLoading) {
    return <p className="text-sm text-neutral-500">{t('entitlementTelemetryLoading')}</p>;
  }
  if (error || !data) {
    return (
      <Card className="p-0">
        <CardContent>
          <p className="py-4 text-sm text-neutral-500">{t('entitlementTelemetryError')}</p>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    [t('entitlementAttempts'), data.totals.attempts.toLocaleString()],
    [
      t('entitlementCommitted'),
      `${data.totals.committed.toLocaleString()} · ${formatRate(data.totals.committed, data.totals.attempts)}`,
    ],
    [
      t('entitlementBlocked'),
      `${data.totals.denied.toLocaleString()} · ${formatRate(data.totals.denied, data.totals.attempts)}`,
    ],
    [t('entitlementActiveUsers'), data.totals.uniqueUsers.toLocaleString()],
  ];
  const askRinRows = data.byCapability.filter((row) => row.capability === 'ask_rin_chan');
  const askRin = askRinRows.reduce(
    (totals, row) => ({
      attempts: totals.attempts + row.attempts,
      committed: totals.committed + row.committed,
      refunded: totals.refunded + row.refunded,
      stale: totals.stale + row.stale,
      freeAttempts: totals.freeAttempts + (row.tier === 'free' ? row.attempts : 0),
      freeDenied: totals.freeDenied + (row.tier === 'free' ? row.denied : 0),
    }),
    { attempts: 0, committed: 0, refunded: 0, stale: 0, freeAttempts: 0, freeDenied: 0 },
  );
  const settledAskRinRuns = askRin.committed + askRin.refunded + askRin.stale;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          {t('entitlementTelemetryTitle', { days: data.windowDays })}
        </h2>
        <p className="text-sm text-neutral-500">{t('entitlementTelemetryDescription')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label} className="p-0">
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-green-200 bg-green-50/40 p-0">
        <CardHeader>
          <CardTitle>{t('askRinTelemetryTitle')}</CardTitle>
          <p className="text-sm text-neutral-500">{t('askRinTelemetryDescription')}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-green-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('askRinAttempts')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">
                {askRin.attempts.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('askRinCompletionRate')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">
                {formatRate(askRin.committed, settledAskRinRuns)}
              </p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('askRinUpgradePressure')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">
                {formatRate(askRin.freeDenied, askRin.freeAttempts)}
              </p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {t('askRinRefundedRuns')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">
                {(askRin.refunded + askRin.stale).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="p-0">
        <CardContent>
          {data.byCapability.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">{t('entitlementTelemetryEmpty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-3">{t('entitlementCapability')}</th>
                    <th className="py-3">{t('entitlementTier')}</th>
                    <th className="py-3 text-right">{t('entitlementAttempts')}</th>
                    <th className="py-3 text-right">{t('entitlementCommitted')}</th>
                    <th className="py-3 text-right">{t('entitlementBlocked')}</th>
                    <th className="py-3 text-right">{t('entitlementRefunded')}</th>
                    <th className="py-3 text-right">{t('entitlementStale')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCapability.map((row) => (
                    <tr
                      key={`${row.capability}-${row.tier}`}
                      className="border-t border-neutral-100"
                    >
                      <td className="py-2 font-medium">{row.capability}</td>
                      <td className="py-2 capitalize">{row.tier}</td>
                      <td className="py-2 text-right">{row.attempts.toLocaleString()}</td>
                      <td className="py-2 text-right">{row.committed.toLocaleString()}</td>
                      <td className="py-2 text-right">{row.denied.toLocaleString()}</td>
                      <td className="py-2 text-right">{row.refunded.toLocaleString()}</td>
                      <td className="py-2 text-right">{row.stale.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            {t('entitlementInFlightNote', {
              inFlight: data.totals.inFlight,
              stale: data.totals.stale,
            })}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
