'use client';

import Image from 'next/image';
import { useEffect, useMemo, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Flashcard } from '@/features/quiz/components/Flashcard';
import { PremiumRequiredModal } from '@/features/quiz/components/PremiumRequiredModal';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';

interface Question {
  _id: string;
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex: number;
  correctIndexes?: number[];
}

interface Quiz {
  _id: string;
  title: string;
  description?: string;
  questions: Question[];
  slug: string;
}

interface FlashcardProgress {
  knownIds: string[];
  unknownIds: string[];
  currentIndex: number;
}

type FlashcardStatus = 'loading' | 'ready' | 'error';

interface FlashcardPageState {
  quiz: Quiz | null;
  status: FlashcardStatus;
  error: string;
  progress: FlashcardProgress;
  currentQuestions: Question[];
  showPremiumModal: boolean;
}

type FlashcardPageAction =
  | { type: 'loadQuizSuccess'; quiz: Quiz }
  | { type: 'loadQuizError'; error: string }
  | { type: 'requirePremium' }
  | { type: 'registerSwipe'; direction: 'left' | 'right' }
  | { type: 'resetProgress' }
  | { type: 'continuePractice' }
  | { type: 'dismissPremium' };

const initialProgress: FlashcardProgress = {
  knownIds: [],
  unknownIds: [],
  currentIndex: 0,
};

const initialFlashcardPageState: FlashcardPageState = {
  quiz: null,
  status: 'loading',
  error: '',
  progress: initialProgress,
  currentQuestions: [],
  showPremiumModal: false,
};

function flashcardPageReducer(
  state: FlashcardPageState,
  action: FlashcardPageAction,
): FlashcardPageState {
  switch (action.type) {
    case 'loadQuizSuccess':
      return {
        ...state,
        quiz: action.quiz,
        status: 'ready',
        error: '',
        progress: initialProgress,
        currentQuestions: action.quiz.questions,
        showPremiumModal: false,
      };
    case 'loadQuizError':
      return {
        ...state,
        status: 'error',
        error: action.error,
        showPremiumModal: false,
      };
    case 'requirePremium':
      return {
        ...state,
        status: 'error',
        error: '',
        showPremiumModal: true,
      };
    case 'registerSwipe': {
      const currentQuestion = state.currentQuestions[state.progress.currentIndex];

      if (!currentQuestion) {
        return state;
      }

      return {
        ...state,
        progress: {
          ...state.progress,
          knownIds:
            action.direction === 'right'
              ? [...state.progress.knownIds, currentQuestion._id]
              : state.progress.knownIds,
          unknownIds:
            action.direction === 'left'
              ? [...state.progress.unknownIds, currentQuestion._id]
              : state.progress.unknownIds,
          currentIndex: state.progress.currentIndex + 1,
        },
      };
    }
    case 'resetProgress':
      return state.quiz
        ? {
            ...state,
            progress: initialProgress,
            currentQuestions: state.quiz.questions,
          }
        : state;
    case 'continuePractice':
      return {
        ...state,
        currentQuestions: state.currentQuestions.filter((question) =>
          state.progress.unknownIds.includes(question._id),
        ),
        progress: initialProgress,
      };
    case 'dismissPremium':
      return {
        ...state,
        showPremiumModal: false,
      };
    default:
      return state;
  }
}

function FlashcardLoadingState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
        <p className="mt-4 text-neutral-600">{message}</p>
      </div>
    </div>
  );
}

