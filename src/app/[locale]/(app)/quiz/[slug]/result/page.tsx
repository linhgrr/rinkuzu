'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StreamingChatModal } from '@/features/quiz/components/chat/StreamingChatModal';
import { QuestionOptionsPreview } from '@/features/quiz/components/shared/QuestionOptionsPreview';
import { useStreamingChatSession } from '@/features/quiz/hooks/useStreamingChatSession';
import { fetchApiSuccess } from '@/lib/api/client';

interface QuizResultPageProps {
  params: { slug: string };
}

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
  quiz: {
    slug: string;
  };
  questionIndex: number;
}

export default function QuizResultPage({ params }: QuizResultPageProps) {
  const t = useTranslations('quiz');
  const tProfile = useTranslations('profile');
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');

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
  const [bookmarkLoading, setBookmarkLoading] = useState<Set<number>>(new Set());
  const [bookmarkMessage, setBookmarkMessage] = useState<string>('');

  // Check which questions are already bookmarked
  const checkBookmarkedQuestions = async (resultData: QuizResult) => {
    try {
      const data = await fetchApiSuccess<BookmarkSummary[]>('/api/bookmarks');
      const bookmarkedSet = new Set<number>();
      data.data.forEach((bookmark) => {
        if (bookmark.quiz.slug === resultData.quiz.slug) {
          bookmarkedSet.add(bookmark.questionIndex);
        }
      });
      setBookmarkedQuestions(bookmarkedSet);
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
        const data = await fetchApiSuccess<QuizResult>(`/api/attempts/${attemptId}`);
        setResult(data.data);
        await checkBookmarkedQuestions(data.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load results');
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
    if (score >= 90) return `${tProfile('excellent')} 🎉`;
    if (score >= 80) return `${tProfile('great')} 👍`;
    if (score >= 70) return `${tProfile('good')} 👌`;
    if (score >= 60) return `${tProfile('pass')} 📚`;
    return `${tProfile('needsWork')} 💪`;
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
      return question.options[question.correctIndex!];
    } else {
      return question.correctIndexes!.map((idx) => question.options[idx]).join(', ');
    }
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
  const toggleBookmark = async (questionIndex: number, questionData: any) => {
    if (!result) return;

    setBookmarkLoading((prev) => new Set(prev).add(questionIndex));

    try {
      if (bookmarkedQuestions.has(questionIndex)) {
        // Remove bookmark - we need to find the bookmark ID first
        // For now, we'll skip this functionality as it requires a more complex implementation
        console.warn('Remove bookmark functionality not implemented yet');
        return;
      } else {
        // Add bookmark
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

        await fetchApiSuccess<null>('/api/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bookmarkData),
        });
        setBookmarkedQuestions((prev) => new Set(prev).add(questionIndex));
        setBookmarkMessage('✅ Question bookmarked successfully!');

        // Auto-hide message after 3 seconds
        setTimeout(() => setBookmarkMessage(''), 3000);
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);

      if (error.message === 'Question already bookmarked') {
        setBookmarkMessage('⚠️ This question is already bookmarked');
      } else {
        setBookmarkMessage('❌ Network error, please try again');
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
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
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

  const OptionImage = ({ src, alt }: { src: string; alt: string }) => (
    <Image
      src={src}
      alt={alt}
      width={320}
      height={200}
      className="max-w-full h-auto rounded border"
      style={{ maxHeight: '200px' }}
    />
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900">{t('quizComplete')}</h1>
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
        {/* Score Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">{tProfile('avgScore')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="space-y-4">
              <div className={`text-6xl font-bold ${getScoreColor(result.score)}`}>
                {result.score}%
              </div>

              <div className="text-xl text-neutral-700">{getScoreMessage(result.score)}</div>

              <div className="grid grid-cols-2 gap-4 sm:flex sm:justify-center sm:space-x-8 text-sm text-neutral-600">
                <div className="text-center">
                  <div className="font-semibold text-lg text-neutral-900">{correctCount}</div>
                  <div>{tProfile('correct')}</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-neutral-900">{incorrectCount}</div>
                  <div>{t('incorrect')}</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-neutral-900">{unansweredCount}</div>
                  <div>{t('unanswered')}</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-neutral-900">{totalQuestions}</div>
                  <div>{t('total', { ns: 'common' })}</div>
                </div>
              </div>

              {/* Score visualization */}
              <div className="w-full bg-neutral-200 rounded-full h-4 mt-6">
                <div
                  className={`h-4 rounded-full transition-all duration-1000 ${
                    result.score >= 80
                      ? 'bg-green-500'
                      : result.score >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${result.score}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('performanceSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                <div className="text-sm text-green-700">{tProfile('correct')}</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
                <div className="text-sm text-red-700">{t('incorrect')}</div>
              </div>
              <div className="text-center p-4 bg-neutral-50 rounded-lg">
                <div className="text-2xl font-bold text-neutral-600">{unansweredCount}</div>
                <div className="text-sm text-neutral-700">{t('unanswered')}</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-brand-trust">{result.score}%</div>
                <div className="text-sm text-brand-trust">{tProfile('avgScore')}</div>
              </div>
            </div>

            {/* Chat Statistics */}
            {Object.keys(chatHistories).length > 0 &&
              (() => {
                const { totalTurns, questionsWithChat } = getChatStats();
                return totalTurns > 0 ? (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-neutral-700 mb-3">
                      💬 {tProfile('chatWithRinChan')} Statistics
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-brand-trust">{totalTurns}</div>
                        <div className="text-sm text-green-700">Total Chat Turns</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-brand-trust">
                          {questionsWithChat}
                        </div>
                        <div className="text-sm text-green-700">Questions Discussed</div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
          </CardContent>
        </Card>

        {/* Bookmark Message */}
        {bookmarkMessage && (
          <div
            className={`mb-4 p-4 rounded-lg border ${
              bookmarkMessage.includes('✅')
                ? 'bg-green-50 border-green-200 text-green-800'
                : bookmarkMessage.includes('⚠️')
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{bookmarkMessage}</span>
              <button
                onClick={() => setBookmarkMessage('')}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Detailed Results */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{tProfile('details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {result.quiz.questions.map((questionResult, index) => {
                // Calculate if answered based on user answer
                const isAnswered =
                  questionResult.type === 'single'
                    ? questionResult.userAnswer !== -1
                    : Array.isArray(questionResult.userAnswer) &&
                      questionResult.userAnswer.length > 0;

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      questionResult.isCorrect
                        ? 'border-green-200 bg-green-50'
                        : isAnswered
                          ? 'border-red-200 bg-red-50'
                          : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <div className="mb-3">
                      <div className="mb-5 flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => toggleBookmark(index, questionResult)}
                          disabled={bookmarkLoading.has(index)}
                          className={`${
                            bookmarkedQuestions.has(index)
                              ? 'text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                              : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                          }`}
                          title={
                            bookmarkedQuestions.has(index)
                              ? 'Remove bookmark'
                              : 'Bookmark this question'
                          }
                        >
                          {bookmarkLoading.has(index) ? (
                            <span className="animate-spin">⏳</span>
                          ) : bookmarkedQuestions.has(index) ? (
                            '⭐'
                          ) : (
                            '☆'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openAIModal(questionResult, index)}
                          className="text-brand-trust border-green-200 hover:bg-green-50 hover:border-green-300"
                        >
                          {t('askRinChan')}
                          {getHistory(index).length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                              {Math.floor(getHistory(index).length / 2)}
                            </span>
                          )}
                        </Button>
                      </div>

                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-neutral-900 flex-1">
                          {index + 1}. {questionResult.question}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              questionResult.type === 'single'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {questionResult.type === 'single'
                              ? tProfile('singleChoice')
                              : tProfile('multipleChoice')}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              questionResult.isCorrect
                                ? 'bg-green-100 text-green-800'
                                : isAnswered
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {questionResult.isCorrect
                              ? `✓ ${tProfile('correct')}`
                              : isAnswered
                                ? '✗ Incorrect'
                                : `— ${t('notAnswered')}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {questionResult.questionImage && (
                      <div className="mb-4">
                        <OptionImage src={questionResult.questionImage} alt="Question image" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-neutral-700">{t('yourAnswer')}: </span>
                        <span
                          className={
                            questionResult.isCorrect
                              ? 'text-green-600'
                              : isAnswered
                                ? 'text-red-600'
                                : 'text-neutral-500'
                          }
                        >
                          {formatAnswer(
                            questionResult.userAnswer,
                            questionResult.options,
                            questionResult.type,
                            isAnswered,
                          )}
                        </span>
                      </div>

                      {!questionResult.isCorrect && (
                        <div className="text-sm">
                          <span className="font-medium text-neutral-700">
                            {tProfile('correct')}:{' '}
                          </span>
                          <span className="text-green-600">
                            {formatCorrectAnswer(questionResult)}
                          </span>
                        </div>
                      )}

                      <div className="mt-3">
                        <p className="text-sm text-neutral-600 font-medium mb-2">
                          {t('allOptions')}:
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {questionResult.options.map((option, optIdx) => {
                            let isUserAnswer = false;

                            // Only check for user answer if question was answered
                            if (isAnswered) {
                              isUserAnswer =
                                questionResult.type === 'single'
                                  ? questionResult.userAnswer === optIdx
                                  : (questionResult.userAnswer as number[]).includes(optIdx);
                            }

                            const isCorrectAnswer =
                              questionResult.type === 'single'
                                ? questionResult.correctIndex === optIdx
                                : questionResult.correctIndexes?.includes(optIdx);

                            const optionText = String.fromCharCode(65 + optIdx) + '. ' + option;

                            return (
                              <div
                                key={optIdx}
                                className={`text-sm p-2 rounded border ${
                                  isCorrectAnswer
                                    ? 'bg-green-100 border-green-300 text-green-800'
                                    : isUserAnswer
                                      ? 'bg-red-100 border-red-300 text-red-800'
                                      : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="text-neutral-900">{optionText}</span>

                                  {questionResult.optionImages?.[optIdx] && (
                                    <div className="mt-2">
                                      <OptionImage
                                        src={questionResult.optionImages[optIdx]!}
                                        alt={`Option ${String.fromCharCode(65 + optIdx)} image`}
                                      />
                                    </div>
                                  )}
                                </div>

                                {isCorrectAnswer && <span className="ml-2 text-green-600">✓</span>}
                                {isUserAnswer && !isCorrectAnswer && isAnswered && (
                                  <span className="ml-2 text-red-600">✗</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <Link href={`/quiz/${params.slug}`}>
            <Button variant="outline">{tProfile('redo')}</Button>
          </Link>
          <Link href="/">
            <Button>{t('backHome')}</Button>
          </Link>
        </div>
      </main>

      {showAIModal && (
        <StreamingChatModal
          isOpen={showAIModal}
          onClose={closeAIModal}
          title={tProfile('chatWithRinChan')}
          questionContent={
            <QuestionOptionsPreview
              questionText={aiQuestionData?.question}
              options={aiQuestionData?.options || []}
              questionImage={aiQuestionData?.questionImage}
              optionImages={aiQuestionData?.optionImages}
            />
          }
          messages={getHistory(currentQuestionIndex)}
          userLabel={tProfile('you')}
          assistantLabel={`🎓 ${tProfile('rinChan')}`}
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
          inputHintLeft={`💡 ${t('leaveEmptyGeneral')}`}
          inputHintRight={`Press Ctrl+Enter ${t('send', { ns: 'common' })}`}
          clearLabel={t('clear', { ns: 'common' })}
          onClearHistory={() => clearChatHistory(currentQuestionIndex)}
          showTimestamps
        />
      )}
    </div>
  );
}
