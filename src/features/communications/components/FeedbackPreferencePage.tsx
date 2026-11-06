'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { isEmailLinkProblem } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { applyFeedbackPreference } from '../api/communications-api';
import {
  EMAIL_LINK_PRIMARY_BUTTON,
  EMAIL_LINK_SECONDARY_BUTTON,
  EmailLinkCard,
} from './EmailLinkCard';

type FeedbackAction = 'decline' | 'opt_out';
type Outcome = 'ready' | 'done' | 'invalid';

type FeedbackPreferencePageProps = {
  token: string;
  initialAction: FeedbackAction;
};

/**
 * Signed-out page behind the "decline / opt out" links in a feedback invitation email.
 * Same shell as the unsubscribe page (RIN-981); a missing or rejected token shows the
 * invalid-link state with no submit, and every end state offers a way home.
 */
export function FeedbackPreferencePage({ token, initialAction }: FeedbackPreferencePageProps) {
  const t = useTranslations('communications.feedbackPreference');
  const apiErrorMessage = useApiErrorMessage();
  const [outcome, setOutcome] = useState<Outcome>(token ? 'ready' : 'invalid');
  const [pending, setPending] = useState<FeedbackAction | null>(null);
  const [error, setError] = useState('');

  async function apply(action: FeedbackAction): Promise<void> {
    setPending(action);
    setError('');
    try {
      await applyFeedbackPreference(token, action);
      setPending(null);
      setOutcome('done');
    } catch (caught) {
      setPending(null);
      // Never the server text (RIN-980): a bad or expired link gets the invalid-link state.
      if (isEmailLinkProblem(caught)) setOutcome('invalid');
      else setError(apiErrorMessage(caught));
    }
  }

  if (outcome === 'done') {
    return (
      <EmailLinkCard icon="done" title={t('doneTitle')} description={t('done')}>
        <Link href="/" prefetch={false} className={EMAIL_LINK_PRIMARY_BUTTON}>
          {t('home')}
        </Link>
      </EmailLinkCard>
    );
  }

  if (outcome === 'invalid') {
    return (
      <EmailLinkCard icon="problem" title={t('invalidTitle')} description={t('invalidDescription')}>
        <Link href="/" prefetch={false} className={EMAIL_LINK_PRIMARY_BUTTON}>
          {t('home')}
        </Link>
      </EmailLinkCard>
    );
  }

  return (
    <EmailLinkCard
      icon={error ? 'problem' : 'mail'}
      title={t('title')}
      description={t('description')}
    >
      {error ? (
        <p
          role="alert"
          className="w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}
      <div className="flex w-full flex-col gap-2">
        <Button
          size="lg"
          className="h-auto min-h-13 w-full whitespace-normal px-4 py-3"
          loading={pending === initialAction}
          disabled={pending !== null}
          onClick={() => apply(initialAction)}
        >
          {initialAction === 'opt_out' ? t('optOut') : t('decline')}
        </Button>
        {initialAction === 'decline' ? (
          <Button
            variant="outline"
            size="lg"
            className="h-auto min-h-13 w-full whitespace-normal px-4 py-3"
            loading={pending === 'opt_out'}
            disabled={pending !== null}
            onClick={() => apply('opt_out')}
          >
            {t('optOutAll')}
          </Button>
        ) : null}
        {error ? (
          <Link href="/" prefetch={false} className={EMAIL_LINK_SECONDARY_BUTTON}>
            {t('home')}
          </Link>
        ) : null}
      </div>
    </EmailLinkCard>
  );
}
