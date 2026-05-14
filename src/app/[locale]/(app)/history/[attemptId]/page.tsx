'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ImageDisplay } from '@/components/ui/ImageDisplay';
import { DynamicMarkdownRenderer as MarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import Sidebar from '@/components/Sidebar';
import {
  HiOutlineArrowLeft,
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineRefresh,
  HiOutlineX,
  HiOutlineXCircle,
} from '@/components/icons';
import { fetchApiData } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';

type AttemptQuestion = {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
  userAnswer: number | number[];
  isCorrect: boolean;
};

interface AttemptDetail {
  _id: string;
  score: number;
  takenAt: string;
  answers: (number | number[])[];
  quiz: {
    title: string;
    slug: string;
    description?: string;
    questions: AttemptQuestion[];
  };
}

export default function AttemptDetailPage() {
  const t = useTranslations('attemptDetail');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const attemptId = useRequiredRouteParam('attemptId');
  const encodedAttemptId = routePathSegment(attemptId);

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const historyLink = '/history';

  const fetchAttemptDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApiData<AttemptDetail>(`/api/attempts/${encodedAttemptId}`);
      setAttempt(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [encodedAttemptId, t]);

  useEffect(() => {
    if (attemptId) {
      fetchAttemptDetail();
    }
  }, [attemptId, fetchAttemptDetail]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOptionText = (question: AttemptQuestion, index: number) => question.options[index] ?? '';

  const getAnswerText = (question: AttemptQuestion, answer: number | number[]) => {
    if (question.type === 'single') {
      return typeof answer === 'number' && answer >= 0
        ? getOptionText(question, answer) || t('notAnswered')
        : t('notAnswered');
    }

    if (Array.isArray(answer) && answer.length > 0) {
      return answer
        .map((idx) => getOptionText(question, idx))
        .filter(Boolean)
        .join(', ');
    }
    return t('notAnswered');
  };

  const getCorrectAnswerText = (question: AttemptQuestion) => {
    if (question.type === 'single' && question.correctIndex !== undefined) {
      return getOptionText(question, question.correctIndex);
    }
    if (question.type === 'multiple' && question.correctIndexes) {
      return question.correctIndexes
        .map((idx) => getOptionText(question, idx))
        .filter(Boolean)
        .join(', ');
    }
    return '';
  };

  const correctCount = attempt?.quiz.questions.filter((q) => q.isCorrect).length ?? 0;
  const wrongCount = attempt ? attempt.quiz.questions.length - correctCount : 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath="/history"
      />

      <main
        className={cn(
          'px-3 pb-24 pt-20 transition-all duration-300 sm:px-6 lg:px-8',
          isSidebarOpen ? 'md:ml-64' : 'md:ml-16',
        )}
      >
        <div className="mx-auto max-w-4xl space-y-5 sm:space-y-8">
          <header className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <nav className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-xs font-medium text-neutral-500 sm:text-sm">
                  <Link
                    href={historyLink}
                    className="rounded-full bg-neutral-100 px-3 py-1 hover:text-neutral-700"
                  >
                    {t('history')}
                  </Link>
                  <span>/</span>
                  <span className="text-neutral-900">{t('title')}</span>
                </nav>
                <h1 className="text-balance text-2xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-3xl">
                  {t('title')}
                </h1>
                {attempt && (
                  <div className="mt-3 space-y-3">
                    <h2 className="break-words text-lg font-semibold leading-snug text-neutral-800 sm:text-xl">
                      {attempt.quiz.title}
                    </h2>
                    <div className="grid gap-2 text-sm text-neutral-600 sm:grid-cols-3">
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-2xl bg-green-50 px-3 py-2 text-green-800">
                        <HiOutlineChartBar className="size-4 shrink-0" />
                        <span className="truncate">
                          {t('score')}: {attempt.score}%
                        </span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-blue-800">
                        <HiOutlineDocumentText className="size-4 shrink-0" />
                        <span className="truncate">
                          {attempt.quiz.questions.length} {t('questions')}
                        </span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-2xl bg-neutral-100 px-3 py-2 text-neutral-700">
                        <HiOutlineClock className="size-4 shrink-0" />
                        <span className="truncate">{formatDate(attempt.takenAt)}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-row sm:gap-3">
                <Link href={historyLink} className="min-w-0">
                  <Button variant="outline" className="w-full justify-center px-3 sm:w-auto">
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineArrowLeft className="size-4" />
                      {tCommon('back')}
                    </span>
                  </Button>
                </Link>
                {attempt && (
                  <Link href={`/quiz/${attempt.quiz.slug}`} className="min-w-0">
                    <Button className="w-full justify-center px-3 sm:w-auto">
                      <span className="inline-flex items-center gap-2">
                        <HiOutlineRefresh className="size-4" />
                        {t('retryQuiz')}
                      </span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </header>

          {loading ? (
            <Card>
              <CardContent className="flex justify-center py-12 text-neutral-500">
                {tCommon('loading')}
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="px-5 py-12 text-center">
                <div className="mb-4 flex justify-center text-red-600">
                  <HiOutlineXCircle className="size-8" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-neutral-900">{tCommon('error')}</h3>
                <p className="mb-4 break-words text-neutral-600">{error}</p>
                <Link href={historyLink}>
                  <Button>{t('backToHistory')}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : attempt ? (
            <div className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  {
                    value: correctCount,
                    label: t('correctAnswers'),
                    className: 'text-green-600 bg-green-50',
                  },
                  {
                    value: wrongCount,
                    label: t('incorrectAnswers'),
                    className: 'text-red-600 bg-red-50',
                  },
                  {
                    value: `${attempt.score}%`,
                    label: t('totalScore'),
                    className: 'text-brand-trust bg-emerald-50',
                  },
                ].map((stat) => (
                  <Card key={stat.label} className="overflow-hidden">
                    <CardContent className="p-3 text-center sm:p-6">
                      <div
                        className={cn(
                          'mx-auto mb-2 rounded-2xl px-2 py-3 text-2xl font-bold sm:text-3xl',
                          stat.className,
                        )}
                      >
                        {stat.value}
                      </div>
                      <div className="text-xs font-medium text-neutral-600 sm:text-sm">
                        {stat.label}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-4 sm:space-y-6">
                {attempt.quiz.questions.map((question, index) => (
                  <Card
                    key={`${attempt._id}-${index}`}
                    className={cn(
                      'overflow-hidden border-l-4',
                      question.isCorrect ? 'border-l-green-500' : 'border-l-red-500',
                    )}
                  >
                    <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
                      <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-lg sm:text-xl">
                          {t('question')} {index + 1}
                        </span>
                        <span
                          className={cn(
                            'inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-semibold',
                            question.isCorrect
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800',
                          )}
                        >
                          {question.isCorrect ? (
                            <span className="inline-flex items-center gap-1.5">
                              <HiOutlineCheck className="size-4" />
                              {t('correct')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <HiOutlineX className="size-4" />
                              {t('incorrect')}
                            </span>
                          )}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 px-4 pb-5 pt-4 sm:space-y-6 sm:px-6 sm:pb-6">
                      <section>
                        <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                          {t('questionPrompt')}:
                        </h4>
                        <div className="break-words rounded-2xl bg-neutral-50 p-3 text-sm leading-6 sm:p-4 sm:text-base">
                          <MarkdownRenderer content={question.question} />
                          {question.questionImage && (
                            <div className="mt-3 overflow-hidden rounded-xl">
                              <ImageDisplay
                                src={question.questionImage}
                                alt={t('questionImageAlt')}
                              />
                            </div>
                          )}
                        </div>
                      </section>

                      <section>
                        <h5 className="mb-2 text-sm font-semibold text-neutral-900">
                          {t('yourAnswer')}:
                        </h5>
                        <div
                          className={cn(
                            'break-words rounded-2xl border p-3 text-sm font-semibold leading-6 sm:p-4 sm:text-base',
                            question.isCorrect
                              ? 'border-green-200 bg-green-50 text-green-800'
                              : 'border-red-200 bg-red-50 text-red-800',
                          )}
                        >
                          {getAnswerText(question, question.userAnswer)}
                        </div>
                      </section>

                      {!question.isCorrect && (
                        <section>
                          <h5 className="mb-2 text-sm font-semibold text-neutral-900">
                            {t('correctAnswer')}:
                          </h5>
                          <div className="break-words rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-semibold leading-6 text-green-800 sm:p-4 sm:text-base">
                            {getCorrectAnswerText(question)}
                          </div>
                        </section>
                      )}

                      <section>
                        <h5 className="mb-2 text-sm font-semibold text-neutral-900">
                          {t('allOptions')}:
                        </h5>
                        <div className="space-y-3">
                          {question.options.map((option, optionIndex) => {
                            const isUserChoice =
                              question.type === 'single'
                                ? question.userAnswer === optionIndex
                                : Array.isArray(question.userAnswer) &&
                                  question.userAnswer.includes(optionIndex);

                            const isCorrectChoice =
                              question.type === 'single'
                                ? question.correctIndex === optionIndex
                                : question.correctIndexes?.includes(optionIndex);

                            return (
                              <div
                                key={`${optionIndex}-${option}`}
                                className={cn(
                                  'rounded-2xl border-2 p-3 sm:p-4',
                                  isCorrectChoice
                                    ? 'border-green-500 bg-green-50'
                                    : isUserChoice
                                      ? 'border-red-500 bg-red-50'
                                      : 'border-neutral-200 bg-neutral-50',
                                )}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0 flex-1 break-words text-sm leading-6 text-neutral-800 sm:text-base">
                                    <span className="font-semibold">
                                      {String.fromCharCode(65 + optionIndex)}.
                                    </span>{' '}
                                    {option}
                                  </div>
                                  <div className="flex flex-wrap gap-2 sm:ml-4 sm:justify-end">
                                    {isCorrectChoice && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                                        <HiOutlineCheck className="size-3" />
                                        {t('correctAnswer')}
                                      </span>
                                    )}
                                    {isUserChoice && !isCorrectChoice && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                                        <HiOutlineX className="size-3" />
                                        {t('youChose')}
                                      </span>
                                    )}
                                    {isUserChoice && isCorrectChoice && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                                        <HiOutlineCheck className="size-3" />
                                        {t('youChoseCorrectly')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {question.optionImages?.[optionIndex] && (
                                  <div className="mt-3 overflow-hidden rounded-xl">
                                    <ImageDisplay
                                      src={question.optionImages[optionIndex]}
                                      alt={t('optionImageAlt', {
                                        option: String.fromCharCode(65 + optionIndex),
                                      })}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-neutral-200 pt-6 sm:flex sm:justify-center sm:gap-4">
                <Link href={historyLink}>
                  <Button variant="outline" size="lg" className="w-full justify-center sm:w-auto">
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineArrowLeft className="size-4" />
                      {t('backToHistory')}
                    </span>
                  </Button>
                </Link>
                <Link href={`/quiz/${attempt.quiz.slug}`}>
                  <Button size="lg" className="w-full justify-center sm:w-auto">
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineRefresh className="size-4" />
                      {t('retryQuiz')}
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
