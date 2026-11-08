'use client';

import { Link } from '@/i18n/navigation';
import { useReducer } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import useSWR, { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { useApiErrorToast } from '@/lib/api/use-api-error';
import { Pill } from '@/components/ui/Pill';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineTrash } from 'react-icons/hi';
import { AskRinPanel } from '@/features/ask-rin-chan/components/AskRinPanel';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { getCorrectAnswerIndexes, getCorrectAnswerOptions } from '@/lib/quiz/answer-text';
import { toStableContentEntries } from '@/lib/collections/stable-content-entries';
import {
  deleteProfileBookmark,
  fetchProfileBookmarkListViewModel,
  fetchProfileBookmarkQuizzes,
} from '@/features/profile/api/profile-bookmarks-api';
import type { ProfileBookmarkViewModel } from '@/features/profile/types/profile-bookmark-view-model';
import {
  BookmarkQuizFilter,
  BookmarksHeader,
  BookmarksSkeleton,
  EmptyBookmarksState,
  StaleQuizFilterState,
} from './ProfileBookmarksParts';

const chatbotIcon = '/images/chatbot_icon.png';

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type BookmarkModal = 'ai' | 'remove' | null;

interface BookmarkOptionImageProps {
  src: string;
  alt: string;
}

interface HydratedDateTextProps {
  dateString: string;
  label: string;
}

interface BookmarkCardProps {
  bookmark: ProfileBookmarkViewModel;
  aiHistoryCount: number;
  onOpenAiModal: (bookmark: ProfileBookmarkViewModel) => void;
  onOpenRemoveModal: (bookmark: ProfileBookmarkViewModel) => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}

interface BookmarksListProps {
  bookmarks: ProfileBookmarkViewModel[];
  historyForBookmark: (bookmarkId: string) => number;
  onOpenAiModal: (bookmark: ProfileBookmarkViewModel) => void;
  onOpenRemoveModal: (bookmark: ProfileBookmarkViewModel) => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}

interface ProfileBookmarksState {
  currentPage: number;
  /** '' = all quizzes. */
  quizSlug: string;
  currentBookmark: ProfileBookmarkViewModel | null;
  activeModal: BookmarkModal;
  removingBookmarkId: string | null;
  historyTurns: Record<string, number>;
}

type ProfileBookmarksAction =
  | { type: 'patch'; value: Partial<ProfileBookmarksState> }
  | { type: 'setPage'; value: number }
  | { type: 'setQuiz'; value: string }
  | { type: 'openAiModal'; bookmark: ProfileBookmarkViewModel }
  | { type: 'openRemoveModal'; bookmark: ProfileBookmarkViewModel }
  | { type: 'setHistoryTurns'; bookmarkId: string; turns: number }
  | { type: 'closeModal' };

const initialState: ProfileBookmarksState = {
  currentPage: 1,
  quizSlug: '',
  currentBookmark: null,
  activeModal: null,
  removingBookmarkId: null,
  historyTurns: {},
};

function profileBookmarksReducer(
  state: ProfileBookmarksState,
  action: ProfileBookmarksAction,
): ProfileBookmarksState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'setPage':
      return { ...state, currentPage: action.value };
    case 'setQuiz':
      return { ...state, quizSlug: action.value, currentPage: 1 };
    case 'openAiModal':
      return { ...state, currentBookmark: action.bookmark, activeModal: 'ai' };
    case 'openRemoveModal':
      return { ...state, currentBookmark: action.bookmark, activeModal: 'remove' };
    case 'setHistoryTurns':
      return {
        ...state,
        historyTurns: { ...state.historyTurns, [action.bookmarkId]: action.turns },
      };
    case 'closeModal':
      return { ...state, currentBookmark: null, activeModal: null, removingBookmarkId: null };
    default:
      return state;
  }
}

function BookmarkOptionImage({ src, alt }: BookmarkOptionImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={480}
      height={200}
      unoptimized
      className="h-auto max-w-full rounded border border-line"
      style={{ maxHeight: '200px' }}
    />
  );
}

function HydratedDateText({ dateString, label }: HydratedDateTextProps) {
  return (
    <time dateTime={dateString} className="font-home text-xs text-ink-muted">
      {label}
    </time>
  );
}

