'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** The Terms section on public quizzes (anchor ships with RIN-1340). */
const PUBLIC_QUIZ_TERMS_HREF = '/terms#public-quizzes';

type PublicQuizNoticeProps = {
  /** `full` before publish (PDF form, manual editor); `short` one line elsewhere. */
  variant: 'full' | 'short';
  /** Only where a "Submit to Premium" checkbox follows the notice on the same form. */
  showPremiumPointer?: boolean;
  className?: string;
};

/**
 * RIN-1339 (spec RIN-1336 Part 1): learner quizzes are public, so every create
 * surface says so before publish. Plain secondary help text: no control, no gate.
 */
export function PublicQuizNotice({
  variant,
  showPremiumPointer = false,
  className,
}: PublicQuizNoticeProps) {
  const t = useTranslations('create');
  const terms = (chunks: ReactNode) => (
    <Link
      href={PUBLIC_QUIZ_TERMS_HREF}
      className="font-medium text-ink underline underline-offset-2 hover:text-brand-trust"
    >
      {chunks}
    </Link>
  );

  if (variant === 'short') {
    return (
      <p className={cn('text-xs leading-5 text-ink-muted', className)}>
        {t.rich('publicNotice.short', { terms })}
      </p>
    );
  }

  return (
    <div className={cn('space-y-1.5 text-xs leading-5 text-ink-muted', className)}>
      <p>{t.rich('publicNotice.full', { terms })}</p>
      {showPremiumPointer ? (
        <p>
          {t.rich('publicNotice.premiumPointer', {
            premiumLabel: t('premiumQuiz'),
            b: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
          })}
        </p>
      ) : null}
    </div>
  );
}
