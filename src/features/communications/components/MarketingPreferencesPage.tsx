'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchMarketingPreferences, saveMarketingPreferences } from '../api/communications-api';

interface MarketingPreferencesPageProps {
  embedded?: boolean;
}

export function MarketingPreferencesPage({ embedded = false }: MarketingPreferencesPageProps) {
  const locale = useLocale();
  const t = useTranslations('communications.marketingPreferences');
  const { data, error, mutate } = useSWR(
    '/api/user/marketing-preferences',
    fetchMarketingPreferences,
  );
  if (error)
    return (
      <div role="alert" className="p-8 text-error">
        {t('loadError')}
      </div>
    );
  if (!data) return <div className="p-8">{t('loading')}</div>;
  return (
    <MarketingPreferencesForm
      initial={data}
      locale={locale}
      embedded={embedded}
      onSaved={async () => {
        await mutate();
      }}
    />
  );
}

interface MarketingPreferencesFormProps {
  initial: { productUpdates: boolean; promotions: boolean };
  locale: string;
  embedded: boolean;
  onSaved: () => Promise<void>;
}

function MarketingPreferencesForm({
  initial,
  locale,
  embedded,
  onSaved,
}: MarketingPreferencesFormProps) {
  const [productUpdates, setProductUpdates] = useState(initial.productUpdates);
  const [promotions, setPromotions] = useState(initial.promotions);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const t = useTranslations('communications.marketingPreferences');

  async function save(): Promise<void> {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await saveMarketingPreferences({ productUpdates, promotions, locale, source: 'settings' });
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="email-preferences" className={embedded ? 'max-w-2xl' : 'mx-auto max-w-2xl px-4 py-8'}>
      <Card className="p-0 sm:p-6">
        <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-4 pt-4 sm:p-6 sm:pt-4">
          <p className="text-sm text-ink-muted">{t('description')}</p>
          <label className="flex items-start gap-3 rounded-lg border border-line p-4">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={productUpdates}
              onChange={(event) => setProductUpdates(event.target.checked)}
            />
            <span>
              <strong className="block">{t('productUpdates')}</strong>
              <span className="text-sm text-ink-muted">{t('productUpdatesDescription')}</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-line p-4">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={promotions}
              onChange={(event) => setPromotions(event.target.checked)}
            />
            <span>
              <strong className="block">{t('promotions')}</strong>
              <span className="text-sm text-ink-muted">{t('promotionsDescription')}</span>
            </span>
          </label>
          {saved ? (
            <p role="status" className="text-success">
              {t('saved')}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-error">
              {error}
            </p>
          ) : null}
          <Button onClick={save} loading={saving}>
            {t('save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
