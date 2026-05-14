'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useStreamingChatSession } from '@/features/quiz/hooks/useStreamingChatSession';
import { fetchApiData } from '@/lib/api/client';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { routePathSegment } from '@/lib/routing/routeParams';
import { useRequiredRouteParam } from '@/lib/routing/useRequiredRouteParam';
import { PaginationMeta } from '@/types';
import { ResultStats } from '@/features/quiz/components/result/ResultStats';
import { QuestionReviewList } from '@/features/quiz/components/result/QuestionReviewList';
import { BookmarkPanel } from '@/features/quiz/components/result/BookmarkPanel';
import { AIExplainPanel } from '@/features/quiz/components/result/AIExplainPanel';

interface QuizResult {
  _id: string;
  score: number;
  takenAt: string;
  answers: (number | number[])[];
  quiz: {
    title: string;
    slug: string;
    description: string;
    questions: {
      question: string;
      options: string[];
      type: 'single' | 'multiple';
      correctIndex?: number;
      correctIndexes?: number[];
      questionImage?: string;
      optionImages?: (string | undefined)[];
      userAnswer: number | number[];
      isCorrect: boolean;
    }[];
  };
}

interface BookmarkSummary {
  _id: string;
  quiz: {
    slug: string;
  };
  questionIndex: number;
}

type BookmarkMessageTone = 'success' | 'warning' | 'error';

