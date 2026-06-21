'use client';

import { useEffect, useReducer } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { UserAvatar } from '@/components/user/UserAvatar';
import { QuizUploadDropzone } from '@/features/dashboard/components/QuizUploadDropzone';
import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { IQuiz, PaginationMeta, type IUserPreview } from '@/types';
import {
  HiOutlineDotsVertical,
  HiOutlineDocumentText,
  HiOutlineLockClosed,
} from '@/components/icons';

type QuizFilter = 'all' | 'public' | 'private';

interface State {
  quizzes: IQuiz[];
  loading: boolean;
  error: string;
  filter: QuizFilter;
  quizToDelete: IQuiz | null;
  deletingQuizId: string | null;
}

type Action =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; quizzes: IQuiz[] }
  | { type: 'fetch:error'; error: string }
  | { type: 'filter:set'; filter: QuizFilter }
  | { type: 'delete:prompt'; quiz: IQuiz }
  | { type: 'delete:start'; quizId: string }
  | { type: 'delete:success'; quizId: string }
  | { type: 'delete:error'; error: string }
  | { type: 'delete:cancel' };

const initialState: State = {
  quizzes: [],
  loading: true,
  error: '',
  filter: 'all',
  quizToDelete: null,
  deletingQuizId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true, error: '' };
    case 'fetch:success':
      return { ...state, quizzes: action.quizzes, loading: false, error: '' };
    case 'fetch:error':
      return { ...state, loading: false, error: action.error };
    case 'filter:set':
      return { ...state, filter: action.filter };
    case 'delete:prompt':
      return { ...state, quizToDelete: action.quiz };
    case 'delete:start':
      return { ...state, deletingQuizId: action.quizId };
    case 'delete:success':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz._id !== action.quizId),
        deletingQuizId: null,
        quizToDelete: null,
      };
    case 'delete:error':
      return { ...state, deletingQuizId: null, error: action.error };
    case 'delete:cancel':
      return { ...state, deletingQuizId: null, quizToDelete: null };
    default:
      return state;
  }
}

function getAuthor(quiz: IQuiz): IUserPreview {
  if (typeof quiz.author === 'object') return quiz.author;
  return { _id: quiz.author, displayName: 'RinKuzu learner' };
}

function getQuestionCount(quiz: IQuiz): number {
  const compactQuiz = quiz as IQuiz & { questionCount?: number };
  return compactQuiz.questionCount ?? quiz.questions.length;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_FORMATTERS = {
  en: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }),
  vi: new Intl.DateTimeFormat('vi', { month: 'long', year: 'numeric' }),
} as const;

function formatMonth(date: Date, locale: string): string {
  return MONTH_FORMATTERS[locale === 'vi' ? 'vi' : 'en'].format(date);
}

