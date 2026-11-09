'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { HiOutlineFlag } from 'react-icons/hi';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { reportQuizPage } from '@/features/quiz/api/quiz-interaction-api';
import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { REPORT_REASONS } from '@/shared/constants/report-reason';

/** The dialog caps details below the API's 2000 so the counter stays readable (RIN-1336). */
const REPORT_DETAILS_MAX_LENGTH = 1000;

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH),
  email: z.union([z.literal(''), z.string().trim().max(254).pipe(z.email())]),
  website: z.string(),
});
type ReportFormInput = z.input<typeof reportSchema>;
type ReportFormValues = z.output<typeof reportSchema>;

interface ReportQuizPageLinkProps {
  slug: string;
  /** Signed-in viewer's address: shown read-only, the API takes it from the session. */
  viewerEmail: string | null;
  /** The owner never reports their own quiz. */
  ownedByViewer: boolean;
}

type SubmitState = { status: 'idle' } | { status: 'sent' } | { status: 'failed'; message: string };

/**
 * "Báo cáo"/"Report" link and dialog on a public quiz page (RIN-1344, spec
 * RIN-1336 Part 2b). Anyone, signed out included, can report the whole quiz;
 * the per-question "Báo lỗi" in the player stays separate.
 */
export function ReportQuizPageLink({ slug, viewerEmail, ownedByViewer }: ReportQuizPageLinkProps) {
  const t = useTranslations('report.quizPage');
  const describeError = useApiErrorMessage();
  const [isOpen, setIsOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, isValid, errors },
  } = useForm<ReportFormInput, unknown, ReportFormValues>({
    resolver: zodResolver(reportSchema),
    mode: 'onChange',
    defaultValues: { details: '', email: '', website: '' },
  });
  const detailsLength = (useWatch({ control, name: 'details' }) ?? '').length;

  if (ownedByViewer) return null;

  const close = () => {
    setIsOpen(false);
    if (submitState.status === 'sent') {
      reset();
      setSubmitState({ status: 'idle' });
    }
  };

  const onSubmit = handleSubmit(async ({ reason, details, email, website }) => {
    setSubmitState({ status: 'idle' });
    try {
      await reportQuizPage(slug, {
        reason,
        ...(details ? { details } : {}),
        ...(email && !viewerEmail ? { email } : {}),
        ...(website ? { website } : {}),
      });
      setSubmitState({ status: 'sent' });
    } catch (error) {
      const message =
        describeApiError(error).kind === 'rate_limited'
          ? t('rateLimited')
          : describeError(error, t('failed'));
      setSubmitState({ status: 'failed', message });
    }
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        className="min-h-11 px-2 text-sm font-medium text-neutral-500 hover:text-red-700 focus-visible:text-red-700"
        aria-haspopup="dialog"
      >
        <HiOutlineFlag className="size-4" aria-hidden="true" />
        {t('link')}
      </Button>

      <Modal isOpen={isOpen} onClose={close} title={t('title')}>
        {submitState.status === 'sent' ? (
          <div className="space-y-4 text-center">
            <p role="status" className="text-ink">
              {t('thanks')}
            </p>
            <Button type="button" variant="secondary" onClick={close}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-ink">
                {t('reasonLabel')} <span aria-hidden="true">*</span>
              </legend>
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-surface-blue"
                >
                  <input
                    type="radio"
                    value={reason}
                    className="size-4 accent-[var(--color-accent)]"
                    required
                    {...register('reason')}
                  />
                  {t(`reasons.${reason}`)}
                </label>
              ))}
            </fieldset>

            <div>
              <label
                htmlFor="report-quiz-details"
                className="mb-2 block text-sm font-medium text-ink"
              >
                {t('detailsLabel')}
              </label>
              <Textarea
                id="report-quiz-details"
                rows={4}
                maxLength={REPORT_DETAILS_MAX_LENGTH}
                aria-describedby="report-quiz-details-count"
                {...register('details')}
              />
              <p id="report-quiz-details-count" className="mt-1 text-right text-xs text-ink-muted">
                {t('detailsCount', { count: detailsLength, max: REPORT_DETAILS_MAX_LENGTH })}
              </p>
            </div>

            <div>
              <label
                htmlFor="report-quiz-email"
                className="mb-2 block text-sm font-medium text-ink"
              >
                {t('emailLabel')}
              </label>
              {viewerEmail ? (
                <Input
                  id="report-quiz-email"
                  type="email"
                  value={viewerEmail}
                  readOnly
                  aria-describedby="report-quiz-email-hint"
                />
              ) : (
                <Input
                  id="report-quiz-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  aria-describedby="report-quiz-email-hint"
                  aria-invalid={errors.email ? true : undefined}
                  {...register('email')}
                />
              )}
              <p id="report-quiz-email-hint" className="mt-1 text-xs text-ink-muted">
                {errors.email ? (
                  <span className="text-red-700">{t('emailInvalid')}</span>
                ) : (
                  t('emailHint')
                )}
              </p>
            </div>

            {/* Honeypot: off-screen and out of the tab order, so only a bot fills it. */}
            <div aria-hidden="true" className="sr-only">
              <label htmlFor="report-quiz-website">Website</label>
              <input
                id="report-quiz-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                {...register('website')}
              />
            </div>

            {submitState.status === 'failed' ? (
              <p role="alert" className="text-sm text-red-700">
                {submitState.message}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={close}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!isValid || isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? t('sending') : t('submit')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
