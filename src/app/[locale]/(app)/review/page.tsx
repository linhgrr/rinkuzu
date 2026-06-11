'use client';

import { useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/shared/constants';
import ReviewCard from '@/components/ReviewCard';
import { Card } from '@/components/ui/Card';
import { fetchApiData } from '@/lib/api/client';
import {
  HiOutlineEmojiHappy,
  HiOutlineCheckCircle,
  HiOutlineHome,
  HiOutlineRefresh,
} from '@/components/icons';

interface Question {
  _id: string; // QuestionProgress ID if needed, or we use questionId
  questionId: string;
  quizSlug: string;
  questionRef: {
    text: string;
    options: string[];
    correctIndexes: number[];
  };
  srsLevel: number;
}

type ReviewPhase = 'loading' | 'ready' | 'completed';

interface ReviewState {
  questions: Question[];
  currentIndex: number;
  phase: ReviewPhase;
  stats: {
    xpGained: number;
    reviewedCount: number;
  };
}

type ReviewAction =
  | { type: 'setPhase'; value: ReviewPhase }
  | { type: 'loadQuestions'; questions: Question[] }
  | { type: 'recordReview'; xpGained: number; hasNext: boolean };

const initialState: ReviewState = {
  questions: [],
  currentIndex: 0,
  phase: 'loading',
  stats: { xpGained: 0, reviewedCount: 0 },
};

function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'setPhase':
      return { ...state, phase: action.value };
    case 'loadQuestions':
      return {
        ...state,
        questions: action.questions,
        currentIndex: 0,
        phase: 'ready',
      };
    case 'recordReview':
      return {
        ...state,
        currentIndex: action.hasNext ? state.currentIndex + 1 : state.currentIndex,
        phase: action.hasNext ? state.phase : 'completed',
        stats: {
          xpGained: state.stats.xpGained + action.xpGained,
          reviewedCount: state.stats.reviewedCount + 1,
        },
      };
    default:
      return state;
  }
}

export default function ReviewPage() {
  const t = useTranslations('review');
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reviewReducer, initialState);
  const { questions, currentIndex, phase, stats } = state;

  useEffect(() => {
    const fetchDueReviews = async () => {
      dispatch({ type: 'setPhase', value: 'loading' });

      try {
        const data = await fetchApiData<{ questions: Question[]; count: number }>(
          '/api/review/due',
        );
        dispatch({ type: 'loadQuestions', questions: data.questions });
      } catch (error) {
        console.error('Failed to fetch reviews', error);
        dispatch({ type: 'loadQuestions', questions: [] });
      }
    };

    void fetchDueReviews();
  }, []);

  const handleReviewSubmit = async (rating: 'fail' | 'hard' | 'good' | 'easy') => {
    const currentQuestion = questions[currentIndex];

    try {
      const data = await fetchApiData<{
        questionProgress: unknown;
        userProgress?: { xpGained?: number };
      }>('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.questionId,
          quizSlug: currentQuestion.quizSlug,
          rating,
          questionRef: currentQuestion.questionRef,
        }),
      });
      dispatch({
        type: 'recordReview',
        xpGained: data.userProgress?.xpGained || 0,
        hasNext: currentIndex < questions.length - 1,
      });
    } catch (error) {
      console.error('Error submitting review', error);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="animate-pulse flex flex-col items-center">
          <div className="size-12 bg-surface-warm rounded-xl mb-4"></div>
          <div className="h-4 bg-surface-warm w-32 rounded"></div>
        </div>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="min-h-screen bg-surface-page">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center animate-fadeInUp">
            <div className="size-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineEmojiHappy className="text-4xl text-green-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-ink mb-4">{t('allDone')}</h1>
            <p className="text-lg md:text-xl text-ink-muted mb-8">
              {t('reviewedQuestions', { count: stats.reviewedCount, xp: stats.xpGained })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button
                onClick={() => push(ROUTES.DASHBOARD)}
                variant="default"
                size="lg"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <HiOutlineHome className="size-5" /> {t('backToDashboard')}
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <HiOutlineRefresh className="size-5" /> {t('reviewMore')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface-page">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <Card className="p-12">
            <div className="size-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiOutlineCheckCircle className="size-8 text-brand-trust" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">{t('noCards')}</h2>
            <p className="text-ink-muted mb-6">{t('comeBack')}</p>
            <Button onClick={() => push(ROUTES.DASHBOARD)}>{t('backToDashboard')}</Button>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl mb-4 flex justify-between items-center text-sm font-medium text-ink-muted">
          <span>
            {t('questionProgress', { current: currentIndex + 1, total: questions.length })}
          </span>
          <span>{t('xpEarned', { xp: stats.xpGained })}</span>
        </div>

        <ReviewCard
          key={currentQuestion._id}
          question={currentQuestion.questionRef}
          onResult={handleReviewSubmit}
        />
      </div>
    </div>
  );
}
