'use client';

import { useEffect, useReducer, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { HiOutlineSearch } from 'react-icons/hi';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { NavigationTabBar } from '@/components/ui/NavigationTabBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { QuizUploadDropzone } from '@/features/dashboard/components/QuizUploadDropzone';
import { FoldersView } from '@/features/folders/components/FoldersView';
import { deleteQuizById } from '@/features/quiz/api/quiz-api';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import { useProfileQuizLibrary } from '@/features/profile/hooks/useProfileQuizLibrary';
import type {
  ProfileQuizLibraryCounts,
  ProfileQuizViewModel,
} from '@/features/profile/types/profile-quiz-view-model';
import { ProfileQuizList } from './ProfileQuizList';
import styles from './ProfileQuizzesLayout.module.css';

/** The API rejects longer searches (RIN-1198). */
const SEARCH_MAX_LENGTH = 80;

interface DeleteState {
  quizToDelete: ProfileQuizViewModel | null;
  deletingQuizId: string | null;
}

interface ProfileQuizzesProps {
  tab?: 'quizzes' | 'folders';
}

type DeleteAction =
  | { type: 'delete:prompt'; quiz: ProfileQuizViewModel }
  | { type: 'delete:start'; quizId: string }
  | { type: 'delete:success' }
  | { type: 'delete:error' }
  | { type: 'delete:cancel' };

const initialDeleteState: DeleteState = { quizToDelete: null, deletingQuizId: null };

function deleteReducer(state: DeleteState, action: DeleteAction): DeleteState {
  switch (action.type) {
    case 'delete:prompt':
      return { ...state, quizToDelete: action.quiz };
    case 'delete:start':
      return { ...state, deletingQuizId: action.quizId };
    case 'delete:error':
      return { ...state, deletingQuizId: null };
    case 'delete:success':
    case 'delete:cancel':
      return initialDeleteState;
    default:
      return state;
  }
}

type ProfileTranslate = ReturnType<typeof useTranslations<'profile'>>;

/** Segment labels carry the whole-library counts once the first page has loaded (RIN-1206). */
function toFilterOptions(t: ProfileTranslate, counts: ProfileQuizLibraryCounts | null) {
  return [
    {
      value: 'all',
      label: counts ? t('filterAllCount', { count: counts.all }) : t('filter_all'),
    },
    {
      value: 'in_progress',
      label: counts
        ? t('filterInProgressCount', { count: counts.inProgress })
        : t('filter_in_progress'),
    },
    {
      value: 'complete',
      label: counts ? t('filterCompleteCount', { count: counts.complete }) : t('filter_complete'),
    },
  ] as const;
}

export default function ProfileQuizzes({ tab = 'quizzes' }: ProfileQuizzesProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(deleteReducer, initialDeleteState);
  const library = useProfileQuizLibrary();
  const showMutationError = useApiErrorToast();
  const panelRef = useRef<HTMLElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  /**
   * Load more disables its button while loading. When the page lands, focus goes back to the
   * button, or to the first new card when that was the last page (index of that card, or null).
   */
  const refocusFromRef = useRef<number | null>(null);

  useEffect(() => {
    const from = refocusFromRef.current;
    if (library.phase !== 'idle' || from === null) return;
    refocusFromRef.current = null;
    if (loadMoreRef.current) {
      loadMoreRef.current.focus();
      return;
    }
    panelRef.current?.querySelectorAll<HTMLElement>('article > a')[from]?.focus();
  }, [library.phase]);

  const filterOptions = toFilterOptions(t, library.counts);
  const libraryTabs = [
    { value: 'quizzes', label: t('tabQuizzes'), href: '/my-quizzes' },
    { value: 'folders', label: t('tabFolders'), href: '/my-quizzes?tab=folders' },
  ] as const;

  async function deleteQuiz(quiz: ProfileQuizViewModel) {
    dispatch({ type: 'delete:start', quizId: quiz.id });
    try {
      await deleteQuizById(quiz.id);
      dispatch({ type: 'delete:success' });
      library.removeQuiz(quiz);
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
            aria-labelledby="folders-page-title"
            className={`${styles['libraryPanel']} rounded-panel border border-line-blue/35 bg-white p-5 shadow-quiz-card`}
          >
            {/* The tab bar already shows "Folders"; the h1 names the page for heading navigation (RIN-1200). */}
            <h1 id="folders-page-title" className="sr-only">
              {t('tabFolders')}
            </h1>
            <FoldersView />
          </section>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 min-[1684px]:grid-cols-[minmax(0,900px)_416px]">
            <section
              ref={panelRef}
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

              <h1 className="relative text-lg font-semibold text-ink">{t('myQuizzes')}</h1>
              <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 max-w-full overflow-x-auto [&_button]:whitespace-nowrap">
                  <SegmentedControl
                    ariaLabel={t('myQuizzes')}
                    value={library.filter}
                    options={filterOptions}
                    onChange={library.setFilter}
                  />
                </div>
                <div className="w-full sm:w-72 sm:shrink-0">
                  <Input
                    type="search"
                    aria-label={t('searchMyQuizzes')}
                    placeholder={t('searchMyQuizzes')}
                    autoComplete="off"
                    enterKeyHint="search"
                    maxLength={SEARCH_MAX_LENGTH}
                    icon={<HiOutlineSearch aria-hidden="true" className="size-5" />}
                    value={library.searchInput}
                    onChange={(event) => library.setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Escape' || !library.searchInput) return;
                      event.preventDefault();
                      library.clearSearch();
                    }}
                  />
                </div>
              </div>

              {library.error ? (
                <ErrorState
                  error={library.error}
                  onRetry={library.retry}
                  className="relative mt-5"
                />
              ) : (
                <ProfileQuizList
                  quizzes={library.quizzes}
                  counts={library.counts}
                  query={library.query}
                  loading={library.phase === 'loading'}
                  loadingMore={library.phase === 'loading-more'}
                  hasMore={library.hasMore}
                  loadMoreError={library.loadMoreError}
                  loadMoreRef={loadMoreRef}
                  onLoadMore={(focusedButton) => {
                    refocusFromRef.current = focusedButton ? library.quizzes.length : null;
                    library.loadMore();
                  }}
                  onClearSearch={library.clearSearch}
                  onDelete={(quiz) => dispatch({ type: 'delete:prompt', quiz })}
                />
              )}
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
          onConfirm={() => state.quizToDelete && void deleteQuiz(state.quizToDelete)}
        />
      </div>
    </div>
  );
}
