'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { fetchApiData } from '@/lib/api/client';

interface ReportQuizProps {
  quizSlug: string;
  quizTitle: string;
}

export default function ReportQuiz({ quizSlug, quizTitle }: ReportQuizProps) {
  const { data: session } = useSession();
  const t = useTranslations('report');
  const tCommon = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      await fetchApiData<{ reportId: string }>(`/api/quiz/${quizSlug}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() }),
      });
      setIsSubmitted(true);
      setContent('');
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error(error instanceof Error ? error.message : t('failedToSubmit'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(true)}
        className="h-[36px] px-3 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
        title={t('reportThisQuiz')}
      >
        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        {t('reportQuiz')}
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('quiz')}: <span className="font-semibold">{quizTitle}</span>
                </label>
                <p className="text-sm text-neutral-500 mb-4">{t('describeIssue')}</p>
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
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="resize-none"
                  rows={6}
                  maxLength={2000}
                  placeholder={t('placeholder')}
                  required
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-neutral-500">{t('describeClearly')}</span>
                  <span className="text-xs text-neutral-500">{content.length}/2000</span>
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
                  disabled={!content.trim() || isSubmitting}
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
