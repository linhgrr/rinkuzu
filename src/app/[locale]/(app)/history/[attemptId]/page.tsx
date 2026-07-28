'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ImageDisplay } from '@/components/ui/ImageDisplay';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import {
  HiOutlineArrowLeft,
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineRefresh,
  HiOutlineX,
  HiOutlineXCircle,
} from 'react-icons/hi';
import { fetchAttemptDetailViewModel } from '@/features/profile/api/attempt-detail-api';
import type {
  AttemptDetailViewModel,
  AttemptQuestionDetailViewModel,
} from '@/features/profile/types/attempt-detail-view-model';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { getCorrectAnswerOptions } from '@/lib/quiz/answer-text';
import { cn } from '@/lib/utils';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';

interface AttemptDetailState {
  attempt: AttemptDetailViewModel | null;
  loading: boolean;
  error: string;
}

type AttemptDetailAction =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; attempt: AttemptDetailViewModel }
  | { type: 'fetch:error'; error: string };

const initialAttemptDetailState: AttemptDetailState = {
  attempt: null,
  loading: true,
  error: '',
};

function AnswerContent({ value }: { value: string | string[] }) {
  const answers = Array.isArray(value) ? value : [value];

  return (
    <div className="space-y-1">
      {toStableContentEntries(answers).map(({ content: answer, key }) => (
        <QuestionContent
          key={key}
          content={answer}
          variant="answer"
          className="font-inherit text-inherit"
        />
      ))}
    </div>
  );
}

function attemptDetailReducer(
  state: AttemptDetailState,
  action: AttemptDetailAction,
): AttemptDetailState {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true, error: '' };
    case 'fetch:success':
      return { attempt: action.attempt, loading: false, error: '' };
    case 'fetch:error':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