function BookmarkCard({
  bookmark,
  aiHistoryCount,
  onOpenAiModal,
  onOpenRemoveModal,
  t,
  tCommon,
}: BookmarkCardProps) {
  const correctAnswerIndexes = getCorrectAnswerIndexes(bookmark.question);
  const correctAnswers = getCorrectAnswerOptions(bookmark.question);

  return (
    <SurfaceCard className="p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0 flex-1">
          <QuestionContent
            content={bookmark.question.text}
            variant="compact"
            headingLevel={3}
            className="font-home text-lg font-semibold text-ink"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <div className="font-home text-sm font-medium text-ink-muted">
              {bookmark.quiz.title}
            </div>
            <Pill tone={bookmark.question.type === 'single' ? 'warm' : 'cool'}>
              {bookmark.question.type === 'single' ? t('singleChoice') : t('multipleChoice')}
            </Pill>
            <HydratedDateText dateString={bookmark.createdAt} label={bookmark.createdAtLabel} />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {/* 44px tap target on phones; the name starts with the visible text and adds the
              quiz title, so each card's link is distinct for screen readers. */}
          <Link
            href={`/quiz/${bookmark.quiz.slug}`}
            aria-label={`${t('openQuiz')}: ${bookmark.quiz.title}`}
            className="inline-flex min-h-11 items-center px-1 font-home text-sm font-medium text-accent hover:underline sm:min-h-9"
          >
            {t('openQuiz')}
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAiModal(bookmark)}
            className="flex items-center gap-1.5 font-home"
          >
            <Image src={chatbotIcon} alt="AI chatbot" width={16} height={16} className="size-4" />
            {t('askAI')}
            {aiHistoryCount > 0 ? ` (${aiHistoryCount})` : ''}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenRemoveModal(bookmark)}
            className="flex items-center gap-1.5 font-home border-red-200 text-red-600 hover:bg-red-50"
          >
            <HiOutlineTrash className="size-4" /> {tCommon('remove')}
          </Button>
        </div>
      </div>
      {bookmark.question.questionImage ? (
        <div className="mt-4">
          <BookmarkOptionImage src={bookmark.question.questionImage} alt="Question" />
        </div>
      ) : null}
      <div className="mt-4">
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium text-neutral-700">{t('correct')}:</span>
            <div className="mt-1 space-y-1 text-green-600">
              {toStableContentEntries(correctAnswers).map(
                ({ content: answer, key, sourceIndex }) => (
                  <div key={key} className="flex gap-1">
                    <span className="flex-shrink-0">
                      {String.fromCharCode(65 + (correctAnswerIndexes[sourceIndex] ?? sourceIndex))}
                      .
                    </span>
                    <QuestionContent content={answer} variant="answer" className="min-w-0 flex-1" />
                  </div>
                ),
              )}
            </div>
          </div>
          <QuestionOptionsPreview
            options={bookmark.question.options}
            className="mt-2 font-home text-sm text-ink-muted"
            optionsClassName="grid grid-cols-1 gap-1"
            optionItemClassName="opacity-75"
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

function BookmarksList({
  bookmarks,
  historyForBookmark,
  onOpenAiModal,
  onOpenRemoveModal,
  t,
  tCommon,
}: BookmarksListProps) {
  return (
    <div className="space-y-6">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          aiHistoryCount={historyForBookmark(bookmark.id)}
          onOpenAiModal={onOpenAiModal}
          onOpenRemoveModal={onOpenRemoveModal}
          t={t}
          tCommon={tCommon}
        />
      ))}
    </div>
  );
}