function QuizCard({
  quiz,
  locale,
  onDelete,
}: {
  quiz: IQuiz;
  locale: string;
  onDelete: (quiz: IQuiz) => void;
}) {
  const t = useTranslations('profile');
  const author = getAuthor(quiz);

  return (
    <article className="group relative flex min-h-[142px] flex-col overflow-visible rounded-xl border border-line-blue/35 bg-surface-blue p-4 shadow-[1px_1px_2px_rgba(0,0,0,0.03)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/35 hover:bg-white hover:shadow-[0_12px_30px_rgba(68,31,5,0.10)] focus-within:-translate-y-0.5 focus-within:border-accent/35 focus-within:bg-white focus-within:shadow-[0_12px_30px_rgba(68,31,5,0.10)] motion-reduce:transform-none motion-reduce:transition-none">
      <span
        className="pointer-events-none absolute inset-x-4 top-0 h-px origin-left scale-x-0 bg-accent transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-within:scale-x-100 motion-reduce:transition-none"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between text-sm text-ink/40">
        <span>{t('questionCount', { count: getQuestionCount(quiz) })}</span>
        <details className="relative">
          <summary
            className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md text-ink/55 opacity-70 transition-[color,background-color,opacity] hover:bg-accent-soft hover:text-accent group-hover:opacity-100 group-focus-within:opacity-100"
            aria-label={t('quizActions')}
          >
            <HiOutlineDotsVertical className="size-5" />
          </summary>
          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-line bg-white py-1 text-sm text-ink shadow-lg">
            <Link href={`/edit/${quiz._id}`} className="block px-3 py-2 hover:bg-surface-warm">
              {t('edit')}
            </Link>
            <button
              type="button"
              onClick={() => onDelete(quiz)}
              className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
            >
              {t('deleteQuiz')}
            </button>
          </div>
        </details>
      </div>

      <Link href={`/${locale}/quiz/${quiz.slug}`} className="mt-2 flex flex-1 flex-col">
        <h3 className="line-clamp-2 font-home text-base font-semibold leading-[1.35] text-ink transition-colors duration-200 group-hover:text-accent group-focus-within:text-accent">
          {quiz.title}
        </h3>
        <div className="mt-auto flex items-center gap-2 pt-3 text-sm text-ink">
          <UserAvatar
            user={author}
            size={26}
            className="transition-transform duration-200 group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
          />
          <span className="min-w-0 truncate">
            {author.displayName || author.name || author.email || 'RinKuzu learner'}
          </span>
          {quiz.isPrivate ? (
            <HiOutlineLockClosed
              className="ml-auto size-4 shrink-0 text-ink/45"
              aria-label={t('private')}
            />
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export default function ProfileQuizzes() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;

    async function loadQuizzes() {
      dispatch({ type: 'fetch:start' });
      try {
        const data = await fetchApiData<{ quizzes: IQuiz[]; pagination: PaginationMeta }>(
          '/api/quizzes?mine=true&limit=100&compact=true',
        );
        if (active) dispatch({ type: 'fetch:success', quizzes: data.quizzes });
      } catch (error) {
        if (active) {
          dispatch({
            type: 'fetch:error',
            error: extractUnknownErrorMessage(error, t('fetchQuizzesError')),
          });
        }
      }
    }

    void loadQuizzes();
    return () => {
      active = false;
    };
  }, [t]);

  const visibleQuizzes =
    state.filter === 'public'
      ? state.quizzes.filter((quiz) => !quiz.isPrivate)
      : state.filter === 'private'
        ? state.quizzes.filter((quiz) => quiz.isPrivate)
        : state.quizzes;
  const groups = new Map<string, { date: Date; quizzes: IQuiz[] }>();
  for (const quiz of visibleQuizzes) {
    const date = new Date(quiz.createdAt);
    const key = monthKey(date);
    const group = groups.get(key) ?? { date, quizzes: [] };
    group.quizzes.push(quiz);
    groups.set(key, group);
  }
  const groupedQuizzes = Array.from(groups.values()).toSorted(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  async function deleteQuiz(quizId: string) {
    dispatch({ type: 'delete:start', quizId });
    try {
      const response = await fetchApiResponse<null, { message?: string }>(
        `/api/quizzes/${quizId}`,
        {
          method: 'DELETE',
        },
      );
      dispatch({ type: 'delete:success', quizId });
      toast.success(response.meta?.message || t('quizDeleted'));
    } catch (error) {
      dispatch({
        type: 'delete:error',
        error: extractUnknownErrorMessage(error, t('deleteQuizError')),
      });
    }
  }

  return (
    <div className="px-4 pb-20 pt-5 font-home text-ink selection:bg-accent-soft sm:px-6 sm:pt-6 lg:px-8">
      <div className="mx-auto max-w-[1340px]">
        <header className="mb-5 flex flex-col gap-1 sm:mb-6">
          <h1 className="text-2xl font-semibold leading-[1.4] text-ink">
            {t('myQuizzesAndFolder')}
          </h1>
          <p className="text-base text-ink">{t('browseManageQuizzes')}</p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 min-[1684px]:grid-cols-[minmax(0,900px)_416px]">
          <section className="relative min-h-[470px] overflow-hidden rounded-[20px] border border-line-blue/35 bg-white p-5 shadow-[1px_1px_4px_rgba(0,0,0,0.03)]">
            <div
              className="pointer-events-none absolute -bottom-28 -right-24 size-[540px] rounded-full bg-accent-soft/30 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-ink">{t('myQuizzes')}</h2>
              <div className="inline-flex w-fit rounded-[10px] bg-[#d9d5d040] p-1">
                {(['all', 'public', 'private'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => dispatch({ type: 'filter:set', filter })}
                    className={`rounded-md px-3.5 py-1 text-sm transition-colors ${
                      state.filter === filter
                        ? 'bg-white font-semibold text-[#2a0b00] shadow-[1px_1px_2px_rgba(0,0,0,0.03)]'
                        : 'text-ink'
                    }`}
                  >
                    {t(`filter_${filter}`)}
                  </button>
                ))}
              </div>
            </div>

            {state.error ? (
              <div className="relative mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {state.error}
              </div>
            ) : null}

            {state.loading ? (
              <div className="relative mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[142px] animate-pulse rounded-xl border border-line-blue/30 bg-surface-blue"
                  />
                ))}
              </div>
            ) : groupedQuizzes.length === 0 ? (
              <div className="relative flex min-h-[360px] flex-col items-center justify-center text-center">
                <HiOutlineDocumentText className="size-12 text-ink/25" />
                <h3 className="mt-4 text-lg font-semibold text-ink">{t('noQuizzes')}</h3>
                <p className="mt-1 max-w-sm text-sm text-ink/55">{t('createFirst')}</p>
                <Link href="/create" className="mt-5">
                  <Button>{t('newQuiz')}</Button>
                </Link>
              </div>
            ) : (
              <div className="relative mt-6 space-y-7">
                {groupedQuizzes.map((group) => (
                  <div key={monthKey(group.date)}>
                    <h3 className="mb-4 text-base font-normal text-ink">
                      {formatMonth(group.date, locale)}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.quizzes.map((quiz) => (
                        <QuizCard
                          key={quiz._id}
                          quiz={quiz}
                          locale={locale}
                          onDelete={(selected) =>
                            dispatch({ type: 'delete:prompt', quiz: selected })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="rounded-[20px] border border-line-blue/35 bg-white p-5 shadow-[1px_1px_2px_rgba(0,0,0,0.03)]">
            <h2 className="text-lg font-semibold text-ink">{t('quizBuilder')}</h2>
            <p className="mt-1 text-base text-ink">{t('quizBuilderDescription')}</p>
            <div className="mt-6 flex">
              <QuizUploadDropzone className="min-h-[168px]" />
            </div>
          </aside>
        </div>

        <ConfirmModal
          isOpen={!!state.quizToDelete}
          title={t('deleteQuiz')}
          message={
            state.quizToDelete ? t('deleteQuizConfirm', { title: state.quizToDelete.title }) : ''
          }
          confirmText={tCommon('delete')}
          confirmVariant="destructive"
          isLoading={state.deletingQuizId === state.quizToDelete?._id}
          onCancel={() => dispatch({ type: 'delete:cancel' })}
          onConfirm={() => state.quizToDelete && void deleteQuiz(state.quizToDelete._id)}
        />
      </div>
    </div>
  );
}
