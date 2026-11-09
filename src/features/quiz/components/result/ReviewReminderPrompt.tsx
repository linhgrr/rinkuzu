'use client';

import { useEffect, useEffectEvent, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type {
  ReviewReminderOptInOutcome,
  ReviewReminderPromptStatus,
} from '@/features/quiz/types/quiz-result-page-view-model';

/** Server calls the prompt needs; the result page and the adaptive end screen bind their own. */
export interface ReviewReminderPromptActions {
  loadStatus: () => Promise<ReviewReminderPromptStatus>;
  /** Records consent and schedules the email; also called for a learner already opted in. */
  optIn: () => Promise<ReviewReminderOptInOutcome>;
  snooze: () => Promise<void>;
}

interface ReviewReminderPromptProps extends ReviewReminderPromptActions {
  missedCount: number;
  /** Replaces the missed-questions line (the adaptive end screen has no question count). */
  question?: string;
  /** One button per row at every width, for a narrow column (the adaptive end screen). */
  stacked?: boolean;
  /** Runs after a tap on "Remind me" succeeds (analytics), not for an automatic re-schedule. */
  onOptIn?: () => void;
}

type PromptView =
  | { kind: 'hidden' }
  | { kind: 'ask'; pending: boolean; failed: boolean }
  | { kind: 'scheduled'; scheduledFor: string }
  | { kind: 'capped' };

const HIDDEN: PromptView = { kind: 'hidden' };
const ASK: PromptView = { kind: 'ask', pending: false, failed: false };
const ASK_FAILED: PromptView = { kind: 'ask', pending: false, failed: true };

function outcomeView(outcome: ReviewReminderOptInOutcome): PromptView {
  return outcome.status === 'scheduled'
    ? { kind: 'scheduled', scheduledFor: outcome.scheduledFor }
    : { kind: 'capped' };
}

/**
 * Loading, ineligible, snoozed and failed reads all render nothing. A learner
 * already opted in gets this attempt scheduled too (idempotent on the server).
 */
async function initialView(actions: ReviewReminderPromptActions): Promise<PromptView> {
  try {
    const status = await actions.loadStatus();
    if (!status.eligible || status.snoozedUntil) return HIDDEN;
    if (!status.optedIn) return ASK;
    return outcomeView(await actions.optIn());
  } catch {
    return HIDDEN;
  }
}

function weekdayName(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(iso));
}

/**
 * Explicit 2-day review choice (RIN-1362, spec RIN-1304 AC1/AC2): one line and
 * two buttons of equal weight, nothing preselected. "Remind me" turns into the
 * send weekday; "No thanks" hides the prompt for 7 days on every device.
 */
export function ReviewReminderPrompt({
  missedCount,
  question,
  stacked = false,
  loadStatus,
  optIn,
  snooze,
  onOptIn,
}: ReviewReminderPromptProps) {
  const t = useTranslations('quiz.reviewPrompt');
  const locale = useLocale();
  const questionId = useId();
  const [view, setView] = useState<PromptView | null>(null);

  const loadInitialView = useEffectEvent(() => initialView({ loadStatus, optIn, snooze }));

  useEffect(() => {
    let active = true;
    void loadInitialView().then((next) => {
      if (active) setView(next);
    });
    return () => {
      active = false;
    };
  }, []);

  if (view === null || view.kind === 'hidden') return null;

  const pending = view.kind === 'ask' && view.pending;

  const remind = () => {
    if (pending) return;
    setView({ kind: 'ask', pending: true, failed: false });
    optIn()
      .then((outcome) => {
        setView(outcomeView(outcome));
        onOptIn?.();
      })
      .catch(() => setView(ASK_FAILED));
  };

  const decline = () => {
    if (pending) return;
    setView({ kind: 'ask', pending: true, failed: false });
    snooze()
      .then(() => setView(HIDDEN))
      .catch(() => setView(ASK_FAILED));
  };

  let status: string | null = null;
  if (view.kind === 'scheduled') {
    status = t('scheduled', { weekday: weekdayName(view.scheduledFor, locale) });
  } else if (view.kind === 'capped') {
    status = t('capped');
  } else if (view.failed) {
    status = t('saveError');
  }

  return (
    <div
      className="flex flex-col items-center gap-3 text-center"
      data-testid="review-reminder-prompt"
    >
      {view.kind === 'ask' ? (
        <>
          <p id={questionId} className="text-sm text-ink">
            {question ?? t('question', { count: missedCount })}
          </p>
          <div
            role="group"
            aria-labelledby={questionId}
            className={
              stacked
                ? 'grid w-full grid-cols-1 gap-3'
                : 'grid w-full grid-cols-1 gap-3 min-[400px]:grid-cols-2'
            }
          >
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              aria-disabled={pending}
              aria-busy={pending}
              onClick={remind}
            >
              {t('remind')}
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 w-full"
              aria-disabled={pending}
              onClick={decline}
            >
              {t('decline')}
            </Button>
          </div>
        </>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className={view.kind === 'ask' ? 'text-sm text-error' : 'text-sm text-ink'}
      >
        {status}
      </p>
    </div>
  );
}
