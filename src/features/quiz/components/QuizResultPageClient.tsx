'use client';

import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Suspense, useEffect, useReducer, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineInformationCircle } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { QuizResultPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { AskRinPanel } from '@/features/ask-rin-chan/components/AskRinPanel';
import {
  createQuizResultBookmark,
  deleteQuizResultBookmark,
  fetchQuizResultPageData,
} from '@/features/quiz/api/quiz-result-page-api';
import type {
  QuizResultBookmarkLookup,
  QuizResultQuestionViewModel,
  QuizResultViewModel,
} from '@/features/quiz/types/quiz-result-page-view-model';
import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { formatCorrectAnswerText } from '@/lib/quiz/answer-text';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { ResultStats } from '@/features/quiz/components/result/ResultStats';
import { QuestionReviewList } from '@/features/quiz/components/result/QuestionReviewList';
import { BookmarkPanel } from '@/features/quiz/components/result/BookmarkPanel';
import { ResultActions, type ResultViewer } from '@/features/quiz/components/result/ResultActions';
import { GuestSaveResultCard } from '@/features/quiz/components/result/GuestSaveResultCard';
import type { QuizShareTarget } from '@/features/quiz/components/result/ShareResultButton';
import { claimStoredGuestAttempts } from '@/features/quiz/api/guest-claim-api';
import { findGuestClaimToken } from '@/features/quiz/lib/guest-claims';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { isQuestionAnswered } from '@/features/quiz/lib/isQuestionAnswered';
import type { QuestionType } from '@/shared/constants/question-type';
import { ROUTES } from '@/shared/constants/routes';

type QuizResultQuestion = QuizResultQuestionViewModel;
type QuizResult = QuizResultViewModel;

interface AIQuestionData {
  question: string;
  options: string[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

type BookmarkMessageTone = 'success' | 'warning' | 'error';
type ResultPageStatus = 'loading' | 'ready' | 'error';

interface QuizResultPageState {
  status: ResultPageStatus;
  result: QuizResult | null;
  /** Why the results could not load; rendered by ErrorState, never as text (RIN-753). */
  error: unknown;
  showAIModal: boolean;
  aiQuestionData: AIQuestionData | null;
  currentQuestionIndex: number;
  bookmarkedQuestions: Set<number>;
  bookmarkIdsByQuestion: Record<number, string>;
  bookmarkLoading: Set<number>;
  bookmarkMessage: string;
  bookmarkMessageTone: BookmarkMessageTone;
  bookmarkToRemove: number | null;
  chatTurnsByQuestion: Record<number, number>;
}

type QuizResultPageAction =
  | { type: 'loadSuccess'; result: QuizResult; bookmarks: QuizResultBookmarkLookup }
  | { type: 'loadError'; error: unknown }
  | { type: 'retryLoad' }
  | { type: 'openAIModal'; questionData: AIQuestionData; questionIndex: number }
  | { type: 'closeAIModal' }
  | { type: 'setBookmarkLoading'; questionIndex: number; loading: boolean }
  | { type: 'addBookmark'; questionIndex: number; bookmarkId?: string }
  | { type: 'removeBookmarkSuccess'; questionIndex: number }
  | { type: 'setBookmarkMessage'; message: string; tone: BookmarkMessageTone }
  | { type: 'clearBookmarkMessage' }
  | { type: 'setChatTurns'; questionIndex: number; turns: number }
  | { type: 'setBookmarkToRemove'; questionIndex: number | null };

const initialQuizResultPageState: QuizResultPageState = {
  status: 'loading',
  result: null,
  error: null,
  showAIModal: false,
  aiQuestionData: null,
  currentQuestionIndex: -1,
  bookmarkedQuestions: new Set<number>(),
  bookmarkIdsByQuestion: {},
  bookmarkLoading: new Set<number>(),
  bookmarkMessage: '',
  bookmarkMessageTone: 'success',
  bookmarkToRemove: null,
  chatTurnsByQuestion: {},
};

function quizResultPageReducer(
  state: QuizResultPageState,
  action: QuizResultPageAction,
): QuizResultPageState {
  switch (action.type) {
    case 'loadSuccess':
      return {
        ...state,
        status: 'ready',
        result: action.result,
        error: null,
        bookmarkedQuestions: action.bookmarks.bookmarkedQuestions,
        bookmarkIdsByQuestion: action.bookmarks.bookmarkIdsByQuestion,
      };
    case 'loadError':
      return {
        ...state,
        status: 'error',
        error: action.error,
      };
    case 'retryLoad':
      return { ...state, status: 'loading', error: null };
    case 'openAIModal':
      return {
        ...state,
        showAIModal: true,
        aiQuestionData: action.questionData,
        currentQuestionIndex: action.questionIndex,
      };
    case 'closeAIModal':
      return {
        ...state,
        showAIModal: false,
        aiQuestionData: null,
        currentQuestionIndex: -1,
      };
    case 'setBookmarkLoading': {
      const nextLoading = new Set(state.bookmarkLoading);

      if (action.loading) {
        nextLoading.add(action.questionIndex);
      } else {
        nextLoading.delete(action.questionIndex);
      }

      return {
        ...state,
        bookmarkLoading: nextLoading,
      };
    }
    case 'addBookmark': {
      const nextBookmarked = new Set(state.bookmarkedQuestions);
      const nextLoading = new Set(state.bookmarkLoading);
      nextBookmarked.add(action.questionIndex);
      nextLoading.delete(action.questionIndex);

      return {
        ...state,
        bookmarkedQuestions: nextBookmarked,
        bookmarkLoading: nextLoading,
        bookmarkIdsByQuestion: action.bookmarkId
          ? { ...state.bookmarkIdsByQuestion, [action.questionIndex]: action.bookmarkId }
          : state.bookmarkIdsByQuestion,
      };
    }
    case 'removeBookmarkSuccess': {
      const nextBookmarked = new Set(state.bookmarkedQuestions);
      const nextLoading = new Set(state.bookmarkLoading);
      nextBookmarked.delete(action.questionIndex);
      nextLoading.delete(action.questionIndex);
      const nextBookmarkIds = { ...state.bookmarkIdsByQuestion };
      delete nextBookmarkIds[action.questionIndex];

      return {
        ...state,
        bookmarkedQuestions: nextBookmarked,
        bookmarkLoading: nextLoading,
        bookmarkIdsByQuestion: nextBookmarkIds,
        bookmarkToRemove: null,
      };
    }
    case 'setBookmarkMessage':
      return {
        ...state,
        bookmarkMessage: action.message,
        bookmarkMessageTone: action.tone,
      };
    case 'clearBookmarkMessage':
      return {
        ...state,
        bookmarkMessage: '',
      };
    case 'setChatTurns':
      return {
        ...state,
        chatTurnsByQuestion: {
          ...state.chatTurnsByQuestion,
          [action.questionIndex]: action.turns,
        },
      };
    case 'setBookmarkToRemove':
      return {
        ...state,
        bookmarkToRemove: action.questionIndex,
      };
    default:
      return state;
  }
}

function formatAnswerValue(
  answer: number | number[],
  options: string[],
  type: QuestionType,
  notAnsweredLabel: string,
  isAnswered = true,
) {
  if (!isAnswered) {
    return notAnsweredLabel;
  }

  if (type === 'single') {
    return typeof answer === 'number' ? (options[answer] ?? notAnsweredLabel) : notAnsweredLabel;
  }

  if (!Array.isArray(answer)) {
    return notAnsweredLabel;
  }
  const selectedOptions = answer.map((index) => options[index]);
  return selectedOptions.every((option): option is string => option !== undefined)
    ? selectedOptions.join(', ')
    : notAnsweredLabel;
}

function QuizResultActions({
  backHomeLabel,
  encodedSlug,
  redoLabel,
}: {
  backHomeLabel: string;
  encodedSlug: string;
  redoLabel: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap justify-center gap-3">
      <Link href={`/quiz/${encodedSlug}`}>
        <Button variant="outline">{redoLabel}</Button>
      </Link>
      <Link href="/">
        <Button>{backHomeLabel}</Button>
      </Link>
    </div>
  );
}

interface QuizResultReadyStateProps {
  aiQuestionData: AIQuestionData | null;
  bookmarkedQuestions: Set<number>;
  bookmarkLoading: Set<number>;
  bookmarkMessage: string;
  bookmarkMessageTone: BookmarkMessageTone;
  bookmarkToRemove: number | null;
  chatStats: { totalTurns: number; questionsWithChat: number };
  chatTurnsByQuestion: Readonly<Record<number, number>>;
  closeAIModal: () => void;
  currentQuestionIndex: number;
  viewer: ResultViewer;
  formatAnswer: (
    answer: number | number[],
    options: string[],
    type: QuestionType,
    isAnswered?: boolean,
  ) => string;
  formatCorrectAnswer: (question: QuizResultQuestion) => string;
  /** The signed-out "save your result" card, shown under the score (RIN-912). */
  guestSaveCard: ReactNode;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onDismissBookmarkMessage: () => void;
  onChatHistoryChange: (questionIndex: number, turns: number) => void;
  onOpenAI: (questionData: AIQuestionData, questionIndex: number) => void;
  onToggleBookmark: (questionIndex: number, questionData: QuizResultQuestion) => void;
  result: QuizResult;
  scoreColor: (score: number) => string;
  scoreMessage: (score: number) => string;
  showAIModal: boolean;
  stats: {
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    totalQuestions: number;
  };
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tProfile: (key: string) => string;
}

interface QuizResultStatsSummary {
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
}

interface QuizResultChatSummary {
  totalTurns: number;
  questionsWithChat: number;
}

function buildQuizResultStats(result: QuizResult | null): QuizResultStatsSummary {
  if (!result) {
    return {
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 0,
      totalQuestions: 0,
    };
  }

  const correctCount = result.quiz.questions.filter((question) => question.isCorrect).length;
  const incorrectCount = result.quiz.questions.filter(
    (question) => !question.isCorrect && isQuestionAnswered(question, question.userAnswer),
  ).length;
  const unansweredCount = result.quiz.questions.filter(
    (question) => !isQuestionAnswered(question, question.userAnswer),
  ).length;

  return {
    correctCount,
    incorrectCount,
    unansweredCount,
    totalQuestions: result.quiz.questions.length,
  };
}

function getQuizResultScoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getQuizResultScoreMessage(score: number, tProfile: (key: string) => string) {
  if (score >= 90) return tProfile('excellent');
  if (score >= 80) return tProfile('great');
  if (score >= 70) return tProfile('good');
  if (score >= 60) return tProfile('pass');
  return tProfile('needsWork');
}

/** Who is reading the result: `pending` while the session settles (RIN-912). */
type ResultReader = 'pending' | 'member' | 'guest';

function useQuizResultPageData(
  attemptId: string | null,
  locale: string,
  reader: ResultReader,
  guestUserEmail: string | null,
) {
  const [state, dispatch] = useReducer(quizResultPageReducer, initialQuizResultPageState);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const describeError = useApiErrorMessage();

  useEffect(() => {
    let isActive = true;

    const loadResults = async () => {
      if (reader === 'pending') return;
      if (!attemptId) {
        // A result link without an attempt id points at nothing.
        dispatch({ type: 'loadError', error: { code: 'not_found', status: 404 } });
        return;
      }

      // A guest reads with the claim token saved at submit; legacy links carry userEmail.
      const guestClaimToken = reader === 'guest' ? findGuestClaimToken(attemptId) : null;
      const legacyEmail = reader === 'guest' ? guestUserEmail : null;
      if (reader === 'guest' && !guestClaimToken && !legacyEmail) {
        // Another device or cleared storage: nothing here can open this attempt.
        dispatch({ type: 'loadError', error: { code: 'not_found', status: 404 } });
        return;
      }

      try {
        // Back from "Save your result": wait until this browser's guest results are
        // the learner's, so the read below finds the attempt (RIN-912 part 4).
        if (reader === 'member') await claimStoredGuestAttempts();
        const pageData = await fetchQuizResultPageData(
          attemptId,
          locale,
          guestClaimToken
            ? { guestClaimToken }
            : legacyEmail
              ? { userEmail: legacyEmail }
              : undefined,
        );

        if (isActive) {
          dispatch({
            type: 'loadSuccess',
            result: pageData.result,
            bookmarks: pageData.bookmarks,
          });
        }
      } catch (error: unknown) {
        if (isActive) {
          dispatch({ type: 'loadError', error });
        }
      }
    };

    void loadResults();

    return () => {
      isActive = false;
    };
  }, [attemptId, guestUserEmail, locale, loadAttempt, reader]);

  const retryLoad = () => {
    dispatch({ type: 'retryLoad' });
    setLoadAttempt((attempt) => attempt + 1);
  };

  const showBookmarkMessage = (tone: BookmarkMessageTone, message: string) => {
    dispatch({ type: 'setBookmarkMessage', message, tone });
    window.setTimeout(() => {
      dispatch({ type: 'clearBookmarkMessage' });
    }, 3000);
  };

  const removeBookmark = async (questionIndex: number) => {
    const bookmarkId = state.bookmarkIdsByQuestion[questionIndex];

    if (!bookmarkId) {
      showBookmarkMessage('error', 'Bookmark not found, please refresh and try again');
      return;
    }

    dispatch({ type: 'setBookmarkLoading', questionIndex, loading: true });

    try {
      await deleteQuizResultBookmark(bookmarkId);
      dispatch({ type: 'removeBookmarkSuccess', questionIndex });
      showBookmarkMessage('success', 'Bookmark removed');
    } catch (error: unknown) {
      console.error('Error removing bookmark:', error);
      showBookmarkMessage('error', describeError(error));
      dispatch({ type: 'setBookmarkLoading', questionIndex, loading: false });
    }
  };

  const toggleBookmark = async (questionIndex: number, questionData: QuizResultQuestion) => {
    if (!state.result) {
      return;
    }

    if (state.bookmarkedQuestions.has(questionIndex)) {
      dispatch({ type: 'setBookmarkToRemove', questionIndex });
      return;
    }

    dispatch({ type: 'setBookmarkLoading', questionIndex, loading: true });

    try {
      const created = await createQuizResultBookmark({
        result: state.result,
        questionIndex,
        question: questionData,
      });

      dispatch({ type: 'addBookmark', questionIndex, bookmarkId: created.id });
      showBookmarkMessage('success', 'Question bookmarked successfully!');
    } catch (error: unknown) {
      console.error('Error toggling bookmark:', error);
      // POST /api/bookmarks answers a duplicate with 400 validation_error.
      if (describeApiError(error).kind === 'validation') {
        showBookmarkMessage('warning', 'This question is already bookmarked');
      } else {
        showBookmarkMessage('error', describeError(error));
      }
      dispatch({ type: 'setBookmarkLoading', questionIndex, loading: false });
    }
  };

  const stats = buildQuizResultStats(state.result);

  return {
    state,
    dispatch,
    stats,
    toggleBookmark,
    removeBookmark,
    retryLoad,
  };
}

/** "Send to a classmate" target (RIN-1179); null unless the server marked the quiz shareable. */
function shareTargetFor(result: QuizResult): QuizShareTarget | null {
  if (!result.quiz.shareable) return null;
  return {
    quizId: result.quiz.id,
    slug: result.quiz.slug,
    title: result.quiz.title,
    quizQuestionCount: result.quiz.questionCount,
    answeredCount: result.totalQuestions,
  };
}

function QuizResultReadyState({
  aiQuestionData,
  bookmarkedQuestions,
  bookmarkLoading,
  bookmarkMessage,
  bookmarkMessageTone,
  bookmarkToRemove,
  chatStats,
  chatTurnsByQuestion,
  closeAIModal,
  currentQuestionIndex,
  viewer,
  formatAnswer,
  formatCorrectAnswer,
  guestSaveCard,
  onCancelRemove,
  onConfirmRemove,
  onDismissBookmarkMessage,
  onChatHistoryChange,
  onOpenAI,
  onToggleBookmark,
  result,
  scoreColor,
  scoreMessage,
  showAIModal,
  stats,
  t,
  tProfile,
}: QuizResultReadyStateProps) {
  const contentLocked = result.historyStatus === 'content_locked';
  return (
    <div className="min-h-dvh bg-surface-page">
      <div className="bg-surface shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-ink">
              {result.mode === 'quick'
                ? t('quickRound.resultTitle', {
                    correct: stats.correctCount,
                    total: stats.totalQuestions,
                  })
                : t('quizComplete')}
            </h1>
            <p className="mt-2 text-ink-muted">{result.quiz.title}</p>
            {result.retryOfAttemptId ? (
              <p className="text-sm text-ink-muted">{t('resultActions.retryOfMissed')}</p>
            ) : null}
            <p className="text-sm text-ink-muted" suppressHydrationWarning>
              {t('completedOn')} {result.takenAtLabel}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {contentLocked ? (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-brand-trust">{result.score}%</p>
              <p className="mt-2 text-sm font-semibold text-amber-900">
                {t('premiumHistoryLockedTitle')}
              </p>
              <p className="mt-1 text-sm text-amber-800">{t('premiumHistoryLockedDescription')}</p>
            </CardContent>
          </Card>
        ) : (
          <ResultStats
            score={result.score}
            correctCount={stats.correctCount}
            incorrectCount={stats.incorrectCount}
            unansweredCount={stats.unansweredCount}
            totalQuestions={stats.totalQuestions}
            chatStats={chatStats}
            getScoreColor={scoreColor}
            getScoreMessage={scoreMessage}
            t={t}
            tProfile={tProfile}
          />
        )}

        {guestSaveCard}

        <ResultActions
          attemptId={result.id}
          slug={result.quiz.slug}
          missedCount={result.missedCount}
          nextQuiz={result.nextQuiz}
          viewer={viewer}
          contentLocked={contentLocked}
          quickRound={result.mode === 'quick'}
          share={shareTargetFor(result)}
        />

        {!contentLocked ? (
          <>
            <BookmarkPanel
              bookmarkMessage={bookmarkMessage}
              bookmarkMessageTone={bookmarkMessageTone}
              onDismissMessage={onDismissBookmarkMessage}
              bookmarkToRemove={bookmarkToRemove}
              bookmarkLoading={bookmarkLoading}
              onCancelRemove={onCancelRemove}
              onConfirmRemove={onConfirmRemove}
              t={t}
            />

            <QuestionReviewList
              questions={result.quiz.questions}
              bookmarkedQuestions={bookmarkedQuestions}
              bookmarkLoading={bookmarkLoading}
              onToggleBookmark={onToggleBookmark}
              onOpenAI={onOpenAI}
              chatTurnsByQuestion={chatTurnsByQuestion}
              formatAnswer={formatAnswer}
              formatCorrectAnswer={formatCorrectAnswer}
              t={t}
              tProfile={tProfile}
            />
          </>
        ) : null}
      </main>

      {aiQuestionData ? (
        <AskRinPanel
          isOpen={showAIModal}
          onClose={closeAIModal}
          context={{
            source: 'quiz',
            question: aiQuestionData.question,
            options: aiQuestionData.options ?? [],
            optionImages: aiQuestionData.optionImages?.map((image) => image ?? null) ?? [],
            ...(aiQuestionData.questionImage
              ? { questionImage: aiQuestionData.questionImage }
              : {}),
          }}
          contextPreview={
            <QuestionOptionsPreview
              questionText={aiQuestionData.question}
              options={aiQuestionData.options ?? []}
              {...(aiQuestionData.questionImage
                ? { questionImage: aiQuestionData.questionImage }
                : {})}
              {...(aiQuestionData.optionImages
                ? { optionImages: aiQuestionData.optionImages }
                : {})}
            />
          }
          onHistoryChange={({ totalTurns }) =>
            onChatHistoryChange(currentQuestionIndex, totalTurns)
          }
        />
      ) : null}
    </div>
  );
}

function toResultReader(sessionStatus: string): ResultReader {
  if (sessionStatus === 'loading') return 'pending';
  return sessionStatus === 'authenticated' ? 'member' : 'guest';
}

function parseUrlScore(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const score = Number(raw);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? Math.round(score) : null;
}

/**
 * A failed read that still shows the score from the link. A member keeps it when this
 * browser holds the guest token (signed in to save the result) or when the attempt is
 * not theirs yet: signed in from another browser before it was claimed (RIN-1310).
 */
function keepsGuestScore(reader: ResultReader, attemptId: string | null, error: unknown) {
  if (reader === 'guest') return true;
  if (attemptId !== null && findGuestClaimToken(attemptId) !== null) return true;
  return error !== null && describeApiError(error).kind === 'not_found';
}

function guestResultPath(encodedSlug: string, attemptId: string | null, score: number | null) {
  const params = new URLSearchParams();
  if (attemptId) params.set('attemptId', attemptId);
  if (score !== null) params.set('score', String(score));
  return `${ROUTES.QUIZ.RESULT(encodedSlug)}?${params.toString()}`;
}

/**
 * A guest attempt that cannot be read here (no token, or the read failed): RIN-912.
 * Also shown, without the save card, to a guest who just signed in from that card:
 * their attempt is not linked to the account until parts 3–4 (RIN-920/921) ship.
 */
function GuestScoreOnlyResult({
  backHomeLabel,
  encodedSlug,
  redoLabel,
  resultPath,
  score,
  showSaveCard,
  t,
}: {
  backHomeLabel: string;
  encodedSlug: string;
  redoLabel: string;
  resultPath: string;
  score: number;
  showSaveCard: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="min-h-dvh bg-surface-page">
      <div className="bg-surface shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <h1 className="text-2xl font-semibold text-ink">{t('quizComplete')}</h1>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <p className="text-4xl font-bold text-brand-trust">{score}%</p>
          </CardContent>
        </Card>
        {showSaveCard ? <GuestSaveResultCard resultPath={resultPath} variant="scoreOnly" /> : null}
        <QuizResultActions
          backHomeLabel={backHomeLabel}
          encodedSlug={encodedSlug}
          redoLabel={redoLabel}
        />
        <p role="status" className="flex items-start justify-center gap-2 text-sm text-ink-muted">
          <HiOutlineInformationCircle className="mt-0.5 size-5 flex-shrink-0" aria-hidden="true" />
          {t('guestReviewUnavailable')}
        </p>
      </main>
    </div>
  );
}

function QuizResultContent() {
  const t = useTranslations('quiz');
  const tProfile = useTranslations('profile');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const attemptId = get('attemptId');
  const guestUserEmail = get('userEmail');
  const urlScore = parseUrlScore(get('score'));
  const { status: sessionStatus } = useSession();
  const reader = toResultReader(sessionStatus);
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const viewer: ResultViewer = reader === 'member' ? 'signed_in' : reader;
  const { state, dispatch, stats, toggleBookmark, removeBookmark, retryLoad } =
    useQuizResultPageData(attemptId, locale, reader, guestUserEmail);
  const chatTurnCounts = Object.values(state.chatTurnsByQuestion);
  const chatStats: QuizResultChatSummary = {
    totalTurns: chatTurnCounts.reduce((sum, turns) => sum + turns, 0),
    questionsWithChat: chatTurnCounts.filter((turns) => turns > 0).length,
  };
  const openAIModal = (questionData: AIQuestionData, questionIndex: number) => {
    dispatch({ type: 'openAIModal', questionData, questionIndex });
  };
  const closeAIModal = () => dispatch({ type: 'closeAIModal' });
  const result = state.result;

  if (state.status === 'loading' || reader === 'pending') {
    return <QuizResultPageSkeleton label={`${t('loadingQuiz')}...`} />;
  }

  // Where sign-in comes back to; never carries the email or the token.
  const resultPath = guestResultPath(encodedSlug, attemptId, urlScore ?? result?.score ?? null);

  const holdsGuestScore =
    (state.error !== null || !result) &&
    urlScore !== null &&
    keepsGuestScore(reader, attemptId, state.error);

  if (holdsGuestScore) {
    return (
      <GuestScoreOnlyResult
        backHomeLabel={t('backHome')}
        encodedSlug={encodedSlug}
        redoLabel={tProfile('redo')}
        resultPath={resultPath}
        score={urlScore}
        showSaveCard={reader === 'guest'}
        t={t}
      />
    );
  }

  if (state.error !== null || !result) {
    // The whole result failed to load: page variant, copy from the error layer (RIN-753).
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-page px-4">
        <ErrorState error={state.error} variant="page" onRetry={retryLoad} />
      </div>
    );
  }

  return (
    <QuizResultReadyState
      aiQuestionData={state.aiQuestionData}
      bookmarkedQuestions={state.bookmarkedQuestions}
      bookmarkLoading={state.bookmarkLoading}
      bookmarkMessage={state.bookmarkMessage}
      bookmarkMessageTone={state.bookmarkMessageTone}
      bookmarkToRemove={state.bookmarkToRemove}
      chatStats={chatStats}
      chatTurnsByQuestion={state.chatTurnsByQuestion}
      closeAIModal={closeAIModal}
      currentQuestionIndex={state.currentQuestionIndex}
      viewer={viewer}
      formatAnswer={(answer, options, type, isAnswered) =>
        formatAnswerValue(answer, options, type, t('notAnswered'), isAnswered)
      }
      formatCorrectAnswer={formatCorrectAnswerText}
      guestSaveCard={
        reader === 'guest' ? <GuestSaveResultCard resultPath={resultPath} variant="review" /> : null
      }
      onCancelRemove={() => dispatch({ type: 'setBookmarkToRemove', questionIndex: null })}
      onConfirmRemove={() =>
        state.bookmarkToRemove !== null && void removeBookmark(state.bookmarkToRemove)
      }
      onDismissBookmarkMessage={() => dispatch({ type: 'clearBookmarkMessage' })}
      onChatHistoryChange={(questionIndex, turns) =>
        dispatch({ type: 'setChatTurns', questionIndex, turns })
      }
      onOpenAI={openAIModal}
      onToggleBookmark={toggleBookmark}
      result={result}
      scoreColor={getQuizResultScoreColor}
      scoreMessage={(score) => getQuizResultScoreMessage(score, tProfile)}
      showAIModal={state.showAIModal}
      stats={stats}
      t={t}
      tProfile={tProfile}
    />
  );
}

export function QuizResultPageClient() {
  return (
    <Suspense fallback={<QuizResultPageSkeleton label="Loading results..." />}>
      <QuizResultContent />
    </Suspense>
  );
}
