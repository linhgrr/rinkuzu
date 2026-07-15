'use client';

import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Suspense, useEffect, useReducer } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuizResultPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import {
  useStreamingChatSession,
  type ChatMessage,
} from '@/features/quiz/hooks/useStreamingChatSession';
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
import { AIExplainPanel } from '@/features/quiz/components/result/AIExplainPanel';

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
  type: 'single' | 'multiple',
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
    <div className="min-h-screen bg-surface-page flex items-center justify-center">
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
  aiError: string;
  aiQuestionData: AIQuestionData | null;
  askAI: () => void;
  backHomeLabel: string;
  bookmarkedQuestions: Set<number>;
  bookmarkLoading: Set<number>;
  bookmarkMessage: string;
  bookmarkMessageTone: BookmarkMessageTone;
  bookmarkToRemove: number | null;
  chatHistories: Record<string, ChatMessage[]>;
  chatStats: { totalTurns: number; questionsWithChat: number };
  clearChatHistory: (questionIndex: number) => void;
  closeAIModal: () => void;
  currentQuestionIndex: number;
  encodedSlug: string;
  formatAnswer: (
    answer: number | number[],
    options: string[],
    type: 'single' | 'multiple',
    isAnswered?: boolean,
  ) => string;
  formatCorrectAnswer: (question: QuizResultQuestion) => string;
  getHistory: (historyKey: string | number) => ChatMessage[];
  loadingAI: boolean;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onDismissBookmarkMessage: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onOpenAI: (questionData: AIQuestionData, questionIndex: number) => void;
  onToggleBookmark: (questionIndex: number, questionData: QuizResultQuestion) => void;
  onUserQuestionChange: (value: string) => void;
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
  userLabel: string;
  userQuestion: string;
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

