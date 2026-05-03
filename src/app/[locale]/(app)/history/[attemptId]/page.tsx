'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ImageDisplay } from '@/components/ui/ImageDisplay';
import { DynamicMarkdownRenderer as MarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import Sidebar from '@/components/Sidebar';
import {
  HiOutlineArrowLeft,
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineRefresh,
  HiOutlineX,
  HiOutlineXCircle,
} from '@/components/icons';

interface AttemptDetail {
  _id: string;
  score: number;
  takenAt: string;
  answers: (number | number[])[];
  quiz: {
    title: string;
    slug: string;
    description?: string;
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

export default function AttemptDetailPage() {
  const params = useParams();
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const historyLink = '/history';

  const fetchAttemptDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/attempts/${attemptId}`);
      const data = await response.json();

      if (data.success) {
        setAttempt(data.data);
      } else {
        setError(data.error || 'Failed to fetch attempt details');
      }
    } catch (_error) {
      setError('Failed to load attempt details');
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId) {
      fetchAttemptDetail();
    }
  }, [attemptId, fetchAttemptDetail]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAnswerText = (question: any, answer: number | number[]) => {
    if (question.type === 'single') {
      if (typeof answer === 'number' && answer >= 0) {
        return question.options[answer];
      }
      return 'Không trả lời';
    } else {
      if (Array.isArray(answer) && answer.length > 0) {
        return answer.map((idx) => question.options[idx]).join(', ');
      }
      return 'Không trả lời';
    }
  };

  const getCorrectAnswerText = (question: any) => {
    if (question.type === 'single' && question.correctIndex !== undefined) {
      return question.options[question.correctIndex];
    } else if (question.type === 'multiple' && question.correctIndexes) {
      return question.correctIndexes.map((idx: number) => question.options[idx]).join(', ');
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath="/history"
      />

      {/* Main Content */}
      <main
        className={`py-8 transition-all duration-300 ${
          isSidebarOpen ? 'ml-64' : 'ml-16'
        } max-w-none px-4 sm:px-6 lg:px-8`}
      >
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <nav className="flex items-center space-x-2 text-sm text-neutral-500 mb-2">
                  <Link href={historyLink} className="hover:text-neutral-700">
                    Lịch sử Quiz
                  </Link>
                  <span>/</span>
                  <span className="text-neutral-900">Chi tiết kết quả</span>
                </nav>
                <h1 className="text-3xl font-bold text-neutral-900">Chi Tiết Kết Quả</h1>
                {attempt && (
                  <div className="mt-2">
                    <h2 className="text-xl font-semibold text-neutral-800">{attempt.quiz.title}</h2>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-neutral-600">
                      <span className="inline-flex items-center gap-1.5">
                        <HiOutlineChartBar className="w-4 h-4" />
                        Điểm: {attempt.score}%
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <HiOutlineDocumentText className="w-4 h-4" />
                        {attempt.quiz.questions.length} câu hỏi
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <HiOutlineClock className="w-4 h-4" />
                        {formatDate(attempt.takenAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <Link href={historyLink}>
                  <Button variant="outline">
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineArrowLeft className="w-4 h-4" />
                      Quay lại
                    </span>
                  </Button>
                </Link>
                {attempt && (
                  <Link href={`/quiz/${attempt.quiz.slug}`}>
                    <Button>
                      <span className="inline-flex items-center gap-2">
                        <HiOutlineRefresh className="w-4 h-4" />
                        Làm lại Quiz
                      </span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="text-neutral-500">Đang tải...</div>
            </div>
          ) : error ? (
            <div className="mb-6">
              <Card>
                <CardContent className="text-center py-12">
                  <div className="mb-4 flex justify-center text-red-600">
                    <HiOutlineXCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">Có lỗi xảy ra</h3>
                  <p className="text-neutral-600 mb-4">{error}</p>
                  <Link href={historyLink}>
                    <Button>Quay lại lịch sử</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : attempt ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-green-600">
                      {attempt.quiz.questions.filter((q) => q.isCorrect).length}
                    </div>
                    <div className="text-sm text-neutral-600 mt-1">Câu đúng</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-red-600">
                      {attempt.quiz.questions.filter((q) => !q.isCorrect).length}
                    </div>
                    <div className="text-sm text-neutral-600 mt-1">Câu sai</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="text-center py-6">
                    <div className="text-3xl font-bold text-brand-trust">{attempt.score}%</div>
                    <div className="text-sm text-neutral-600 mt-1">Tổng điểm</div>
                  </CardContent>
                </Card>
              </div>

              {/* Questions */}
              <div className="space-y-8">
                {attempt.quiz.questions.map((question, index) => (
                  <Card
                    key={index}
                    className={`border-l-4 ${question.isCorrect ? 'border-green-500' : 'border-red-500'}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="text-xl">Câu {index + 1}</span>
                        <span
                          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                            question.isCorrect
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {question.isCorrect ? (
                            <span className="inline-flex items-center gap-1.5">
                              <HiOutlineCheck className="w-4 h-4" />
                              Đúng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <HiOutlineX className="w-4 h-4" />
                              Sai
                            </span>
                          )}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Question */}
                      <div>
                        <h4 className="font-medium text-neutral-900 mb-3">Câu hỏi:</h4>
                        <div className="bg-neutral-50 p-4 rounded-lg">
                          <MarkdownRenderer content={question.question} />
                          {question.questionImage && (
                            <div className="mt-3">
                              <ImageDisplay src={question.questionImage} alt="Question image" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* User Answer */}
                      <div>
                        <h5 className="font-medium text-neutral-900 mb-3">Câu trả lời của bạn:</h5>
                        <div
                          className={`p-4 rounded-lg ${question.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                        >
                          <div
                            className={`font-medium ${question.isCorrect ? 'text-green-800' : 'text-red-800'}`}
                          >
                            {getAnswerText(question, question.userAnswer)}
                          </div>
                        </div>
                      </div>

                      {/* Correct Answer (if wrong) */}
                      {!question.isCorrect && (
                        <div>
                          <h5 className="font-medium text-neutral-900 mb-3">Đáp án đúng:</h5>
                          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                            <div className="text-green-800 font-medium">
                              {getCorrectAnswerText(question)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* All Options */}
                      <div>
                        <h5 className="font-medium text-neutral-900 mb-3">Tất cả các lựa chọn:</h5>
                        <div className="space-y-3">
                          {question.options.map((option, optionIndex) => {
                            const isUserChoice =
                              question.type === 'single'
                                ? question.userAnswer === optionIndex
                                : Array.isArray(question.userAnswer) &&
                                  question.userAnswer.includes(optionIndex);

                            const isCorrectChoice =
                              question.type === 'single'
                                ? question.correctIndex === optionIndex
                                : question.correctIndexes?.includes(optionIndex);

                            return (
                              <div
                                key={optionIndex}
                                className={`p-4 rounded-lg border-2 ${
                                  isCorrectChoice
                                    ? 'border-green-500 bg-green-50'
                                    : isUserChoice
                                      ? 'border-red-500 bg-red-50'
                                      : 'border-neutral-200 bg-neutral-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <span className="font-medium">
                                      {String.fromCharCode(65 + optionIndex)}.
                                    </span>{' '}
                                    {option}
                                  </div>
                                  <div className="flex space-x-2 ml-4">
                                    {isCorrectChoice && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <span className="inline-flex items-center gap-1">
                                          <HiOutlineCheck className="w-3 h-3" />
                                          Đáp án đúng
                                        </span>
                                      </span>
                                    )}
                                    {isUserChoice && !isCorrectChoice && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <span className="inline-flex items-center gap-1">
                                          <HiOutlineX className="w-3 h-3" />
                                          Bạn đã chọn
                                        </span>
                                      </span>
                                    )}
                                    {isUserChoice && isCorrectChoice && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <span className="inline-flex items-center gap-1">
                                          <HiOutlineCheck className="w-3 h-3" />
                                          Bạn chọn đúng
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {question.optionImages?.[optionIndex] && (
                                  <div className="mt-3">
                                    <ImageDisplay
                                      src={question.optionImages[optionIndex]!}
                                      alt={`Option ${String.fromCharCode(65 + optionIndex)} image`}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Footer Actions */}
              <div className="flex justify-center space-x-4 pt-8 border-t border-neutral-200">
                <Link href={historyLink}>
                  <Button variant="outline" size="lg">
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineArrowLeft className="w-4 h-4" />
                      Quay lại lịch sử
                    </span>
                  </Button>
                </Link>
                <Link href={`/quiz/${attempt.quiz.slug}`}>
                  <Button size="lg">
                    <span className="inline-flex items-center gap-2">
                      <HiOutlineRefresh className="w-4 h-4" />
                      Làm lại Quiz
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
