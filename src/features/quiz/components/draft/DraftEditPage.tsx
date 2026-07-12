'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { DraftDesktopOnlyNotice } from '@/features/quiz/components/draft/DraftDesktopOnlyNotice';
import { QuizEditorWorkspace } from '@/features/quiz/components/editor/QuizEditorWorkspace';
import { toEditorQuestions } from '@/features/quiz/lib/question-editor-mutations';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { fetchSubscriptionStatusViewModel } from '@/features/subscription/api/subscription-page-api';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { createPdfObjectUrlFromUrl } from '@/lib/pdf';
import { submitQuizDraft } from '@/lib/quiz/draftApi';
import { ROUTES } from '@/shared/constants/routes';
import { useDraftStore } from '@/store/useDraftStore';

interface DraftEditPageProps {
  initialDraft: QuizDraft;
  pdfUrl?: string;
}

export function DraftEditPage({ initialDraft, pdfUrl }: DraftEditPageProps) {
  const t = useTranslations('create');
  const tCommon = useTranslations('common');
  const { push } = useRouter();
  const { data: session } = useSession();
  const removeDraft = useDraftStore((store) => store.removeDraft);

  const { data: subscriptionStatus } = useSWR(
    session?.user?.role === 'admin' ? null : 'subscription-status',
    fetchSubscriptionStatusViewModel,
  );
  const canCreatePrivateQuiz =
    session?.user?.role === 'admin' || subscriptionStatus?.isPremium === true;

  const { data: pdfDataUrl } = useSWR(
    pdfUrl ? (['draft-edit-pdf', pdfUrl] as const) : null,
    async ([, url]) => createPdfObjectUrlFromUrl(url),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    return () => {
      if (pdfDataUrl) URL.revokeObjectURL(pdfDataUrl);
    };
  }, [pdfDataUrl]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <DraftDesktopOnlyNotice
        title={t('desktopOnlyTitle')}
        description={t('desktopOnlyDescription')}
        backHomeLabel={t('backHome')}
      />

      <div className="hidden md:block">
        <QuizEditorWorkspace
          initial={{
            title: initialDraft.title,
            description: initialDraft.description,
            selectedFolderId: initialDraft.folderId ?? null,
            isPrivate: false,
            questions: toEditorQuestions(initialDraft.questions, 'draft'),
          }}
          pdfUrl={pdfUrl}
          pdfDataUrl={pdfDataUrl}
          pdfLayout="flush"
          canEdit
          showPrivateToggle={canCreatePrivateQuiz}
          requireQuestions
          labels={{
            pageTitle: t('editDraftTitle'),
            questionsCount: (count) => t('questionsExtracted', { count }),
            metaTitle: t('quizTitle'),
            metaDescription: t('uploadDescription'),
            title: t('quizTitle'),
            titlePlaceholder: t('enterTitle'),
            description: t('descriptionOptional'),
            descriptionPlaceholder: t('provideContext'),
            folder: t('folderLabel'),
            privateLabel: t('privateQuiz'),
            privateDescription: t('privateQuizDescription'),
            cancel: tCommon('cancel'),
            submit: t('publishQuiz'),
            submitting: t('publishingQuiz'),
            hidePdf: t('hidePDFReference'),
            showPdf: t('showPDFReference'),
          }}
          onCancel={() => push(ROUTES.DASHBOARD)}
          onSubmit={async (payload) => {
            // BE: submitQuizDraftRequestSchema — questions min 1 via questionListSchema
            if (payload.questions.length === 0) {
              toast.error(t('oneQuestionRequired'));
              throw new Error('no_questions');
            }
            try {
              const result = await submitQuizDraft(initialDraft.id, {
                title: payload.title,
                folderId: payload.selectedFolderId,
                description: payload.description,
                questions: payload.questions,
                isPrivate: payload.isPrivate,
              });
              removeDraft(initialDraft.id);
              toast.success(t('publishSuccess'));
              push(ROUTES.QUIZ.VIEW(result.slug));
            } catch (error: unknown) {
              toast.error(tCommon('error'), {
                description: extractUnknownErrorMessage(error, t('publishFailed')),
              });
              throw error;
            }
          }}
        />
      </div>
    </div>
  );
}
