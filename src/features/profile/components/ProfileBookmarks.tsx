'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { ROUTES } from '@/shared/constants';
import { HiOutlineTag, HiOutlineTrash } from '@/components/icons';
import Image from 'next/image';
import { StreamingChatModal } from '@/features/quiz/components/chat/StreamingChatModal';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { useStreamingChatSession } from '@/features/quiz/hooks/useStreamingChatSession';
import { fetchApiSuccess } from '@/lib/api/client';

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

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function ProfileBookmarks() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const itemsPerPage = 10;

  // AI Chat states
  const [showAIModal, setShowAIModal] = useState(false);
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
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

  const fetchBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const data = await fetchApiSuccess<Bookmark[], { pagination: PaginationInfo }>(
        `/api/bookmarks?${params}`,
      );
      setBookmarks(data.data);
      setPagination(data.pagination);
      setError('');
    } catch (error: any) {
      setError(error.message || 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const removeBookmark = async (bookmarkId: string) => {
    try {
      await fetchApiSuccess<null>(`/api/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
      });
      setBookmarks((prev) => prev.filter((b) => b._id !== bookmarkId));
      removeHistory(bookmarkId);
    } catch (error: any) {
      setError(error.message || 'Failed to remove bookmark');
    }
  };

  const formatCorrectAnswer = (question: Bookmark['question']) => {
    if (question.type === 'single') {
      return question.options[question.correctIndex!];
    } else {
      return question.correctIndexes!.map((idx) => question.options[idx]).join(', ');
    }
  };

  const openAIModal = (bookmark: Bookmark) => {
    setCurrentBookmark(bookmark);
    setUserQuestion('');
    setAIError('');
    setShowAIModal(true);
    ensureHistory(bookmark._id);
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setCurrentBookmark(null);
    setUserQuestion('');
    setAIError('');
  };

  const askAI = async () => {
    if (!currentBookmark) return;
    await sendMessage({
      historyKey: currentBookmark._id,
      payload: {
        question: currentBookmark.question.text,
        options: currentBookmark.question.options,
        questionImage: currentBookmark.question.questionImage,
        optionImages: currentBookmark.question.optionImages,
      },
      emptyQuestionErrorMessage: 'Please enter a question!',
      requestErrorMessage: 'Failed to connect to AI service.',
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!loadingAI && userQuestion.trim()) askAI();
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setError('');
  };

  const OptionImage = ({ src, alt }: { src: string; alt: string }) => (
    <Image
      src={src}
      alt={alt}
      width={480}
      height={200}
      unoptimized
      className="max-w-full h-auto rounded border"
      style={{ maxHeight: '200px' }}
    />
  );

  if (loading && bookmarks.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          <div className="text-sm text-neutral-500">{tCommon('loadingBookmarks')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">{t('bookmarkedQuestions')}</h2>
        <p className="mt-1 text-neutral-600">{t('bookmarkedDescription')}</p>
      </div>

      {error && <div className="bg-red-50 p-4 rounded text-red-700 text-sm">{error}</div>}

      {bookmarks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="flex justify-center mb-4">
              <HiOutlineTag className="text-neutral-400 w-12 h-12" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">{t('noBookmarks')}</h3>
            <p className="text-neutral-600 mb-6">{t('exploreQuizzes')}</p>
            <Link href={ROUTES.DASHBOARD}>
              <Button>{tCommon('browseQuizzes')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {bookmarks.map((bookmark) => (
            <Card key={bookmark._id} className="hover:shadow-md transition-shadow">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{bookmark.question.text}</CardTitle>
                    <div className="flex items-center space-x-2 mt-2 flex-wrap gap-y-1">
                      <div className="text-sm text-neutral-600">
                        <Link
                          href={`/quiz/${bookmark.quiz.slug}`}
                          className="text-brand-action hover:underline"
                        >
                          {bookmark.quiz.title}
                        </Link>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          bookmark.question.type === 'single'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {bookmark.question.type === 'single'
                          ? t('singleChoice')
                          : t('multipleChoice')}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {new Date(bookmark.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAIModal(bookmark)}
                      className="flex items-center gap-1.5"
                    >
                      <Image
                        src={chatbotIcon}
                        alt="AI chatbot"
                        width={16}
                        height={16}
                        className="w-4 h-4"
                      />{' '}
                      {t('askAI')}{' '}
                      {getHistory(bookmark._id).length > 0 &&
                        `(${Math.floor(getHistory(bookmark._id).length / 2)})`}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeBookmark(bookmark._id)}
                      className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5"
                    >
                      <HiOutlineTrash className="w-4 h-4" /> {tCommon('remove')}
                    </Button>
                  </div>
                </div>
                {bookmark.question.questionImage && (
                  <div className="mt-4">
                    <OptionImage src={bookmark.question.questionImage} alt="Question" />
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
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
          ))}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}

      {showAIModal && currentBookmark && (
        <StreamingChatModal
          isOpen={showAIModal}
          onClose={closeAIModal}
          title={t('chatWithRinChan')}
          questionContent={
            <QuestionOptionsPreview
              questionText={currentBookmark.question.text}
              options={currentBookmark.question.options}
              questionImage={currentBookmark.question.questionImage}
              optionImages={currentBookmark.question.optionImages}
            />
          }
          messages={getHistory(currentBookmark._id)}
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
      )}
    </div>
  );
}