function isQuestionAnswered(question: QuizResultQuestion) {
  return question.type === 'single'
    ? question.userAnswer !== -1
    : Array.isArray(question.userAnswer) && question.userAnswer.length > 0;
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
    (question) => !question.isCorrect && isQuestionAnswered(question),
  ).length;
  const unansweredCount = result.quiz.questions.filter(
    (question) => !isQuestionAnswered(question),
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

function useQuizResultPageData(attemptId: string | null, locale: string) {
  const [state, dispatch] = useReducer(quizResultPageReducer, initialQuizResultPageState);

  useEffect(() => {
    let isActive = true;

    const loadResults = async () => {
      if (!attemptId) {
        dispatch({ type: 'loadError', error: 'No attempt ID provided' });
        return;
      }

      try {
        const pageData = await fetchQuizResultPageData(attemptId, locale);

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
  }, [attemptId, locale]);

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

function useQuizResultPageChat(
  attemptId: string | null,
  state: QuizResultPageState,
  dispatch: React.Dispatch<QuizResultPageAction>,
) {
  const {
    chatHistories,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    setAIError,
    ensureHistory,
    clearHistory,
    getHistory,
    cancelActiveStream,
    sendMessage,
    totalTurns,
  } = useStreamingChatSession(
    attemptId ? { persistence: { scope: 'attempt', id: attemptId } } : {},
  );

  const openAIModal = (questionData: AIQuestionData, questionIndex: number) => {
    setUserQuestion('');
    setAIError('');
    ensureHistory(questionIndex);
    dispatch({ type: 'openAIModal', questionData, questionIndex });
  };

  const closeAIModal = () => {
    cancelActiveStream();
    setUserQuestion('');
    setAIError('');
    dispatch({ type: 'closeAIModal' });
  };

  const askAI = async () => {
    if (!state.aiQuestionData || state.currentQuestionIndex === -1) {
      return;
    }

    await sendMessage({
      historyKey: state.currentQuestionIndex,
      payload: {
        question: state.aiQuestionData.question,
        options: state.aiQuestionData.options,
        ...(state.aiQuestionData.questionImage !== undefined
          ? { questionImage: state.aiQuestionData.questionImage }
          : {}),
        ...(state.aiQuestionData.optionImages !== undefined
          ? { optionImages: state.aiQuestionData.optionImages }
          : {}),
      },
      emptyQuestionErrorMessage: 'Please enter a question to ask Rin-chan!',
      requestErrorMessage: 'Failed to connect to AI service. Please try again.',
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();

      if (!loadingAI && userQuestion.trim()) {
        void askAI();
      }
    }
  };

  const questionsWithChat = Object.keys(chatHistories).filter(
    (key) => getHistory(key).length > 0,
  ).length;
  const chatStats: QuizResultChatSummary = {
    totalTurns,
    questionsWithChat,
  };

  return {
    chatHistories,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    getHistory,
    openAIModal,
    closeAIModal,
    askAI,
    handleKeyPress,
    clearChatHistory: clearHistory,
    chatStats,
  };
}

function QuizResultReadyState({
  aiError,
  aiQuestionData,
  askAI,
  backHomeLabel,
  bookmarkedQuestions,
  bookmarkLoading,
  bookmarkMessage,
  bookmarkMessageTone,
  bookmarkToRemove,
  chatHistories,
  chatStats,
  clearChatHistory,
  closeAIModal,
  currentQuestionIndex,
  encodedSlug,
  formatAnswer,
  formatCorrectAnswer,
  getHistory,
  loadingAI,
  onCancelRemove,
  onConfirmRemove,
  onDismissBookmarkMessage,
  onKeyDown,
  onOpenAI,
  onToggleBookmark,
  onUserQuestionChange,
  result,
  scoreColor,
  scoreMessage,
  showAIModal,
  stats,
  t,
  tProfile,
  userLabel,
  userQuestion,
}: QuizResultReadyStateProps) {
  const tCommon = useTranslations('common');

  return (
    <div className="min-h-screen bg-surface-page">
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
          chatHistories={chatHistories}
          getChatStats={() => chatStats}
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
          getHistory={getHistory}
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

      <AIExplainPanel
        isOpen={showAIModal}
        onClose={closeAIModal}
        questionContent={
          aiQuestionData
            ? {
                questionText: aiQuestionData.question,
                options: aiQuestionData.options ?? [],
                ...(aiQuestionData.questionImage !== undefined
                  ? { questionImage: aiQuestionData.questionImage }
                  : {}),
                ...(aiQuestionData.optionImages !== undefined
                  ? { optionImages: aiQuestionData.optionImages }
                  : {}),
              }
            : null
        }
        messages={getHistory(currentQuestionIndex)}
        userLabel={userLabel}
        assistantLabel={tProfile('rinChan')}
        userQuestion={userQuestion}
        onUserQuestionChange={onUserQuestionChange}
        onKeyDown={onKeyDown}
        onSend={askAI}
        sendDisabled={loadingAI || !userQuestion.trim()}
        sendLabel={t('askRinChan')}
        loadingLabel={tProfile('thinking')}
        loadingAI={loadingAI}
        aiError={aiError}
        inputPlaceholder={t('questionPlaceholder')}
        inputMode="textarea"
        inputHintLeft={t('leaveEmptyGeneral')}
        inputHintRight={`Press Ctrl+Enter ${tCommon('send')}`}
        clearLabel={tCommon('clear')}
        onClearHistory={() => clearChatHistory(currentQuestionIndex)}
        showTimestamps
        title={tProfile('chatWithRinChan')}
      />
    </div>
  );
}

function QuizResultPageClient() {
  const t = useTranslations('quiz');
  const tProfile = useTranslations('profile');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const attemptId = get('attemptId');
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const { state, dispatch, stats, toggleBookmark, removeBookmark } = useQuizResultPageData(
    attemptId,
    locale,
  );
  const {
    chatHistories,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    getHistory,
    openAIModal,
    closeAIModal,
    askAI,
    handleKeyPress,
    clearChatHistory,
    chatStats,
  } = useQuizResultPageChat(attemptId, state, dispatch);
  const result = state.result;

  if (state.status === 'loading') {
    return <QuizResultPageSkeleton label={`${t('loadingQuiz')}...`} />;
  }

  if (state.error || !result) {
    return (
      <QuizResultErrorState
        actionLabel={t('backHome')}
        error={state.error}
        title={t('error', { ns: 'common' })}
      />
    );
  }

  return (
    <QuizResultReadyState
      aiError={aiError}
      aiQuestionData={state.aiQuestionData}
      askAI={() => {
        void askAI();
      }}
      backHomeLabel={t('backHome')}
      bookmarkedQuestions={state.bookmarkedQuestions}
      bookmarkLoading={state.bookmarkLoading}
      bookmarkMessage={state.bookmarkMessage}
      bookmarkMessageTone={state.bookmarkMessageTone}
      bookmarkToRemove={state.bookmarkToRemove}
      chatHistories={chatHistories}
      chatStats={chatStats}
      clearChatHistory={clearChatHistory}
      closeAIModal={closeAIModal}
      currentQuestionIndex={state.currentQuestionIndex}
      encodedSlug={encodedSlug}
      formatAnswer={(answer, options, type, isAnswered) =>
        formatAnswerValue(answer, options, type, t('notAnswered'), isAnswered)
      }
      formatCorrectAnswer={formatCorrectAnswerText}
      getHistory={getHistory}
      loadingAI={loadingAI}
      onCancelRemove={() => dispatch({ type: 'setBookmarkToRemove', questionIndex: null })}
      onConfirmRemove={() =>
        state.bookmarkToRemove !== null && void removeBookmark(state.bookmarkToRemove)
      }
      onDismissBookmarkMessage={() => dispatch({ type: 'clearBookmarkMessage' })}
      onKeyDown={handleKeyPress}
      onOpenAI={openAIModal}
      onToggleBookmark={toggleBookmark}
      onUserQuestionChange={setUserQuestion}
      result={result}
      scoreColor={getQuizResultScoreColor}
      scoreMessage={(score) => getQuizResultScoreMessage(score, tProfile)}
      showAIModal={state.showAIModal}
      stats={stats}
      t={t}
      tProfile={tProfile}
      userLabel={tProfile('you')}
      userQuestion={userQuestion}
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
