'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { HiOutlineArrowLeft, HiOutlineTag } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { QuizTextField } from '@/features/guest-draft/components/QuizTextField';
import { quizTextLimitState } from '@/features/guest-draft/lib/quiz-text-limit';
import { CreateQuizErrorAlert } from '@/features/quiz/components/create/CreateQuizErrorAlert';
import { getCreateQuizDraftErrorMessage } from '@/features/quiz/components/create/create-quiz-draft-error';
import { PublicQuizNotice } from '@/features/quiz/components/PublicQuizNotice';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiResponseError } from '@/lib/api/client';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { createTextQuizDraft } from '@/lib/quiz/draftApi';
import { QUIZ_TEXT_MAX_CHARS, QUIZ_TEXT_MIN_CHARS } from '@/shared/constants/quiz-text-source';
import { ROUTES } from '@/shared/constants/routes';
import { useDraftStore } from '@/store/useDraftStore';

const LIMITS = { min: QUIZ_TEXT_MIN_CHARS, max: QUIZ_TEXT_MAX_CHARS } as const;
/** Same cap as a draft title elsewhere in the create flow. */
const TITLE_MAX_LENGTH = 120;

type Translator = ReturnType<typeof useTranslations<'create'>>;

/**
 * The route's own length refusals (413 too long, 422 too short) get the text copy; every
 * other failure reads like the PDF flow. A quota refusal also opens the upgrade modal,
 * through the API error events `UpgradePromptProvider` listens to.
 */
function textDraftErrorMessage(
  error: unknown,
  t: Translator,
  apiErrorMessage: ReturnType<typeof useApiErrorMessage>,
): string {
  if (error instanceof ApiResponseError && error.status === 413) return t('text.tooLong', LIMITS);
  if (error instanceof ApiResponseError && error.status === 422) return t('text.tooShort', LIMITS);
  return getCreateQuizDraftErrorMessage(error, t, apiErrorMessage);
}

interface SubmitState {
  submitting: boolean;
  error: string;
}

/**
 * Signed-in `/create/text` (RIN-1542, UI spec on RIN-1539 section 4): title and pasted
 * text become a draft that lands in the normal draft review, as a PDF draft does.
 */
export function CreateTextQuizPage() {
  const t = useTranslations('create');
  const apiErrorMessage = useApiErrorMessage();
  const { push } = useRouter();
  const { addDraft } = useDraftStore();
  const hintId = useId();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [submit, setSubmit] = useState<SubmitState>({ submitting: false, error: '' });
  const limit = quizTextLimitState(text);
  const { submitting } = submit;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || limit.kind !== 'ok') return;
    setSubmit({ submitting: true, error: '' });
    const draftTitle = title.trim() || t('untitledQuiz');
    try {
      const draft = await createTextQuizDraft({ title: draftTitle, text });
      addDraft({
        id: draft.id,
        title: draftTitle,
        status: 'processing',
        chunksTotal: 1,
        chunksProcessed: 0,
        chunksError: 0,
        questionsCount: 0,
        createdAt: new Date().toISOString(),
        ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      });
      toast.success(t('processingStarted'));
      push(ROUTES.CREATE_QUIZ);
    } catch (error: unknown) {
      setSubmit({
        submitting: false,
        error: textDraftErrorMessage(error, t, apiErrorMessage),
      });
    }
  };

  return (
    <main className="min-h-[100dvh] bg-neutral-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={ROUTES.CREATE_QUIZ}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-950"
        >
          <HiOutlineArrowLeft className="size-4" aria-hidden="true" />
          {t('createHubTitle')}
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t('text.title')}
          </h1>
          <p className="text-base text-neutral-600">{t('text.subtitle', LIMITS)}</p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          <CreateQuizErrorAlert message={submit.error} focusOnShow />
          <Input
            label={t('text.quizTitle')}
            id="text-quiz-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('untitledQuiz')}
            maxLength={TITLE_MAX_LENGTH}
            readOnly={submitting}
            icon={<HiOutlineTag className="size-5" />}
          />
          <QuizTextField
            value={text}
            onChange={setText}
            limit={limit}
            hintId={hintId}
            readOnly={submitting}
          />
          <Button
            type="submit"
            size="lg"
            loading={submitting}
            disabled={limit.kind !== 'ok' || submitting}
            aria-describedby={hintId}
            className="h-14 w-full sm:w-auto sm:min-w-64"
          >
            {submit.error ? t('text.tryAgain') : t('text.submit')}
          </Button>
        </form>
        <PublicQuizNotice variant="short" />
      </div>
    </main>
  );
}
