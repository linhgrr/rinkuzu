'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FlashcardPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { QuestionExcerpt } from '@/components/ui/QuestionContent';
import { preloadMathRenderer } from '@/components/ui/preloadMathRenderer';
import { Flashcard } from '@/features/quiz/components/Flashcard';
import { PremiumRequiredModal } from '@/features/quiz/components/PremiumRequiredModal';
import { PremiumFlashcardClient } from '@/features/quiz/components/PremiumFlashcardClient';
import {
  fetchPremiumCatalogMetadata,
  type PremiumCatalogMetadataViewModel,
} from '@/features/quiz/api/premium-quiz-api';
import { ApiResponseError } from '@/lib/api/client';
import {
  fetchFlashcardQuizViewModel,
  submitFlashcardReview,
} from '@/features/quiz/api/flashcards-api';
import type {
  FlashcardQuestionViewModel,
  FlashcardQuizViewModel,
} from '@/features/quiz/types/flashcard-view-model';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';

interface FlashcardProgress {
  knownIds: string[];
  unknownIds: string[];
  currentIndex: number;
}

type FlashcardStatus = 'loading' | 'ready' | 'error';

interface FlashcardPageState {
  quiz: FlashcardQuizViewModel | null;
  status: FlashcardStatus;
  error: string;
  progress: FlashcardProgress;
  currentQuestions: FlashcardQuestionViewModel[];
  showPremiumModal: boolean;
}

