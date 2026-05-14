'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  known: number[];
  unknown: number[];
  currentIndex: number;
}

export default function FlashcardPage() {
  const t = useTranslations('quiz');
  const tCommon = useTranslations('common');
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));
  const _router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<FlashcardProgress>({
    known: [],
    unknown: [],
    currentIndex: 0,
  });
  const [showResults, setShowResults] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);

  // Premium required modal
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const data = await fetchApiData<Quiz>(`/api/quiz/${encodedSlug}/flashcards`);
        setQuiz(data);
        setCurrentQuestions(data.questions);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load quiz';
        if (message === 'Premium subscription required to access private quizzes') {
          setShowPremiumModal(true);
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchQuiz();
  }, [encodedSlug]);

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!quiz) return;

    const currentQuestionIndex = progress.currentIndex;
    const currentQuestion = quiz.questions[currentQuestionIndex];

    // Optimistic UI update
    if (direction === 'right') {
      // Known - add to known list
      setProgress((prev) => ({
        ...prev,
        known: [...prev.known, currentQuestionIndex],
        currentIndex: prev.currentIndex + 1,
      }));
    } else {
      // Unknown - add to unknown list
      setProgress((prev) => ({
        ...prev,
        unknown: [...prev.unknown, currentQuestionIndex],
        currentIndex: prev.currentIndex + 1,
      }));
    }

    // Submit SRS Review in background
    try {
      await fetchApiData('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion._id,
          quizSlug: quiz.slug,
          rating: direction === 'right' ? 'good' : 'hard',
          // Pass questionRef to ensure QuestionProgress is created if missing
          questionRef: {
            text: currentQuestion.question,
            options: currentQuestion.options,
            correctIndexes: currentQuestion.correctIndexes || [currentQuestion.correctIndex],
          },
        }),
      });
    } catch (error) {
      console.error('Failed to submit SRS review from flashcard:', error);
    }
  };

  const resetProgress = () => {
    // Reset về tất cả câu hỏi gốc
    if (quiz) {
      setCurrentQuestions(quiz.questions);
    }
    setProgress({
      known: [],
      unknown: [],
      currentIndex: 0,
    });
    setShowResults(false);
  };

  const continuePractice = () => {
    if (!quiz) return;

    // Tạo danh sách mới chỉ với các câu chưa biết
    const unknownQuestions = progress.unknown.flatMap((index) => {
      const question = quiz.questions[index];
      return question ? [question] : [];
    });

    // Cập nhật danh sách câu hỏi hiện tại để chỉ chứa câu chưa biết
    setCurrentQuestions(unknownQuestions);

    // Reset progress để học lại các câu chưa biết
    setProgress({
      known: [],
      unknown: [],
      currentIndex: 0,
    });
    setShowResults(false);
  };

  const getCurrentQuestion = () => {
    if (currentQuestions.length === 0 || progress.currentIndex >= currentQuestions.length)
      return null;
    return currentQuestions[progress.currentIndex];
  };

  const getProgressPercentage = () => {
    if (currentQuestions.length === 0) return 0;
    return Math.round((progress.currentIndex / currentQuestions.length) * 100);
  };

  const getKnownCount = () => progress.known.length;
  const getUnknownCount = () => progress.unknown.length;
  const _getRemainingCount = () => {
    if (!quiz) return 0;
    return quiz.questions.length - progress.currentIndex;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
          <p className="mt-4 text-neutral-600">{t('loadingQuiz')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">{tCommon('error')}</h2>
            <p className="text-neutral-600 mb-4">{error}</p>
            <Link href="/quizzes">
              <Button>{tCommon('browseQuizzes')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">{t('quizNotFound')}</h2>
            <p className="text-neutral-600 mb-4">{t('quizNotFound')}</p>
            <Link href="/quizzes">
              <Button>{tCommon('browseQuizzes')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show results when all questions are completed
  if (
    currentQuestions.length > 0 &&
    progress.currentIndex >= currentQuestions.length &&
    !showResults
  ) {
    setShowResults(true);
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-neutral-50 overflow-hidden">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/quizzes" className="flex items-center">
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
                <Link href="/quizzes">
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
                <div className="text-3xl font-bold text-green-600 mb-2">{getKnownCount()}</div>
                <div className="text-sm text-neutral-600">{tCommon('questions')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-red-600 mb-2">{getUnknownCount()}</div>
                <div className="text-sm text-neutral-600">{tCommon('questions')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-brand-trust mb-2">
                  {Math.round((getKnownCount() / quiz.questions.length) * 100)}%
                </div>
                <div className="text-sm text-neutral-600">{t('mastery')}</div>
              </CardContent>
            </Card>
          </div>

          {getUnknownCount() > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{t('unknownQuestions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {progress.unknown.map((questionIndex) => {
                    const question = quiz.questions[questionIndex];
                    return (
                      <div
                        key={questionIndex}
                        className="p-3 bg-red-50 border border-red-200 rounded-lg"
                      >
                        <div className="font-medium text-neutral-900">
                          {t('question')} {questionIndex + 1}
                        </div>
                        <div className="text-sm text-neutral-600 mt-1">
                          {question.question.substring(0, 100)}...
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            {getUnknownCount() > 0 ? (
              <Button
                onClick={continuePractice}
                className="bg-brand-trust hover:bg-brand-trust-hover"
              >
                {t('practiceContinue')}
              </Button>
            ) : (
              <Button onClick={resetProgress} className="bg-brand-trust hover:bg-brand-trust-hover">
                {t('start')}
              </Button>
            )}
            <Link href={`/quiz/${quiz.slug}`}>
              <Button variant="outline">{t('takeQuiz')}</Button>
            </Link>
            <Link href="/quizzes">
              <Button variant="outline">{tCommon('browseQuizzes')}</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center relative">
      {/* Fixed top bar with counters and progress */}
      <div className="fixed top-20 left-0 right-0 z-50 flex items-center justify-between px-2 sm:px-4">
        <div className="bg-red-100 text-red-700 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium whitespace-nowrap">
          {t('unknown')}: {getUnknownCount()}
        </div>

        {/* Progress Bar */}
        <div className="flex-1 mx-2 sm:mx-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm font-medium text-neutral-700">
              {progress.currentIndex + 1}/{currentQuestions.length}
            </span>
            <span className="text-xs sm:text-sm font-medium text-neutral-700">
              {getProgressPercentage()}%
            </span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-2">
            <div
              className="bg-brand-trust h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-green-100 text-green-700 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-lg text-xs sm:text-sm font-medium whitespace-nowrap">
          {t('known')}: {getKnownCount()}
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/quizzes" className="flex items-center">
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
              <Link href="/quizzes" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  {tCommon('browseQuizzes')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full flex-1 flex flex-col items-center justify-center pt-20">
        {/* Flashcard (centered) */}
        <div
          className="flex flex-col items-center justify-center min-h-[420px] w-full"
          style={{ minHeight: '420px' }}
        >
          {currentQuestion && (
            <Flashcard
              key={`${progress.currentIndex}-${currentQuestion.question.substring(0, 50)}`}
              question={currentQuestion.question}
              options={currentQuestion.options}
              correctIndex={currentQuestion.correctIndex}
              correctIndexes={currentQuestion.correctIndexes}
              type={currentQuestion.type}
              onSwipe={handleSwipe}
              isLast={progress.currentIndex === quiz.questions.length - 1}
            />
          )}
        </div>
      </main>

      {/* Premium Required Modal */}
      <PremiumRequiredModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
    </div>
  );
}