function AttemptQuestionCard({
  index,
  question,
  t,
}: {
  index: number;
  question: AttemptQuestionDetailViewModel;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const getOptionText = (optionIndex: number) => question.options[optionIndex] ?? '';
  const getAnswerText = (answer: number | number[]) => {
    if (question.type === 'single') {
      return typeof answer === 'number' && answer >= 0
        ? getOptionText(answer) || t('notAnswered')
        : t('notAnswered');
    }

    if (Array.isArray(answer) && answer.length > 0) {
      return answer.flatMap((optionIndex) => {
        const optionText = getOptionText(optionIndex);
        return optionText ? [optionText] : [];
      });
    }

    return t('notAnswered');
  };

  const answerText = getAnswerText(question.userAnswer);
  const correctAnswerText = getCorrectAnswerOptions(question);

  return (
    <Card
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
              question.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
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
          <h4 className="mb-2 text-sm font-semibold text-ink">{t('questionPrompt')}:</h4>
          <div className="break-words rounded-2xl bg-surface-warm p-3 text-sm leading-6 sm:p-4 sm:text-base">
            <QuestionContent content={question.question} />
            {question.questionImage && (
              <div className="mt-3 overflow-hidden rounded-xl">
                <ImageDisplay src={question.questionImage} alt={t('questionImageAlt')} />
              </div>
            )}
          </div>
        </section>

        <section>
          <h5 className="mb-2 text-sm font-semibold text-ink">{t('yourAnswer')}:</h5>
          <div
            className={cn(
              'break-words rounded-2xl border p-3 text-sm font-semibold leading-6 sm:p-4 sm:text-base',
              question.isCorrect
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800',
            )}
          >
            <AnswerContent value={answerText} />
          </div>
        </section>

        {!question.isCorrect && (
          <section>
            <h5 className="mb-2 text-sm font-semibold text-ink">{t('correctAnswer')}:</h5>
            <div className="break-words rounded-2xl border border-green-200 bg-green-50 p-3 text-sm font-semibold leading-6 text-green-800 sm:p-4 sm:text-base">
              <AnswerContent value={correctAnswerText} />
            </div>
          </section>
        )}

        <section>
          <h5 className="mb-2 text-sm font-semibold text-ink">{t('allOptions')}:</h5>
          <div className="space-y-3">
            {(() => {
              const userAnswerSet =
                question.type !== 'single' && Array.isArray(question.userAnswer)
                  ? new Set(question.userAnswer)
                  : null;
              const correctIndexSet =
                question.type !== 'single' && question.correctIndexes
                  ? new Set(question.correctIndexes)
                  : null;

              return question.options.map((option, optionIndex) => {
                const isUserChoice =
                  question.type === 'single'
                    ? question.userAnswer === optionIndex
                    : Boolean(userAnswerSet?.has(optionIndex));

                const isCorrectChoice =
                  question.type === 'single'
                    ? question.correctIndex === optionIndex
                    : Boolean(correctIndexSet?.has(optionIndex));

                return (
                  <div
                    key={`${optionIndex}-${option}`}
                    className={cn(
                      'rounded-2xl border-2 p-3 sm:p-4',
                      isCorrectChoice
                        ? 'border-green-500 bg-green-50'
                        : isUserChoice
                          ? 'border-red-500 bg-red-50'
                          : 'border-line bg-surface-warm',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 break-words text-sm leading-6 text-ink sm:text-base">
                        <span className="font-semibold">
                          {String.fromCharCode(65 + optionIndex)}.
                        </span>{' '}
                        <QuestionContent
                          content={option}
                          variant="option"
                          className="mt-1 font-normal"
                        />
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
              });
            })()}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function AttemptSummary({
  attempt,
  historyLink,
  t,
}: {
  attempt: AttemptDetailViewModel;
  historyLink: string;
  t: (key: string) => string;
}) {
  const correctCount = attempt.quiz.questions.filter((question) => question.isCorrect).length;
  const wrongCount = attempt.quiz.questions.length - correctCount;
  const historyUnavailable = attempt.historyStatus === 'quiz_modified';

  return (
    <div className="space-y-5 sm:space-y-6">
      {historyUnavailable && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          <p className="font-semibold">{t('historyUnavailableTitle')}</p>
          <p>{t('historyUnavailableDescription')}</p>
        </div>
      )}

      <div
        className={cn('grid gap-2 sm:gap-4', historyUnavailable ? 'grid-cols-2' : 'grid-cols-3')}
      >
        {(historyUnavailable
          ? [
              {
                value: attempt.totalQuestions,
                label: t('questions'),
                className: 'text-blue-700 bg-blue-50',
              },
              {
                value: `${attempt.score}%`,
                label: t('totalScore'),
                className: 'text-accent bg-emerald-50',
              },
            ]
          : [
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
                className: 'text-accent bg-emerald-50',
              },
            ]
        ).map((stat) => (
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
              <div className="text-xs font-medium text-ink-muted sm:text-sm">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!historyUnavailable && (
        <div className="space-y-4 sm:space-y-6">
          {attempt.quiz.questions.map((question, index) => (
            <AttemptQuestionCard key={question.id} index={index} question={question} t={t} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 border-t border-line pt-6 sm:flex sm:justify-center sm:gap-4">
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
  );
}

export default function AttemptDetailPage() {
  const t = useTranslations('attemptDetail');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const attemptId = useRequiredRouteParam('attemptId');

  const [state, dispatch] = useReducer(attemptDetailReducer, initialAttemptDetailState);
  const historyLink = '/history';

  useEffect(() => {
    let isActive = true;

    const fetchAttemptDetail = async () => {
      dispatch({ type: 'fetch:start' });

      try {
        const data = await fetchAttemptDetailViewModel(attemptId, locale);
        if (isActive) {
          dispatch({ type: 'fetch:success', attempt: data });
        }
      } catch (error: unknown) {
        if (isActive) {
          dispatch({
            type: 'fetch:error',
            error: extractUnknownErrorMessage(error, t('loadError')),
          });
        }
      }
    };

    fetchAttemptDetail();

    return () => {
      isActive = false;
    };
  }, [attemptId, locale, t]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
      <main className="px-3 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-5 sm:space-y-8">
          <header className="rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <nav className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-xs font-medium text-ink-muted sm:text-sm">
                  <Link
                    href={historyLink}
                    className="rounded-full bg-surface-warm px-3 py-1 hover:text-ink"
                  >
                    {t('history')}
                  </Link>
                  <span>/</span>
                  <span className="text-ink">{t('title')}</span>
                </nav>
                <h1 className="text-balance text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">
                  {t('title')}
                </h1>
                {state.attempt && (
                  <div className="mt-3 space-y-3">
                    <h2 className="break-words text-lg font-semibold leading-snug text-ink sm:text-xl">
                      {state.attempt.quiz.title}
                    </h2>
                    <div className="grid gap-2 text-sm text-ink-muted sm:grid-cols-3">
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-2xl bg-green-50 px-3 py-2 text-green-800">
                        <HiOutlineChartBar className="size-4 shrink-0" />
                        <span className="truncate">
                          {t('score')}: {state.attempt.score}%
                        </span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-blue-800">
                        <HiOutlineDocumentText className="size-4 shrink-0" />
                        <span className="truncate">
                          {state.attempt.totalQuestions} {t('questions')}
                        </span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-2xl bg-surface-warm px-3 py-2 text-ink">
                        <HiOutlineClock className="size-4 shrink-0" />
                        <span className="truncate">{state.attempt.takenAtLabel}</span>
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
                {state.attempt && (
                  <Link href={`/quiz/${state.attempt.quiz.slug}`} className="min-w-0">
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

          {state.loading ? (
            <Card>
              <CardContent className="flex justify-center py-12 text-ink-muted">
                {tCommon('loading')}
              </CardContent>
            </Card>
          ) : state.error ? (
            <Card>
              <CardContent className="px-5 py-12 text-center">
                <div className="mb-4 flex justify-center text-red-600">
                  <HiOutlineXCircle className="size-8" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-ink">{tCommon('error')}</h3>
                <p className="mb-4 break-words text-ink-muted">{state.error}</p>
                <Link href={historyLink}>
                  <Button>{t('backToHistory')}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : state.attempt ? (
            <AttemptSummary attempt={state.attempt} historyLink={historyLink} t={t} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