export default function ProfileBookmarks() {
  const locale = useLocale();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(profileBookmarksReducer, initialState);
  const itemsPerPage = 10;
  const { mutate: mutateCache } = useSWRConfig();
  const showMutationError = useApiErrorToast();

  // The locale is part of the key: the date labels are formatted for it, so a
  // cached English page must not be served after switching to Vietnamese.
  const quizQuery = state.quizSlug ? `&quizSlug=${encodeURIComponent(state.quizSlug)}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    [`/api/bookmarks?page=${state.currentPage}&limit=${itemsPerPage}${quizQuery}`, locale] as const,
    ([url, pageLocale]) => fetchProfileBookmarkListViewModel(url, pageLocale),
  );
  const {
    data: quizList,
    error: quizListError,
    mutate: mutateQuizList,
  } = useSWR('/api/bookmarks/quizzes', fetchProfileBookmarkQuizzes);

  const bookmarks = data?.bookmarks ?? [];
  const pagination = data?.pagination ?? null;
  const isFiltered = state.quizSlug !== '';
  // No select when the learner has no bookmarks at all, or when the quiz list failed.
  const showQuizFilter =
    !quizListError && (quizList ? quizList.total > 0 : isFiltered || bookmarks.length > 0);
  const setQuiz = (quizSlug: string) => dispatch({ type: 'setQuiz', value: quizSlug });

  // The removed bookmark may have been the last of the chosen quiz: refetch the quiz
  // list and fall back to "All quizzes" when that quiz is gone from it.
  const refreshAfterRemove = async () => {
    const [nextQuizList] = await Promise.all([mutateQuizList(), mutate()]);
    if (
      isFiltered &&
      nextQuizList &&
      !nextQuizList.quizzes.some((q) => q.slug === state.quizSlug)
    ) {
      // The cached "All" page predates the removal: load it fresh before switching to it.
      const allUrl = `/api/bookmarks?page=1&limit=${itemsPerPage}`;
      await mutateCache(
        [allUrl, locale] as const,
        fetchProfileBookmarkListViewModel(allUrl, locale),
        {
          revalidate: false,
        },
      );
      setQuiz('');
    }
  };

  const openAIModal = (bookmark: ProfileBookmarkViewModel) => {
    dispatch({ type: 'openAiModal', bookmark });
  };

  const closeAIModal = () => {
    dispatch({ type: 'closeModal' });
  };

  const removeBookmark = async (bookmarkId: string) => {
    dispatch({ type: 'patch', value: { removingBookmarkId: bookmarkId } });

    try {
      await deleteProfileBookmark(bookmarkId);
      dispatch({ type: 'closeModal' });
      void refreshAfterRemove().catch(() => {
        toast.error(t('refreshBookmarksError'));
      });
    } catch (requestError) {
      showMutationError(requestError);
    } finally {
      dispatch({ type: 'patch', value: { removingBookmarkId: null } });
    }
  };

  if (isLoading) {
    return <BookmarksSkeleton />;
  }

  return (
    <div className="space-y-6">
      <BookmarksHeader count={pagination ? pagination.totalItems : null} t={t} />
      {quizListError ? <ErrorState error={quizListError} onRetry={() => mutateQuizList()} /> : null}
      {showQuizFilter ? (
        <BookmarkQuizFilter quizList={quizList} value={state.quizSlug} onChange={setQuiz} t={t} />
      ) : null}
      {error ? <ErrorState error={error} onRetry={() => mutate()} className="mb-4" /> : null}

      {error && bookmarks.length === 0 ? null : bookmarks.length === 0 ? (
        isFiltered ? (
          <StaleQuizFilterState onShowAll={() => setQuiz('')} t={t} />
        ) : (
          <EmptyBookmarksState t={t} />
        )
      ) : (
        <div className="space-y-6">
          <BookmarksList
            bookmarks={bookmarks}
            historyForBookmark={(bookmarkId) => state.historyTurns[bookmarkId] ?? 0}
            onOpenAiModal={openAIModal}
            onOpenRemoveModal={(bookmark) => dispatch({ type: 'openRemoveModal', bookmark })}
            t={t}
            tCommon={tCommon}
          />

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex justify-center">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={(page) => dispatch({ type: 'setPage', value: page })}
              />
            </div>
          ) : null}
        </div>
      )}

      {state.activeModal === 'ai' && state.currentBookmark ? (
        <AskRinPanel
          isOpen
          onClose={closeAIModal}
          context={{
            source: 'quiz',
            question: state.currentBookmark.question.text,
            options: state.currentBookmark.question.options,
            optionImages:
              state.currentBookmark.question.optionImages?.map((image) => image ?? null) ?? [],
            ...(state.currentBookmark.question.questionImage
              ? { questionImage: state.currentBookmark.question.questionImage }
              : {}),
          }}
          contextPreview={
            <QuestionOptionsPreview
              questionText={state.currentBookmark.question.text}
              options={state.currentBookmark.question.options}
              {...(state.currentBookmark.question.questionImage !== undefined
                ? { questionImage: state.currentBookmark.question.questionImage }
                : {})}
              {...(state.currentBookmark.question.optionImages !== undefined
                ? { optionImages: state.currentBookmark.question.optionImages }
                : {})}
            />
          }
          onHistoryChange={({ totalTurns }) =>
            state.currentBookmark
              ? dispatch({
                  type: 'setHistoryTurns',
                  bookmarkId: state.currentBookmark.id,
                  turns: totalTurns,
                })
              : undefined
          }
        />
      ) : null}

      <ConfirmModal
        isOpen={state.activeModal === 'remove' && !!state.currentBookmark}
        title={t('removeBookmarkTitle')}
        message={
          state.currentBookmark
            ? t('removeBookmarkConfirm', { title: state.currentBookmark.quiz.title })
            : ''
        }
        confirmText={tCommon('remove')}
        onCancel={() => dispatch({ type: 'closeModal' })}
        onConfirm={() =>
          state.currentBookmark ? void removeBookmark(state.currentBookmark.id) : undefined
        }
        isLoading={
          !!(state.currentBookmark && state.removingBookmarkId === state.currentBookmark.id)
        }
      />
    </div>
  );
}
