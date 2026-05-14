'use client';

import { useReducer, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState } from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineTag, HiOutlineTrash } from '@/components/icons';
import { StreamingChatModal } from '@/features/quiz/components/chat/StreamingChatModal';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { useStreamingChatSession } from '@/features/quiz/hooks/useStreamingChatSession';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { fetchApiData } from '@/lib/api/client';
import { ROUTES } from '@/shared/constants';
import { PaginationMeta } from '@/types';

const chatbotIcon =
  'https://i.ibb.co/ZRYgc1tN/Gemini-Generated-Image-yjm06yyjm06yyjm0-removebg-preview.png';

interface Bookmark {
  _id: string;
  quiz: {
    title: string;
    slug: string;
    description?: string;
  };
  question: {
    text: string;
    options: string[];
    type: 'single' | 'multiple';
    correctIndex?: number;
    correctIndexes?: number[];
    questionImage?: string;
    optionImages?: (string | undefined)[];
  };
  questionIndex: number;
  createdAt: string;
  tags?: string[];
}

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;
type BookmarkModal = 'ai' | 'remove' | null;

interface ProfileBookmarksState {
  currentPage: number;
  localError: string;
  currentBookmark: Bookmark | null;
  activeModal: BookmarkModal;
  removingBookmarkId: string | null;
}

type ProfileBookmarksAction =
  | { type: 'patch'; value: Partial<ProfileBookmarksState> }
  | { type: 'setPage'; value: number }
  | { type: 'openAiModal'; bookmark: Bookmark }
  | { type: 'openRemoveModal'; bookmark: Bookmark }
  | { type: 'closeModal' };

const initialState: ProfileBookmarksState = {
  currentPage: 1,
  localError: '',
  currentBookmark: null,
  activeModal: null,
  removingBookmarkId: null,
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
    case 'closeModal':
      return { ...state, currentBookmark: null, activeModal: null, removingBookmarkId: null };
    default:
      return state;
  }
}

function formatCorrectAnswer(question: Bookmark['question']) {
  if (question.type === 'single') {
    return typeof question.correctIndex === 'number'
      ? question.options[question.correctIndex] || ''
      : '';
  }

  return (question.correctIndexes || []).map((idx) => question.options[idx]).join(', ');
}

function BookmarkOptionImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={480}
      height={200}
      unoptimized
      className="h-auto max-w-full rounded border"
      style={{ maxHeight: '200px' }}
    />
  );
}

function HydratedDateText({ dateString }: { dateString: string }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const label = mounted ? new Date(dateString).toLocaleDateString() : '';

  return (
    <time dateTime={dateString} suppressHydrationWarning className="text-xs text-neutral-500">
      {label}
    </time>
  );
}

function BookmarksHeader({ t }: { t: TranslateFn }) {
  return <h2 className="text-2xl font-semibold text-neutral-900">{t('bookmarkedQuestions')}</h2>;
}

function BookmarksErrorBanner({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return <div className="rounded bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function BookmarkCard({
  bookmark,
  aiHistoryCount,
  onOpenAiModal,
  onOpenRemoveModal,
  t,
  tCommon,
}: {
  bookmark: Bookmark;
  aiHistoryCount: number;
  onOpenAiModal: (bookmark: Bookmark) => void;
  onOpenRemoveModal: (bookmark: Bookmark) => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{bookmark.question.text}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-sm text-neutral-600">
                <Link
                  href={`/quiz/${bookmark.quiz.slug}`}
                  className="text-brand-action hover:underline"
                >
                  {bookmark.quiz.title}
                </Link>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  bookmark.question.type === 'single'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {bookmark.question.type === 'single' ? t('singleChoice') : t('multipleChoice')}
              </span>
              <HydratedDateText dateString={bookmark.createdAt} />
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenAiModal(bookmark)}
              className="flex items-center gap-1.5"
            >
              <Image src={chatbotIcon} alt="AI chatbot" width={16} height={16} className="size-4" />
              {t('askAI')}
              {aiHistoryCount > 0 ? ` (${aiHistoryCount})` : ''}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenRemoveModal(bookmark)}
              className="flex items-center gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
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
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium text-neutral-700">{t('correct')}: </span>
            <span className="text-green-600">{formatCorrectAnswer(bookmark.question)}</span>
          </div>
          <QuestionOptionsPreview
            options={bookmark.question.options}
            className="mt-2 text-sm text-neutral-600"
            optionsClassName="grid grid-cols-1 gap-1"
            optionItemClassName="opacity-75"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BookmarksList({
  bookmarks,
  historyForBookmark,
  onOpenAiModal,
  onOpenRemoveModal,
  t,
  tCommon,
}: {
  bookmarks: Bookmark[];
  historyForBookmark: (bookmarkId: string) => number;
  onOpenAiModal: (bookmark: Bookmark) => void;
  onOpenRemoveModal: (bookmark: Bookmark) => void;
  t: TranslateFn;
  tCommon: TranslateFn;
}) {
  return (
    <div className="space-y-6">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark._id}
          bookmark={bookmark}
          aiHistoryCount={historyForBookmark(bookmark._id)}
          onOpenAiModal={onOpenAiModal}
          onOpenRemoveModal={onOpenRemoveModal}
          t={t}
          tCommon={tCommon}
        />
      ))}
    </div>
  );
}