export default function QuizResultPage() {
  const t = useTranslations('quiz');
  const tProfile = useTranslations('profile');
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const encodedSlug = routePathSegment(useRequiredRouteParam('slug'));

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuestionData, setAIQuestionData] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const {
    chatHistories,
    userQuestion,
    setUserQuestion,
    loadingAI,
    aiError,
    setAIError,
    ensureHistory,
    clearHistory,
    getHistory,
    sendMessage,
    totalTurns,
  } = useStreamingChatSession({
    persistenceKey: attemptId ? `chat-histories-${attemptId}` : undefined,
  });

  // Bookmark states
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<number>>(new Set());
  const [bookmarkIdsByQuestion, setBookmarkIdsByQuestion] = useState<Record<number, string>>({});
  const [bookmarkLoading, setBookmarkLoading] = useState<Set<number>>(new Set());
  const [bookmarkMessage, setBookmarkMessage] = useState<string>('');
  const [bookmarkMessageTone, setBookmarkMessageTone] = useState<BookmarkMessageTone>('success');
  const [bookmarkToRemove, setBookmarkToRemove] = useState<number | null>(null);

  // Check which questions are already bookmarked
  const checkBookmarkedQuestions = async (resultData: QuizResult) => {
    try {
      const data = await fetchApiData<{
        bookmarks: BookmarkSummary[];
        pagination: PaginationMeta;
      }>('/api/bookmarks');
      const bookmarkedSet = new Set<number>();
      const bookmarkIds: Record<number, string> = {};
      data.bookmarks.forEach((bookmark) => {
        if (bookmark.quiz.slug === resultData.quiz.slug) {
          bookmarkedSet.add(bookmark.questionIndex);
          bookmarkIds[bookmark.questionIndex] = bookmark._id;
        }
      });
      setBookmarkedQuestions(bookmarkedSet);
      setBookmarkIdsByQuestion(bookmarkIds);
    } catch (error) {
      console.error('Failed to check bookmarked questions:', error);
    }
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (!attemptId) {
        setError('No attempt ID provided');
        setLoading(false);
        return;
      }

      try {
        const data = await fetchApiData<QuizResult>(`/api/attempts/${attemptId}`);
        setResult(data);
        await checkBookmarkedQuestions(data);
      } catch (err: unknown) {
        setError(extractUnknownErrorMessage(err, 'Failed to load results'));
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [attemptId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return tProfile('excellent');
    if (score >= 80) return tProfile('great');
    if (score >= 70) return tProfile('good');
    if (score >= 60) return tProfile('pass');
    return tProfile('needsWork');
  };

  const formatAnswer = (
    answer: number | number[],
    options: string[],
    type: 'single' | 'multiple',
    isAnswered: boolean = true,
  ) => {
    if (!isAnswered) {
      return t('notAnswered');
    }

    if (type === 'single') {
      return options[answer as number];
    } else {
      const indices = answer as number[];
      return indices.map((idx) => options[idx]).join(', ');
    }
  };

  const formatCorrectAnswer = (question: QuizResult['quiz']['questions'][0]) => {
    if (question.type === 'single') {
      return typeof question.correctIndex === 'number'
        ? question.options[question.correctIndex] || ''
        : '';
    }

    return (question.correctIndexes || []).map((idx) => question.options[idx]).join(', ');
  };

  const openAIModal = (qData: any, questionIndex: number) => {
    setAIQuestionData(qData);
    setCurrentQuestionIndex(questionIndex);
    setUserQuestion('');
    setAIError('');
    setShowAIModal(true);

    // Initialize chat history for this question if it doesn't exist
    ensureHistory(questionIndex);
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setCurrentQuestionIndex(-1);
    setUserQuestion('');
    setAIError('');
  };

  const askAI = async () => {
    if (!aiQuestionData || currentQuestionIndex === -1) return;
    await sendMessage({
      historyKey: currentQuestionIndex,
      payload: {
        question: aiQuestionData.question,
        options: aiQuestionData.options,
        questionImage: aiQuestionData.questionImage,
        optionImages: aiQuestionData.optionImages,
      },
      emptyQuestionErrorMessage: 'Please enter a question to ask Rin-chan!',
      requestErrorMessage: 'Failed to connect to AI service. Please try again.',
    });
  };

  // Handle keyboard shortcuts
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!loadingAI && userQuestion.trim()) {
        askAI();
      }
    }
  };

  const clearChatHistory = (questionIndex: number) => {
    clearHistory(questionIndex);
  };

  // Bookmark functions
  const removeBookmark = async (questionIndex: number) => {
    if (!result) return;
    const bookmarkId = bookmarkIdsByQuestion[questionIndex];
    if (!bookmarkId) {
      setBookmarkMessageTone('error');
      setBookmarkMessage('Bookmark not found, please refresh and try again');
      setTimeout(() => setBookmarkMessage(''), 3000);
      return;
    }

    setBookmarkLoading((prev) => new Set(prev).add(questionIndex));

    try {
      await fetchApiData<null>(`/api/bookmarks/${bookmarkId}`, { method: 'DELETE' });
      setBookmarkedQuestions((prev) => {
        const next = new Set(prev);
        next.delete(questionIndex);
        return next;
      });
      setBookmarkIdsByQuestion((prev) => {
        const next = { ...prev };
        delete next[questionIndex];
        return next;
      });
      setBookmarkToRemove(null);
      setBookmarkMessageTone('success');
      setBookmarkMessage('Bookmark removed');
    } catch (error: unknown) {
      console.error('Error removing bookmark:', error);
      setBookmarkMessageTone('error');
      setBookmarkMessage(extractUnknownErrorMessage(error, 'Network error, please try again'));
    } finally {
      setBookmarkLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(questionIndex);
        return newSet;
      });
      setTimeout(() => setBookmarkMessage(''), 3000);
    }
  };

  const toggleBookmark = async (questionIndex: number, questionData: any) => {
    if (!result) return;

    if (bookmarkedQuestions.has(questionIndex)) {
      setBookmarkToRemove(questionIndex);
      return;
    }

    setBookmarkLoading((prev) => new Set(prev).add(questionIndex));

    try {
      const bookmarkData = {
        quiz: {
          title: result.quiz.title,
          slug: result.quiz.slug,
          description: result.quiz.description,
        },
        question: {
          text: questionData.question,
          options: questionData.options,
          type: questionData.type,
          correctIndex: questionData.correctIndex,
          correctIndexes: questionData.correctIndexes,
          questionImage: questionData.questionImage,
          optionImages: questionData.optionImages,
        },
        questionIndex: questionIndex,
      };

      const created = await fetchApiData<BookmarkSummary>('/api/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookmarkData),
      });
      setBookmarkedQuestions((prev) => new Set(prev).add(questionIndex));
      if (created._id) {
        setBookmarkIdsByQuestion((prev) => ({ ...prev, [questionIndex]: created._id }));
      }
      setBookmarkMessageTone('success');
      setBookmarkMessage('Question bookmarked successfully!');
    } catch (error: unknown) {
      console.error('Error toggling bookmark:', error);
      const message = extractUnknownErrorMessage(error, 'Network error, please try again');

      if (message === 'Question already bookmarked') {
        setBookmarkMessageTone('warning');
        setBookmarkMessage('This question is already bookmarked');
      } else {
        setBookmarkMessageTone('error');
        setBookmarkMessage(message);
      }

      setTimeout(() => setBookmarkMessage(''), 3000);
    } finally {
      setBookmarkLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(questionIndex);
        return newSet;
      });
    }
  };

  // Get chat statistics
  const getChatStats = () => {
    const questionsWithChat = Object.keys(chatHistories).filter(
      (key) => getHistory(key).length > 0,
    ).length;

    return { totalTurns, questionsWithChat };
  };

  // Calculate statistics
  const correctCount = result?.quiz.questions.filter((q) => q.isCorrect).length || 0;
  const incorrectCount =
    result?.quiz.questions.filter((q) => {
      const isAnswered =
        q.type === 'single'
          ? q.userAnswer !== -1
          : Array.isArray(q.userAnswer) && q.userAnswer.length > 0;
      return !q.isCorrect && isAnswered;
    }).length || 0;
  const unansweredCount =
    result?.quiz.questions.filter((q) => {
      const isAnswered =
        q.type === 'single'
          ? q.userAnswer !== -1
          : Array.isArray(q.userAnswer) && q.userAnswer.length > 0;
      return !isAnswered;
    }).length || 0;
  const totalQuestions = result?.quiz.questions.length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
          <p className="mt-4 text-neutral-600">{t('loadingQuiz')}...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">
              {t('error', { ns: 'common' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-neutral-600 mb-4">{error}</p>
            <Link href="/">
              <Button>{t('backHome')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-neutral-900">{t('quizComplete')}</h1>
            <p className="mt-2 text-neutral-600">{result.quiz.title}</p>
            <p className="text-sm text-neutral-500">
              {t('completedOn')}{' '}
              {new Date(result.takenAt).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ResultStats
          score={result.score}
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          unansweredCount={unansweredCount}
          totalQuestions={totalQuestions}
          chatHistories={chatHistories}
          getChatStats={getChatStats}
          getScoreColor={getScoreColor}
          getScoreMessage={getScoreMessage}
          t={t}
          tProfile={tProfile}
        />

        <BookmarkPanel
          bookmarkMessage={bookmarkMessage}
          bookmarkMessageTone={bookmarkMessageTone}
          onDismissMessage={() => setBookmarkMessage('')}
          bookmarkToRemove={bookmarkToRemove}
          bookmarkLoading={bookmarkLoading}
          onCancelRemove={() => setBookmarkToRemove(null)}
          onConfirmRemove={() => bookmarkToRemove !== null && removeBookmark(bookmarkToRemove)}
          t={t}
        />

        <QuestionReviewList
          questions={result.quiz.questions}
          bookmarkedQuestions={bookmarkedQuestions}
          bookmarkLoading={bookmarkLoading}
          onToggleBookmark={toggleBookmark}
          onOpenAI={openAIModal}
          getHistory={getHistory}
          formatAnswer={formatAnswer}
          formatCorrectAnswer={formatCorrectAnswer}
          t={t}
          tProfile={tProfile}
        />

        {/* Action Buttons */}
        <div className="flex justify-center gap-x-4">
          <Link href={`/quiz/${encodedSlug}`}>
            <Button variant="outline">{tProfile('redo')}</Button>
          </Link>
          <Link href="/">
            <Button>{t('backHome')}</Button>
          </Link>
        </div>
      </main>

      <AIExplainPanel
        isOpen={showAIModal}
        onClose={closeAIModal}
        questionContent={
          aiQuestionData
            ? {
                questionText: aiQuestionData.question,
                options: aiQuestionData.options || [],
                questionImage: aiQuestionData.questionImage,
                optionImages: aiQuestionData.optionImages,
              }
            : null
        }
        messages={getHistory(currentQuestionIndex)}
        userLabel={tProfile('you')}
        assistantLabel={tProfile('rinChan')}
        userQuestion={userQuestion}
        onUserQuestionChange={setUserQuestion}
        onKeyDown={handleKeyPress}
        onSend={askAI}
        sendDisabled={loadingAI || !userQuestion.trim()}
        sendLabel={t('askRinChan')}
        loadingLabel={tProfile('thinking')}
        loadingAI={loadingAI}
        aiError={aiError}
        inputPlaceholder={t('questionPlaceholder')}
        inputMode="textarea"
        inputHintLeft={t('leaveEmptyGeneral')}
        inputHintRight={`Press Ctrl+Enter ${t('send', { ns: 'common' })}`}
        clearLabel={t('clear', { ns: 'common' })}
        onClearHistory={() => clearChatHistory(currentQuestionIndex)}
        showTimestamps
        title={tProfile('chatWithRinChan')}
      />
    </div>
  );
}
