'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Navigation from '@/components/Navigation';
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

export default function ReviewPage() {
  const t = useTranslations('review');
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({ xpGained: 0, reviewedCount: 0 });

  const fetchDueReviews = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApiData<{ questions: Question[]; count: number }>('/api/review/due');
      setQuestions(data.questions);
    } catch (error) {
      console.error('Failed to fetch reviews', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDueReviews();
  }, [fetchDueReviews]);

  const handleReviewSubmit = async (rating: 'fail' | 'hard' | 'good' | 'easy') => {
    const currentQ = questions[currentIndex];

    try {
      const data = await fetchApiData<{
        questionProgress: unknown;
        userProgress?: { xpGained?: number };
      }>('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.questionId,
          quizSlug: currentQ.quizSlug,
          rating,
          questionRef: currentQ.questionRef,
        }),
      });

      setStats((prev) => ({
        xpGained: prev.xpGained + (data.userProgress?.xpGained || 0),
        reviewedCount: prev.reviewedCount + 1,
      }));

      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setCompleted(true);
      }
    } catch (error) {
      console.error('Error submitting review', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-neutral-200 rounded-xl mb-4"></div>
          <div className="h-4 bg-neutral-200 w-32 rounded"></div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center animate-fadeInUp">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineEmojiHappy className="text-4xl text-green-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-4">
              {t('allDone')}
            </h1>
            <p className="text-lg md:text-xl text-[var(--text-muted)] mb-8">
              {t('reviewedQuestions', { count: stats.reviewedCount, xp: stats.xpGained })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button
                onClick={() => router.push(ROUTES.DASHBOARD)}
                variant="default"
                size="lg"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <HiOutlineHome className="w-5 h-5" /> {t('backToDashboard')}
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <HiOutlineRefresh className="w-5 h-5" /> {t('reviewMore')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <Card className="p-12">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiOutlineCheckCircle className="w-8 h-8 text-brand-trust" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">{t('noCards')}</h2>
            <p className="text-[var(--text-muted)] mb-6">{t('comeBack')}</p>
            <Button onClick={() => router.push(ROUTES.DASHBOARD)}>{t('backToDashboard')}</Button>
          </Card>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Navigation />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl mb-4 flex justify-between items-center text-sm font-medium text-[var(--text-muted)]">
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