function EmptyBookmarksState({ t, tCommon }: { t: TranslateFn; tCommon: TranslateFn }) {
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

export default function ProfileBookmarks() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(profileBookmarksReducer, initialState);
  const itemsPerPage = 10;

  const { data, error, isLoading, mutate } = useSWR(
    `/api/bookmarks?page=${state.currentPage}&limit=${itemsPerPage}`,
    fetchApiData<{ bookmarks: Bookmark[]; pagination: PaginationMeta }>,
  );

  const bookmarks = data?.bookmarks ?? [];
  const pagination = data?.pagination ?? null;

  const {
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    setAIError,
    ensureHistory,
    removeHistory,
    getHistory,
    sendMessage,
  } = useStreamingChatSession({
    persistenceKey: 'bookmark-chat-histories',
  });

  const openAIModal = (bookmark: Bookmark) => {
    dispatch({ type: 'openAiModal', bookmark });
    setUserQuestion('');
    setAIError('');
    ensureHistory(bookmark._id);
  };

  const closeAIModal = () => {
    dispatch({ type: 'closeModal' });
    setUserQuestion('');
    setAIError('');
  };

  const removeBookmark = async (bookmarkId: string) => {
    dispatch({ type: 'patch', value: { removingBookmarkId: bookmarkId } });

    try {
      await fetchApiData<null>(`/api/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
      });
      mutate();
      removeHistory(bookmarkId);
      dispatch({ type: 'patch', value: { localError: '' } });
      dispatch({ type: 'closeModal' });
    } catch (error: unknown) {
      dispatch({
        type: 'patch',
        value: {
          removingBookmarkId: null,
          localError: extractUnknownErrorMessage(error, 'Failed to remove bookmark'),
        },
      });
    }
  };

  const askAI = async () => {
    if (!state.currentBookmark) return;

    await sendMessage({
      historyKey: state.currentBookmark._id,
      payload: {
        question: state.currentBookmark.question.text,
        options: state.currentBookmark.question.options,
        questionImage: state.currentBookmark.question.questionImage,
        optionImages: state.currentBookmark.question.optionImages,
      },
      emptyQuestionErrorMessage: 'Please enter a question!',
      requestErrorMessage: 'Failed to connect to AI service.',
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!loadingAI && userQuestion.trim()) {
        void askAI();
      }
    }
  };

  const displayError = error?.message || state.localError || '';

  if (isLoading && bookmarks.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          <div className="text-sm text-neutral-500">{tCommon('loadingBookmarks')}</div>
        </div>
      </div>
    );
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
            historyForBookmark={(bookmarkId) => Math.floor(getHistory(bookmarkId).length / 2)}
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
        <StreamingChatModal
          isOpen={true}
          onClose={closeAIModal}
          title={t('chatWithRinChan')}
          questionContent={
            <QuestionOptionsPreview
              questionText={state.currentBookmark.question.text}
              options={state.currentBookmark.question.options}
              questionImage={state.currentBookmark.question.questionImage}
              optionImages={state.currentBookmark.question.optionImages}
            />
          }
          messages={getHistory(state.currentBookmark._id)}
          userLabel={t('you')}
          assistantLabel={t('rinChan')}
          userQuestion={userQuestion}
          onUserQuestionChange={setUserQuestion}
          onKeyDown={handleKeyPress}
          onSend={askAI}
          sendDisabled={loadingAI || !userQuestion.trim()}
          sendLabel={tCommon('send')}
          loadingLabel={t('thinking')}
          loadingAI={loadingAI}
          aiError={aiError}
          inputPlaceholder={t('askQuestion')}
          inputMode="input"
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
          state.currentBookmark ? void removeBookmark(state.currentBookmark._id) : undefined
        }
        isLoading={
          !!(state.currentBookmark && state.removingBookmarkId === state.currentBookmark._id)
        }
      />
    </div>
  );
}
