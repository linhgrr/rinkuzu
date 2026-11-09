'use client';

import { useTranslations } from 'next-intl';
import { toDisplayedPersonalDataKinds } from '@/lib/quiz/personal-data-kinds';
import { cn } from '@/lib/utils';

interface PersonalDataNoticeProps {
  /** Kinds from the quiz's personal-data flag; names only, never matched values. */
  kinds: readonly string[];
  className?: string;
}

/**
 * RIN-1342 (spec RIN-1336 Part 3, AC3): tells the owner of a flagged quiz that it
 * stays off Google and what to remove. Secondary help text, not a modal or alert.
 */
export function PersonalDataNotice({ kinds, className }: PersonalDataNoticeProps) {
  const t = useTranslations('create');
  const labels = toDisplayedPersonalDataKinds(kinds).map((kind) =>
    t(`personalDataNotice.kinds.${kind}`),
  );

  return (
    <p className={cn('text-xs leading-5 text-ink-muted', className)}>
      {t('personalDataNotice.text', { kinds: labels.join(' / ') })}
    </p>
  );
}
