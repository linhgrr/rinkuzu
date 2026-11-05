'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { isFocusedTaskPath } from '@/lib/routing/pathname';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';
import { fetchMarketingPreferences, saveMarketingPreferences } from '../api/communications-api';

type MarketingPromptPlacement = 'docked' | 'inline';

interface MarketingPreferencePromptProps {
  /**
   * `docked` (app chrome) floats above the bottom navigation; `inline` sits in
   * the page flow. Pages in INLINE_PROMPT_PATHS render the inline one
   * themselves, because a docked card covered their cards (RIN-988).
   */
  placement?: MarketingPromptPlacement;
}

const INLINE_PROMPT_PATHS: readonly string[] = [ROUTES.DASHBOARD];

export function MarketingPreferencePrompt({
  placement = 'docked',
}: MarketingPreferencePromptProps) {
  const locale = useLocale();
  const t = useTranslations('communications.marketingPrompt');
  const { data, mutate } = useSWR('/api/user/marketing-preferences', fetchMarketingPreferences);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pathname = usePathname();
  // Not while the user is mid-task. Reserving the band keeps content reachable;
  // staying away from a quiz in progress is what keeps the task uninterrupted.
  const path = pathname || '/';
  const inline = placement === 'inline';
  const visible =
    Boolean(data) &&
    !data?.updatedAt &&
    !dismissed &&
    !isFocusedTaskPath(path) &&
    (inline || !INLINE_PROMPT_PATHS.includes(path));
  const reservesBand = visible && !inline;

  // Content behind this banner has to reserve the band it occupies, and the
  // only moment that is knowable is while it is mounted. Announcing it on the
  // document element keeps the reservation in one place instead of every page
  // guessing at a bottom padding.
  useEffect(() => {
    if (!reservesBand) return undefined;
    const root = document.documentElement;
    root.setAttribute('data-bottom-prompt', 'true');
    return () => root.removeAttribute('data-bottom-prompt');
  }, [reservesBand]);

  if (!visible) return null;

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
      // Anchored above the mobile bottom navigation rather than across it, so
      // the two do not fight for the same strip of screen.
      className={cn(
        'max-w-xl rounded-xl border border-line bg-surface p-5',
        inline
          ? 'w-full'
          : 'app-bottom-prompt fixed left-4 right-4 z-[70] mx-auto shadow-xl lg:left-auto lg:right-6',
      )}
      data-testid={`marketing-prompt-${placement}`}
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
