'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { NavigationTabBar } from '@/components/ui/NavigationTabBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { QuizUploadDropzone } from '@/features/dashboard/components/QuizUploadDropzone';
import { FoldersView } from '@/features/folders/components/FoldersView';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { deleteQuizById } from '@/features/quiz/api/quiz-api';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { matchesLibraryStatus, type QuizLibraryFilter } from '@/lib/quiz/library';
import { HiOutlineDocumentText } from 'react-icons/hi';
import { fetchProfileQuizLibraryViewModel } from '@/features/profile/api/profile-quizzes-api';
import { toProfileQuizMonthGroupsViewModel } from '@/features/profile/mappers/profile-quiz.mapper';
import type { ProfileQuizViewModel } from '@/features/profile/types/profile-quiz-view-model';

interface State {
  quizzes: ProfileQuizViewModel[];
  loading: boolean;
  error: string;
  filter: QuizLibraryFilter;
  quizToDelete: ProfileQuizViewModel | null;
  deletingQuizId: string | null;
}

interface ProfileQuizzesProps {
  tab?: 'quizzes' | 'folders';
}

type Action =
  | { type: 'fetch:start' }
  | { type: 'fetch:success'; quizzes: ProfileQuizViewModel[] }
  | { type: 'fetch:error'; error: string }
  | { type: 'filter:set'; filter: QuizLibraryFilter }
  | { type: 'delete:prompt'; quiz: ProfileQuizViewModel }
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
        quizzes: state.quizzes.filter((quiz) => quiz.id !== action.quizId),
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

export default function ProfileQuizzes({ tab = 'quizzes' }: ProfileQuizzesProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;

    async function loadQuizzes() {
      dispatch({ type: 'fetch:start' });
      try {
        const data = await fetchProfileQuizLibraryViewModel();
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

  const visibleQuizzes = state.quizzes.filter((quiz) =>
    matchesLibraryStatus(quiz.libraryStatus, state.filter),
  );
  const groupedQuizzes = toProfileQuizMonthGroupsViewModel({
    quizzes: visibleQuizzes,
    locale,
  });
  const filterOptions = [
    { value: 'all', label: t('filter_all') },
    { value: 'in_progress', label: t('filter_in_progress') },
    { value: 'complete', label: t('filter_complete') },
  ] as const;
  const libraryTabs = [
    { value: 'quizzes', label: t('tabQuizzes'), href: '/my-quizzes' },
    { value: 'folders', label: t('tabFolders'), href: '/my-quizzes?tab=folders' },
  ] as const;

  async function deleteQuiz(quizId: string) {
    dispatch({ type: 'delete:start', quizId });
    try {
      await deleteQuizById(quizId);
      dispatch({ type: 'delete:success', quizId });
      toast.success(t('quizDeleted'));
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
        <NavigationTabBar
          ariaLabel={t('myQuizzes')}
          value={tab}
          options={libraryTabs}
          className="mb-5 mt-1 sm:mt-2"
        />

        {tab === 'folders' ? (
          <section className="min-h-[470px] rounded-[20px] border border-line-blue/35 bg-white p-5 shadow-[1px_1px_4px_rgba(0,0,0,0.03)]">
            <FoldersView />
          </section>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 min-[1684px]:grid-cols-[minmax(0,900px)_416px]">
            <section className="relative min-h-[470px] overflow-hidden rounded-[20px] border border-line-blue/35 bg-white p-5 shadow-[1px_1px_4px_rgba(0,0,0,0.03)]">
              <Image
                src="/images/my-quizzes/flower.svg"
                alt=""
                width={595}
                height={598}
                className="pointer-events-none absolute right-[-67px] top-[203px] hidden h-[598px] w-[595px] max-w-none select-none lg:block"
                aria-hidden="true"
              />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-ink">{t('myQuizzes')}</h2>
                <SegmentedControl
                  ariaLabel={t('myQuizzes')}
                  value={state.filter}
                  options={filterOptions}
                  onChange={(filter) => dispatch({ type: 'filter:set', filter })}
                />
              </div>

              {state.error ? (
                <div className="relative mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                  {state.error}
                </div>
              ) : null}

              <div aria-busy={state.loading}>
                {state.loading ? (
                  <div className="relative mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <QuizCardSkeleton key={`quiz-card-skeleton-${index}`} />
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
                  <div className="relative mt-6 space-y-9">
                    {groupedQuizzes.map((month) => (
                      <section key={month.key} aria-labelledby={`quiz-month-${month.key}`}>
                        <h3
                          id={`quiz-month-${month.key}`}
                          className="mb-5 text-lg font-semibold capitalize text-ink"
                        >
                          {month.label}
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {month.quizzes.map((quiz) => (
                            <QuizCard
                              key={quiz.id}
                              quiz={quiz}
                              quizId={quiz.id}
                              {...(quiz.ownedByMe
                                ? { onDelete: () => dispatch({ type: 'delete:prompt', quiz }) }
                                : {})}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-[20px] border border-line-blue/35 bg-white p-5 shadow-[1px_1px_2px_rgba(0,0,0,0.03)]">
              <h2 className="text-lg font-semibold text-ink">{t('quizBuilder')}</h2>
              <p className="mt-1 text-base text-ink">{t('quizBuilderDescription')}</p>
              <div className="mt-6 flex">
                <QuizUploadDropzone className="min-h-[168px]" />
              </div>
            </aside>
          </div>
        )}

        <ConfirmModal
          isOpen={!!state.quizToDelete}
          title={t('deleteQuiz')}
          message={
            state.quizToDelete ? t('deleteQuizConfirm', { title: state.quizToDelete.title }) : ''
          }
          confirmText={tCommon('delete')}
          confirmVariant="destructive"
          isLoading={state.deletingQuizId === state.quizToDelete?.id}
          onCancel={() => dispatch({ type: 'delete:cancel' })}
          onConfirm={() => state.quizToDelete && void deleteQuiz(state.quizToDelete.id)}
        />
      </div>
    </div>
  );
}
