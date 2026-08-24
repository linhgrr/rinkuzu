'use client';

import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { useEffect, useReducer, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FlashcardPageSkeleton } from '@/components/ui/PageLoadingSkeletons';
import { QuestionExcerpt } from '@/components/ui/QuestionContent';
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
  quiz: FlashcardQuizViewModel;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  unknownCount: number;
  unknownQuestions: FlashcardQuestionViewModel[];
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
                    src="/images/auth_logo.webp"
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
                  <div key={question.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
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
  currentQuestion: FlashcardQuestionViewModel | null;
  knownCount: number;
  onSwipe: (direction: 'left' | 'right') => void;
  progressPercentage: number;
  quiz: FlashcardQuizViewModel;
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
                    src="/images/auth_logo.webp"
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
      </main>
    </div>
  );
}

export default function FlashcardPage() {
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
      tCommon={tCommon}
      totalQuestions={state.currentQuestions.length}
      unknownCount={unknownCount}
    />
  );
}
