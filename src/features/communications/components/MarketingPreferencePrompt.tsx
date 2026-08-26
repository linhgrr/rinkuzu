'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { fetchMarketingPreferences, saveMarketingPreferences } from '../api/communications-api';

export function MarketingPreferencePrompt() {
  const locale = useLocale();
  const t = useTranslations('communications.marketingPrompt');
  const { data, mutate } = useSWR('/api/user/marketing-preferences', fetchMarketingPreferences);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!data || data.updatedAt || dismissed) return null;

  async function save(productUpdates: boolean, promotions: boolean): Promise<void> {
    setSaving(true);
    setError('');
    try {
      await saveMarketingPreferences({ productUpdates, promotions, locale, source: 'prompt' });
      await mutate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      aria-label={t('label')}
      className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-xl rounded-xl border border-line bg-surface p-5 shadow-xl lg:left-auto lg:right-6"
    >
      <h2 className="font-semibold text-ink">{t('title')}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t('description')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" loading={saving} disabled={saving} onClick={() => save(true, false)}>
          {t('productUpdates')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={saving}
          disabled={saving}
          onClick={() => save(true, true)}
        >
          {t('all')}
        </Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={() => setDismissed(true)}>
          {t('later')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