type FlashcardPageAction =
  | { type: 'loadQuizSuccess'; quiz: FlashcardQuizViewModel }
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
              ? [...state.progress.knownIds, currentQuestion.id]
              : state.progress.knownIds,
          unknownIds:
            action.direction === 'left'
              ? [...state.progress.unknownIds, currentQuestion.id]
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
    case 'continuePractice': {
      const unknownIds = new Set(state.progress.unknownIds);
      return {
        ...state,
        currentQuestions: state.currentQuestions.filter((question) => unknownIds.has(question.id)),
        progress: initialProgress,
      };
    }
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
  return <FlashcardPageSkeleton label={message} />;
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
    <div className="flex items-center justify-center px-4 py-16">
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
  quiz: FlashcardQuizViewModel;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  unknownCount: number;
  unknownQuestions: FlashcardQuestionViewModel[];
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-semibold text-neutral-900">{t('flashcards')}</h1>
        <p className="break-words text-neutral-600">{quiz.title}</p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-6">
        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-2 text-2xl font-bold text-green-600 sm:text-3xl">{knownCount}</div>
            <div className="text-sm text-neutral-600">{t('known')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-2 text-2xl font-bold text-red-600 sm:text-3xl">{unknownCount}</div>
            <div className="text-sm text-neutral-600">{t('unknown')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <div className="mb-2 text-2xl font-bold text-brand-trust sm:text-3xl">
              {masteryPercentage}%
            </div>
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
                <div key={question.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="font-medium text-neutral-900">
                    {t('question')} {index + 1}
                  </div>
                  <QuestionExcerpt
                    content={question.question}
                    maxLines={2}
                    className="mt-1 text-sm text-neutral-600"
                  />
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
  totalQuestions,
  unknownCount,
}: {
  currentIndex: number;
  currentQuestion: FlashcardQuestionViewModel | null;
  knownCount: number;
  onSwipe: (direction: 'left' | 'right') => void;
  progressPercentage: number;
  quiz: FlashcardQuizViewModel;
  t: (key: string) => string;
  totalQuestions: number;
  unknownCount: number;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      {/* Sticky inside the content column: it inherits the sidebar offset and stops
          under the app top bar (64px, 72px from lg) instead of covering either. */}
      <div
        data-testid="flashcard-progress-header"
        className="sticky top-16 z-30 w-full border-b border-line bg-surface/95 backdrop-blur lg:top-[var(--app-chrome-height)]"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-neutral-900 sm:text-base">
              {quiz.title}
            </p>
            <Link href={`/quiz/${quiz.slug}`} className="shrink-0">
              <Button variant="outline" size="sm">
                {t('takeQuiz')}
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="whitespace-nowrap rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 sm:px-4 sm:py-1.5 sm:text-sm">
              {t('unknown')}: {unknownCount}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-700 sm:text-sm">
                  {Math.min(currentIndex + 1, totalQuestions)}/{totalQuestions}
                </span>
                <span className="text-xs font-medium text-neutral-700 sm:text-sm">
                  {progressPercentage}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200">
                <div
                  className="h-2 rounded-full bg-brand-trust transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            <div className="whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 sm:px-4 sm:py-1.5 sm:text-sm">
              {t('known')}: {knownCount}
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center py-6 sm:py-10">
        {currentQuestion && (
          <Flashcard
            key={`${currentIndex}-${currentQuestion.id}`}
            question={currentQuestion.question}
            options={currentQuestion.options}
            {...(currentQuestion.correctIndex !== undefined
              ? { correctIndex: currentQuestion.correctIndex }
              : {})}
            {...(currentQuestion.correctIndexes !== undefined
              ? { correctIndexes: currentQuestion.correctIndexes }
              : {})}
            type={currentQuestion.type}
            onSwipe={onSwipe}
            isLast={currentIndex === totalQuestions - 1}
          />
        )}
      </div>
    </div>
  );
}

export function FlashcardsPageClient() {
  const t = useTranslations('quiz');
  const tCommon = useTranslations('common');
  const slug = useRequiredRouteParam('slug');
  const [state, dispatch] = useReducer(flashcardPageReducer, initialFlashcardPageState);
  const [premiumMetadata, setPremiumMetadata] = useState<PremiumCatalogMetadataViewModel | null>(
    null,
  );

  useEffect(() => {
    let isActive = true;

    const loadQuiz = async () => {
      try {
        try {
          const metadata = await fetchPremiumCatalogMetadata(slug);
          if (isActive) setPremiumMetadata(metadata);
          return;
        } catch (metadataError) {
          if (
            !(metadataError instanceof ApiResponseError) ||
            ![401, 404].includes(metadataError.status)
          ) {
            throw metadataError;
          }
        }
        const data = await fetchFlashcardQuizViewModel(slug);
        // Keep the skeleton until KaTeX is ready so math cards paint once, with no
        // raw LaTeX and no reflow (RIN-732). Plain quizzes resolve at once.
        await preloadMathRenderer(
          data.questions.flatMap((question) => [question.question, ...question.options]),
        );

        if (isActive) {
          dispatch({ type: 'loadQuizSuccess', quiz: data });
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to load quiz';
        const code = error instanceof ApiResponseError ? error.code : null;

        if (code === 'premium_required') {
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
  }, [slug]);

  if (premiumMetadata) {
    return <PremiumFlashcardClient metadata={premiumMetadata} />;
  }

  const quiz = state.quiz;
  const currentQuestion = state.currentQuestions[state.progress.currentIndex] || null;
  const knownCount = state.progress.knownIds.length;
  const unknownCount = state.progress.unknownIds.length;
  const unknownIds = new Set(state.progress.unknownIds);
  const showResults =
    state.currentQuestions.length > 0 &&
    state.progress.currentIndex >= state.currentQuestions.length;
  const progressPercentage =
    state.currentQuestions.length === 0
      ? 0
      : Math.round((state.progress.currentIndex / state.currentQuestions.length) * 100);
  const unknownQuestions = state.currentQuestions.filter((question) => unknownIds.has(question.id));
  const masteryPercentage =
    quiz && quiz.questions.length > 0 ? Math.round((knownCount / quiz.questions.length) * 100) : 0;

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!quiz || !currentQuestion) {
      return;
    }

    dispatch({ type: 'registerSwipe', direction });

    void submitFlashcardReview({
      quizSlug: quiz.slug,
      question: currentQuestion,
      rating: direction === 'right' ? 'good' : 'hard',
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
      totalQuestions={state.currentQuestions.length}
      unknownCount={unknownCount}
    />
  );
}
