'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { HiOutlineFlag } from 'react-icons/hi';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { reportQuizViewModel } from '@/features/quiz/api/quiz-interaction-api';
import { useApiErrorMessage } from '@/lib/api/use-api-error';

interface ReportQuizProps {
  quizSlug: string;
  quizTitle: string;
  questionId: string;
  questionNumber: number;
  questionText: string;
  compact?: boolean;
}

const reportSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
type ReportFormValues = z.infer<typeof reportSchema>;

export default function ReportQuiz({
  quizSlug,
  quizTitle,
  questionId,
  questionNumber,
  questionText,
  compact = false,
}: ReportQuizProps) {
  const { data: session } = useSession();
  const t = useTranslations('report');
  const describeError = useApiErrorMessage();
  const tCommon = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Auto-close after a successful report; the cleanup stops it firing after unmount (RIN-682).
  useEffect(() => {
    if (!isSubmitted) return;
    const timer = setTimeout(() => {
      setIsOpen(false);
      setIsSubmitted(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSubmitted]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, isValid },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    mode: 'onChange',
    defaultValues: { content: '' },
  });

  const contentLength = (useWatch({ control, name: 'content' }) ?? '').length;

  const onSubmit = handleSubmit(async ({ content }) => {
    try {
      await reportQuizViewModel(quizSlug, questionId, content);
      setIsSubmitted(true);
      reset({ content: '' });
    } catch (error) {
      console.error('Error submitting report:', error);
      // Secondary action: a toast with copy from the error layer (RIN-753).
      const message = describeError(error);
      if (message) toast.error(message);
    }
  });

  if (!session) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        // RIN-987: a quiet neutral link at rest (neutral-500 is 7:1 on white),
        // so it never outweighs the question; red only on hover or focus.
        className={`${compact ? 'min-h-11' : 'h-[36px]'} px-3 text-sm font-medium text-neutral-500 hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50 focus-visible:text-red-700`}
        title={t('reportThisQuiz')}
      >
        <HiOutlineFlag data-icon="flag" className="size-4" aria-hidden="true" />
        {t('reportQuestion')}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('reportQuiz')}>
        <div>
          {isSubmitted ? (
            <div className="text-center">
              <div className="size-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="size-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">{t('submitted')}</h3>
              <p className="text-neutral-600">{t('thankYou')}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <p className="mb-2 block text-sm font-medium text-neutral-700">
                  {t('quiz')}: <span className="font-semibold">{quizTitle}</span>
                </p>
                <div className="mb-4 rounded-xl border border-[var(--border-default)] bg-neutral-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {t('questionNumber', { number: questionNumber })}
                  </p>
                  <QuestionContent
                    content={questionText}
                    className="line-clamp-3 text-sm text-neutral-800"
                  />
                </div>
                <p className="mb-4 text-sm text-neutral-500">{t('describeIssue')}</p>
              </div>

              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-neutral-700 mb-2"
                >
                  {t('reportDetails')} *
                </label>
                <Textarea
                  id="content"
                  className="resize-none"
                  rows={6}
                  maxLength={2000}
                  placeholder={t('placeholder')}
                  {...register('content')}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-neutral-500">{t('describeClearly')}</span>
                  <span className="text-xs text-neutral-500">{contentLength}/2000</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  disabled={!isValid || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? t('submitting') : t('submitReport')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}
