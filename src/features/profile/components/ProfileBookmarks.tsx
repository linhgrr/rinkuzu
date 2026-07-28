'use client';

import { Link } from '@/i18n/navigation';
import { useReducer } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pill } from '@/components/ui/Pill';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { Skeleton } from '@/components/ui/Skeleton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineTag, HiOutlineTrash } from 'react-icons/hi';
import { AskRinPanel } from '@/features/ask-rin-chan/components/AskRinPanel';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { getCorrectAnswerIndexes, getCorrectAnswerOptions } from '@/lib/quiz/answer-text';
import { ROUTES } from '@/shared/constants/routes';
import {
  deleteProfileBookmark,
  fetchProfileBookmarkListViewModel,
} from '@/features/profile/api/profile-bookmarks-api';
import type { ProfileBookmarkViewModel } from '@/features/profile/types/profile-bookmark-view-model';

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

interface BookmarksHeaderProps {
  t: TranslateFn;
}

interface BookmarksErrorBannerProps {
  message?: string | null;
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

interface EmptyBookmarksStateProps {
  t: TranslateFn;
  tCommon: TranslateFn;
}

interface ProfileBookmarksState {
  currentPage: number;
  currentBookmark: ProfileBookmarkViewModel | null;
  activeModal: BookmarkModal;
  removingBookmarkId: string | null;
  historyTurns: Record<string, number>;
}

type ProfileBookmarksAction =
  | { type: 'patch'; value: Partial<ProfileBookmarksState> }
  | { type: 'setPage'; value: number }
  | { type: 'openAiModal'; bookmark: ProfileBookmarkViewModel }
  | { type: 'openRemoveModal'; bookmark: ProfileBookmarkViewModel }
  | { type: 'setHistoryTurns'; bookmarkId: string; turns: number }
  | { type: 'closeModal' };

const initialState: ProfileBookmarksState = {
  currentPage: 1,
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

function BookmarksHeader({ t }: BookmarksHeaderProps) {
  return (
    <h2 className="font-home text-[22px] font-semibold leading-[1.35] text-ink sm:text-2xl">
      {t('bookmarkedQuestions')}
    </h2>
  );
}

function BookmarksErrorBanner({ message }: BookmarksErrorBannerProps) {
  if (!message) {
    return null;
  }

  return <ErrorState message={message} className="mb-4" />;
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
          <div role="heading" aria-level={3}>
            <QuestionContent
              content={bookmark.question.text}
              variant="compact"
              className="font-home text-lg font-semibold text-ink"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <div className="font-home text-sm text-ink-muted">
              <Link
                href={`/quiz/${bookmark.quiz.slug}`}
                className="text-accent hover:underline font-medium"
              >
                {bookmark.quiz.title}
              </Link>
            </div>
            <Pill tone={bookmark.question.type === 'single' ? 'warm' : 'cool'}>
              {bookmark.question.type === 'single' ? t('singleChoice') : t('multipleChoice')}
            </Pill>
            <HydratedDateText dateString={bookmark.createdAt} label={bookmark.createdAtLabel} />
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
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
              {correctAnswers.map((answer, index) => (
                <div
                  key={`${correctAnswerIndexes[index] ?? index}-${answer}`}
                  className="flex gap-1"
                >
                  <span className="flex-shrink-0">
                    {String.fromCharCode(65 + (correctAnswerIndexes[index] ?? index))}.
                  </span>
                  <QuestionContent content={answer} variant="answer" className="min-w-0 flex-1" />
                </div>
              ))}
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

function EmptyBookmarksState({ t, tCommon }: EmptyBookmarksStateProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <EmptyState
          icon={<HiOutlineTag className="size-12 text-neutral-400" />}
          title={t('noBookmarks')}
          description={t('exploreQuizzes')}
          action={
            <Link href={ROUTES.DASHBOARD}>
              <Button>{tCommon('browseQuizzes')}</Button>
            </Link>
          }
        />
      </CardContent>
    </Card>
  );
}

function BookmarksSkeleton() {
  return (
    <div className="space-y-4 font-home" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <SurfaceCard key={`bookmark-skeleton-${index}`} className="p-5">
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}

export default function ProfileBookmarks() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(profileBookmarksReducer, initialState);
  const itemsPerPage = 10;

  const { data, error, isLoading, mutate } = useSWR(
    `/api/bookmarks?page=${state.currentPage}&limit=${itemsPerPage}`,
    fetchProfileBookmarkListViewModel,
  );

  const bookmarks = data?.bookmarks ?? [];
  const pagination = data?.pagination ?? null;

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
      void mutate().catch(() => {
        toast.error(t('refreshBookmarksError'));
      });
    } catch {
      toast.error(t('removeBookmarkError'));
    } finally {
      dispatch({ type: 'patch', value: { removingBookmarkId: null } });
    }
  };

  const displayError = error ? (error instanceof Error ? error.message : tCommon('error')) : null;

  if (isLoading) {
    return <BookmarksSkeleton />;
  }

  return (
    <div className="space-y-6">
      <BookmarksHeader t={t} />
      <BookmarksErrorBanner message={displayError} />

      {bookmarks.length === 0 ? (
        <EmptyBookmarksState t={t} tCommon={tCommon} />
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
