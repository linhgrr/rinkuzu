'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useReducer, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationTabBar } from '@/components/ui/NavigationTabBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { QuizUploadDropzone } from '@/features/dashboard/components/QuizUploadDropzone';
import { FoldersView } from '@/features/folders/components/FoldersView';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';
import { deleteQuizById } from '@/features/quiz/api/quiz-api';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import { matchesLibraryStatus, type QuizLibraryFilter } from '@/lib/quiz/library';
import { HiOutlineDocumentText } from 'react-icons/hi';
import { fetchProfileQuizLibraryViewModel } from '@/features/profile/api/profile-quizzes-api';
import { toProfileQuizMonthGroupsViewModel } from '@/features/profile/mappers/profile-quiz.mapper';
import type { ProfileQuizViewModel } from '@/features/profile/types/profile-quiz-view-model';
import { fetchMyPremiumSubmissions } from '@/features/profile/api/premium-submissions-api';
import styles from './ProfileQuizzesLayout.module.css';

interface State {
  quizzes: ProfileQuizViewModel[];
  loading: boolean;
  /** Load failure, rendered by ErrorState from the error layer (RIN-755). */
  error: unknown;
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
  | { type: 'fetch:error'; error: unknown }
  | { type: 'filter:set'; filter: QuizLibraryFilter }
  | { type: 'delete:prompt'; quiz: ProfileQuizViewModel }
  | { type: 'delete:start'; quizId: string }
  | { type: 'delete:success'; quizId: string }
  | { type: 'delete:error' }
  | { type: 'delete:cancel' };

const initialState: State = {
  quizzes: [],
  loading: true,
  error: null,
  filter: 'all',
  quizToDelete: null,
  deletingQuizId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch:start':
      return { ...state, loading: true, error: null };
    case 'fetch:success':
      return { ...state, quizzes: action.quizzes, loading: false, error: null };
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
      return { ...state, deletingQuizId: null };
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const showMutationError = useApiErrorToast();

  useEffect(() => {
    let active = true;

    async function loadQuizzes() {
      dispatch({ type: 'fetch:start' });
      try {
        const [data, submissions] = await Promise.all([
          fetchProfileQuizLibraryViewModel(),
          fetchMyPremiumSubmissions(),
        ]);
        const latestByQuiz = new Map(
          submissions
            .toSorted((left, right) => left.version - right.version)
            .map((submission) => [submission.sourceQuizId, submission]),
        );
        const quizzes = data.quizzes.map((quiz) => {
          const submission = latestByQuiz.get(quiz.id);
          return submission
            ? {
                ...quiz,
                premiumSubmissionStatus: submission.status,
                awardedCredits: submission.awardedCredits,
              }
            : quiz;
        });
        if (active) dispatch({ type: 'fetch:success', quizzes });
      } catch (error) {
        if (active) {
          dispatch({ type: 'fetch:error', error });
        }
      }
    }

    void loadQuizzes();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

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
      dispatch({ type: 'delete:error' });
      showMutationError(error);
    }
  }

  return (
    <div className="px-4 pb-20 pt-5 font-home text-ink selection:bg-accent-soft sm:px-6 sm:pt-6 lg:px-8">
      <div className={`${styles['pageContent']} mx-auto`}>
        <NavigationTabBar
          ariaLabel={t('myQuizzes')}
          value={tab}
          options={libraryTabs}
          className="mb-5 mt-1 sm:mt-2"
        />

        {tab === 'folders' ? (
          <section
            className={`${styles['libraryPanel']} rounded-panel border border-line-blue/35 bg-white p-5 shadow-quiz-card`}
          >
            <FoldersView />
          </section>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 min-[1684px]:grid-cols-[minmax(0,900px)_416px]">
            <section
              className={`${styles['libraryPanel']} relative overflow-hidden rounded-panel border border-line-blue/35 bg-white p-5 shadow-quiz-card`}
            >
              <Image
                src="/images/my-quizzes/flower.svg"
                alt=""
                width={595}
                height={598}
                className={`${styles['flowerArtwork']} pointer-events-none absolute hidden max-w-none select-none lg:block`}
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
                <ErrorState
                  error={state.error}
                  onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
                  className="relative mt-5"
                />
              ) : null}

              <div aria-busy={state.loading}>
                {state.loading ? (
                  <div className="relative mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <QuizCardSkeleton key={`quiz-card-skeleton-${index}`} />
                    ))}
                  </div>
                ) : state.error ? null : groupedQuizzes.length === 0 ? (
                  <div
                    className={`${styles['emptyState']} relative flex flex-col items-center justify-center text-center`}
                  >
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

            <aside className="rounded-panel border border-line-blue/35 bg-white p-5 shadow-segmented">
              <h2 className="text-lg font-semibold text-ink">{t('quizBuilder')}</h2>
              <p className="mt-1 text-base text-ink">{t('quizBuilderDescription')}</p>
              <div className="mt-6 flex">
                <QuizUploadDropzone className={styles['uploadDropzone']} />
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
