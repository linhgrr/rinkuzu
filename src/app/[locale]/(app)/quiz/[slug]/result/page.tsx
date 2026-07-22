'use client';

import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Suspense, useEffect, useReducer } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { formatCorrectAnswerText } from '@/lib/quiz/answer-text';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { ResultStats } from '@/features/quiz/components/result/ResultStats';
import { QuestionReviewList } from '@/features/quiz/components/result/QuestionReviewList';
import { BookmarkPanel } from '@/features/quiz/components/result/BookmarkPanel';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { isQuestionAnswered } from '@/features/quiz/lib/isQuestionAnswered';
import type { QuestionType } from '@/shared/constants/question-type';

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
  error: string | null;
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
  | { type: 'loadError'; error: string }
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

function QuizResultErrorState({
  actionLabel,
  error,
  title,
}: {
  actionLabel: string;
  error: string | null;
  title: string;
}) {
  return (
    <div className="min-h-dvh bg-surface-page flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-red-600">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-ink-muted mb-4">{error}</p>
          <Link href="/">
            <Button>{actionLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
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
    <div className="flex justify-center gap-x-4">
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
  backHomeLabel: string;
  bookmarkedQuestions: Set<number>;
  bookmarkLoading: Set<number>;
  bookmarkMessage: string;
  bookmarkMessageTone: BookmarkMessageTone;
  bookmarkToRemove: number | null;
  chatStats: { totalTurns: number; questionsWithChat: number };
  chatTurnsByQuestion: Readonly<Record<number, number>>;
  closeAIModal: () => void;
  currentQuestionIndex: number;
  encodedSlug: string;
  formatAnswer: (
    answer: number | number[],
    options: string[],
    type: QuestionType,
    isAnswered?: boolean,
  ) => string;
  formatCorrectAnswer: (question: QuizResultQuestion) => string;
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

function useQuizResultPageData(
  attemptId: string | null,
  locale: string,
  guestUserEmail: string | null,
) {
  const [state, dispatch] = useReducer(quizResultPageReducer, initialQuizResultPageState);

  useEffect(() => {
    let isActive = true;

    const loadResults = async () => {
      if (!attemptId) {
        dispatch({ type: 'loadError', error: 'No attempt ID provided' });
        return;
      }

      try {
        const pageData = await fetchQuizResultPageData(
          attemptId,
          locale,
          guestUserEmail ? { userEmail: guestUserEmail } : undefined,
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
          dispatch({
            type: 'loadError',
            error: extractUnknownErrorMessage(error, 'Failed to load results'),
          });
        }
      }
    };

    void loadResults();

    return () => {
      isActive = false;
    };
  }, [attemptId, guestUserEmail, locale]);

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
      showBookmarkMessage(
        'error',
        extractUnknownErrorMessage(error, 'Network error, please try again'),
      );
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
      const message = extractUnknownErrorMessage(error, 'Network error, please try again');

      if (message === 'Question already bookmarked') {
        showBookmarkMessage('warning', 'This question is already bookmarked');
      } else {
        showBookmarkMessage('error', message);
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
  };
}

function QuizResultReadyState({
  aiQuestionData,
  backHomeLabel,
  bookmarkedQuestions,
  bookmarkLoading,
  bookmarkMessage,
  bookmarkMessageTone,
  bookmarkToRemove,
  chatStats,
  chatTurnsByQuestion,
  closeAIModal,
  currentQuestionIndex,
  encodedSlug,
  formatAnswer,
  formatCorrectAnswer,
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
  return (
    <div className="min-h-dvh bg-surface-page">
      <div className="bg-surface shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-ink">{t('quizComplete')}</h1>
            <p className="mt-2 text-ink-muted">{result.quiz.title}</p>
            <p className="text-sm text-ink-muted" suppressHydrationWarning>
              {t('completedOn')} {result.takenAtLabel}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <QuizResultActions
          backHomeLabel={backHomeLabel}
          encodedSlug={encodedSlug}
          redoLabel={tProfile('redo')}
        />
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

function QuizResultPageClient() {
  const t = useTranslations('quiz');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const attemptId = get('attemptId');
  const guestUserEmail = get('userEmail');
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const { state, dispatch, stats, toggleBookmark, removeBookmark } = useQuizResultPageData(
    attemptId,
    locale,
    guestUserEmail,
  );
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

  if (state.status === 'loading') {
    return <QuizResultPageSkeleton label={`${t('loadingQuiz')}...`} />;
  }

  if (state.error || !result) {
    return (
      <QuizResultErrorState
        actionLabel={t('backHome')}
        error={state.error}
        title={tCommon('error')}
      />
    );
  }

  return (
    <QuizResultReadyState
      aiQuestionData={state.aiQuestionData}
      backHomeLabel={t('backHome')}
      bookmarkedQuestions={state.bookmarkedQuestions}
      bookmarkLoading={state.bookmarkLoading}
      bookmarkMessage={state.bookmarkMessage}
      bookmarkMessageTone={state.bookmarkMessageTone}
      bookmarkToRemove={state.bookmarkToRemove}
      chatStats={chatStats}
      chatTurnsByQuestion={state.chatTurnsByQuestion}
      closeAIModal={closeAIModal}
      currentQuestionIndex={state.currentQuestionIndex}
      encodedSlug={encodedSlug}
      formatAnswer={(answer, options, type, isAnswered) =>
        formatAnswerValue(answer, options, type, t('notAnswered'), isAnswered)
      }
      formatCorrectAnswer={formatCorrectAnswerText}
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

export default function QuizResultPage() {
  return (
    <Suspense fallback={<QuizResultPageSkeleton label="Loading results..." />}>
      <QuizResultPageClient />
    </Suspense>
  );
}