function FlashcardFallbackState({
  browseLabel,
  description,
  title,
}: {
  browseLabel: string;
  description: string;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="p-6 text-center">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">{title}</h2>
          <p className="text-neutral-600 mb-4">{description}</p>
          <Link href="/explore">
            <Button>{browseLabel}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function FlashcardPremiumState({ onClose }: { onClose: () => void }) {
  return <PremiumRequiredModal isOpen onClose={onClose} />;
}

function FlashcardResultsView({
  knownCount,
  masteryPercentage,
  onContinuePractice,
  onReset,
  quiz,
  t,
  tCommon,
  unknownCount,
  unknownQuestions,
}: {
  knownCount: number;
  masteryPercentage: number;
  onContinuePractice: () => void;
  onReset: () => void;
  quiz: Quiz;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  unknownCount: number;
  unknownQuestions: Question[];
}) {
  return (
    <div className="min-h-screen bg-neutral-50 overflow-hidden">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/explore" className="flex items-center">
                <div className="h-10 flex items-center justify-center">
                  <Image
                    src="/images/auth_logo.png"
                    alt="RinKuzu Logo"
                    width={96}
                    height={40}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-x-4">
              <Link href={`/quiz/${quiz.slug}`}>
                <Button variant="outline">{t('takeQuiz')}</Button>
              </Link>
              <Link href="/explore">
                <Button variant="outline">{tCommon('browseQuizzes')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-neutral-900 mb-2">{t('flashcards')}</h1>
          <p className="text-neutral-600">{quiz.title}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{knownCount}</div>
              <div className="text-sm text-neutral-600">{tCommon('questions')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">{unknownCount}</div>
              <div className="text-sm text-neutral-600">{tCommon('questions')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-brand-trust mb-2">{masteryPercentage}%</div>
              <div className="text-sm text-neutral-600">{t('mastery')}</div>
            </CardContent>
          </Card>
        </div>

        {unknownQuestions.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t('unknownQuestions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {unknownQuestions.map((question, index) => (
                  <div
                    key={question._id}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="font-medium text-neutral-900">
                      {t('question')} {index + 1}
                    </div>
                    <div className="text-sm text-neutral-600 mt-1">
                      {question.question.substring(0, 100)}...
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {unknownCount > 0 ? (
            <Button
              onClick={onContinuePractice}
              className="bg-brand-trust hover:bg-brand-trust-hover"
            >
              {t('practiceContinue')}
            </Button>
          ) : (
            <Button onClick={onReset} className="bg-brand-trust hover:bg-brand-trust-hover">
              {t('start')}
            </Button>
          )}
          <Link href={`/quiz/${quiz.slug}`}>
            <Button variant="outline">{t('takeQuiz')}</Button>
          </Link>
          <Link href="/explore">
            <Button variant="outline">{tCommon('browseQuizzes')}</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function FlashcardDeckView({
  currentIndex,
  currentQuestion,
  knownCount,
  onSwipe,
  progressPercentage,
  quiz,
  t,
  tCommon,
  totalQuestions,
  unknownCount,
}: {
  currentIndex: number;
  currentQuestion: Question | null;
  knownCount: number;
  onSwipe: (direction: 'left' | 'right') => void;
  progressPercentage: number;
  quiz: Quiz;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  totalQuestions: number;
  unknownCount: number;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center relative">
      <div className="fixed top-20 left-0 right-0 z-50 flex items-center justify-between px-2 sm:px-4">
        <div className="bg-red-100 text-red-700 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium whitespace-nowrap">
          {t('unknown')}: {unknownCount}
        </div>

        <div className="flex-1 mx-2 sm:mx-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm font-medium text-neutral-700">
              {Math.min(currentIndex + 1, totalQuestions)}/{totalQuestions}
            </span>
            <span className="text-xs sm:text-sm font-medium text-neutral-700">
              {progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2">
            <div
              className="bg-brand-trust h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-green-100 text-green-700 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium whitespace-nowrap">
          {t('known')}: {knownCount}
        </div>
      </div>

      <nav className="bg-white shadow-sm border-b w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/explore" className="flex items-center">
                <div className="h-10 flex items-center justify-center">
                  <Image
                    src="/images/auth_logo.png"
                    alt="RinKuzu Logo"
                    width={96}
                    height={40}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-x-2 sm:gap-x-4">
              <Link href={`/quiz/${quiz.slug}`}>
                <Button variant="outline" size="sm">
                  {t('takeQuiz')}
                </Button>
              </Link>
              <Link href="/explore" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  {tCommon('browseQuizzes')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full flex-1 flex flex-col items-center justify-center pt-20">
        <div className="flex flex-col items-center justify-center min-h-[420px] w-full">
          {currentQuestion && (
            <Flashcard
              key={`${currentIndex}-${currentQuestion._id}`}
              question={currentQuestion.question}
              options={currentQuestion.options}
              correctIndex={currentQuestion.correctIndex}
              correctIndexes={currentQuestion.correctIndexes}
              type={currentQuestion.type}
              onSwipe={onSwipe}
              isLast={currentIndex === totalQuestions - 1}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function FlashcardPage() {
  const t = useTranslations('quiz');
  const tCommon = useTranslations('common');
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const [state, dispatch] = useReducer(flashcardPageReducer, initialFlashcardPageState);

  useEffect(() => {
    let isActive = true;

    const loadQuiz = async () => {
      try {
        const data = await fetchApiData<Quiz>(`/api/quiz/${encodedSlug}/flashcards`);

        if (isActive) {
          dispatch({ type: 'loadQuizSuccess', quiz: data });
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to load quiz';

        if (message === 'Premium subscription required to access private quizzes') {
          dispatch({ type: 'requirePremium' });
        } else {
          dispatch({ type: 'loadQuizError', error: message });
        }
      }
    };

    void loadQuiz();

    return () => {
      isActive = false;
    };
  }, [encodedSlug]);

  const quiz = state.quiz;
  const currentQuestion = state.currentQuestions[state.progress.currentIndex] || null;
  const knownCount = state.progress.knownIds.length;
  const unknownCount = state.progress.unknownIds.length;
  const showResults =
    state.currentQuestions.length > 0 &&
    state.progress.currentIndex >= state.currentQuestions.length;
  const progressPercentage =
    state.currentQuestions.length === 0
      ? 0
      : Math.round((state.progress.currentIndex / state.currentQuestions.length) * 100);
  const unknownQuestions = useMemo(
    () =>
      state.currentQuestions.filter((question) => state.progress.unknownIds.includes(question._id)),
    [state.currentQuestions, state.progress.unknownIds],
  );
  const masteryPercentage =
    quiz && quiz.questions.length > 0 ? Math.round((knownCount / quiz.questions.length) * 100) : 0;

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!quiz || !currentQuestion) {
      return;
    }

    dispatch({ type: 'registerSwipe', direction });

    void fetchApiData('/api/review/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: currentQuestion._id,
        quizSlug: quiz.slug,
        rating: direction === 'right' ? 'good' : 'hard',
        questionRef: {
          text: currentQuestion.question,
          options: currentQuestion.options,
          correctIndexes: currentQuestion.correctIndexes || [currentQuestion.correctIndex],
        },
      }),
    }).catch((error) => {
      console.error('Failed to submit SRS review from flashcard:', error);
    });
  };

  if (state.status === 'loading') {
    return <FlashcardLoadingState message={t('loadingQuiz')} />;
  }

  if (state.showPremiumModal) {
    return <FlashcardPremiumState onClose={() => dispatch({ type: 'dismissPremium' })} />;
  }

  if (state.error) {
    return (
      <FlashcardFallbackState
        browseLabel={tCommon('browseQuizzes')}
        description={state.error}
        title={tCommon('error')}
      />
    );
  }

  if (!quiz) {
    return (
      <FlashcardFallbackState
        browseLabel={tCommon('browseQuizzes')}
        description={t('quizNotFound')}
        title={t('quizNotFound')}
      />
    );
  }

  if (showResults) {
    return (
      <FlashcardResultsView
        knownCount={knownCount}
        masteryPercentage={masteryPercentage}
        onContinuePractice={() => dispatch({ type: 'continuePractice' })}
        onReset={() => dispatch({ type: 'resetProgress' })}
        quiz={quiz}
        t={t}
        tCommon={tCommon}
        unknownCount={unknownCount}
        unknownQuestions={unknownQuestions}
      />
    );
  }

  return (
    <FlashcardDeckView
      currentIndex={state.progress.currentIndex}
      currentQuestion={currentQuestion}
      knownCount={knownCount}
      onSwipe={handleSwipe}
      progressPercentage={progressPercentage}
      quiz={quiz}
      t={t}
      tCommon={tCommon}
      totalQuestions={state.currentQuestions.length}
      unknownCount={unknownCount}
    />
  );
}
