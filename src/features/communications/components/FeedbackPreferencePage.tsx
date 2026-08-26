'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { applyFeedbackPreference } from '../api/communications-api';

export function FeedbackPreferencePage() {
  const t = useTranslations('communications.feedbackPreference');
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const initialAction = params.get('action') === 'opt_out' ? 'opt_out' : 'decline';
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function apply(action: 'decline' | 'opt_out'): Promise<void> {
    setLoading(true);
    setError('');
    try {
      await applyFeedbackPreference(token, action);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <p role="status">{t('done')}</p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{t('description')}</p>
              {error ? (
                <p role="alert" className="text-error">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button loading={loading} onClick={() => apply(initialAction)}>
                  {initialAction === 'opt_out' ? t('optOut') : t('decline')}
                </Button>
                {initialAction !== 'opt_out' ? (
                  <Button variant="outline" loading={loading} onClick={() => apply('opt_out')}>
                    {t('optOutAll')}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
