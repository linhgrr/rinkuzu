'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Modal } from './Modal';
import { ImageDisplay } from './ImageDisplay';
import { MarkdownRenderer } from './MarkdownRenderer';

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

interface AttemptDetailModalProps {
  attemptId: string;
  isOpen: boolean;
  onClose: () => void;
  quizTitle: string;
}

export default function AttemptDetailModal({ 
  attemptId, 
  isOpen, 
  onClose, 
  quizTitle 
}: AttemptDetailModalProps) {
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && attemptId) {
      fetchAttemptDetail();
    }
  }, [isOpen, attemptId]);

  const fetchAttemptDetail = async () => {
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
    } catch (error) {
      setError('Failed to load attempt details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        return answer.map(idx => question.options[idx]).join(', ');
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

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Chi Tiết Kết Quả
              </h2>
              <Button variant="ghost" onClick={onClose}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            
            {attempt && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">{attempt.quiz.title}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>📊 Điểm: {attempt.score}%</span>
                  <span>📝 {attempt.quiz.questions.length} câu hỏi</span>
                  <span>🕒 {formatDate(attempt.takenAt)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="text-gray-500">Đang tải...</div>
              </div>
            ) : error ? (
              <div className="p-6">
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            ) : attempt ? (
              <div className="p-6 space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardContent className="text-center py-4">
                      <div className="text-xl font-bold text-green-600">
                        {attempt.quiz.questions.filter(q => q.isCorrect).length}
                      </div>
                      <div className="text-sm text-gray-600">Câu đúng</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="text-center py-4">
                      <div className="text-xl font-bold text-red-600">
                        {attempt.quiz.questions.filter(q => !q.isCorrect).length}
                      </div>
                      <div className="text-sm text-gray-600">Câu sai</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="text-center py-4">
                      <div className="text-xl font-bold text-blue-600">
                        {attempt.score}%
                      </div>
                      <div className="text-sm text-gray-600">Tổng điểm</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Questions */}
                <div className="space-y-6">
                  {attempt.quiz.questions.map((question, index) => (
                    <Card key={index} className={`border-l-4 ${question.isCorrect ? 'border-green-500' : 'border-red-500'}`}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="text-lg">Câu {index + 1}</span>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            question.isCorrect 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {question.isCorrect ? '✓ Đúng' : '✗ Sai'}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Question */}
                        <div>
                          <MarkdownRenderer content={question.question} />
                          {question.questionImage && (
                            <div className="mt-2">
                              <ImageDisplay src={question.questionImage} alt="Question image" />
                            </div>
                          )}
                        </div>

                        {/* User Answer */}
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Câu trả lời của bạn:</h5>
                          <div className={`p-3 rounded-lg ${question.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                            <div className={question.isCorrect ? 'text-green-800' : 'text-red-800'}>
                              {getAnswerText(question, question.userAnswer)}
                            </div>
                          </div>
                        </div>

                        {/* Correct Answer (if wrong) */}
                        {!question.isCorrect && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Đáp án đúng:</h5>
                            <div className="p-3 rounded-lg bg-green-50">
                              <div className="text-green-800">
                                {getCorrectAnswerText(question)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* All Options */}
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Các lựa chọn:</h5>
                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => {
                              const isUserChoice = question.type === 'single' 
                                ? question.userAnswer === optionIndex
                                : Array.isArray(question.userAnswer) && question.userAnswer.includes(optionIndex);
                              
                              const isCorrectChoice = question.type === 'single'
                                ? question.correctIndex === optionIndex
                                : question.correctIndexes?.includes(optionIndex);

                              return (
                                <div 
                                  key={optionIndex}
                                  className={`p-2 rounded border ${
                                    isCorrectChoice 
                                      ? 'border-green-500 bg-green-50' 
                                      : isUserChoice 
                                        ? 'border-red-500 bg-red-50'
                                        : 'border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{String.fromCharCode(65 + optionIndex)}. {option}</span>
                                    <div className="flex space-x-1">
                                      {isCorrectChoice && (
                                        <span className="text-green-600 text-sm">✓ Đúng</span>
                                      )}
                                      {isUserChoice && !isCorrectChoice && (
                                        <span className="text-red-600 text-sm">✗ Bạn chọn</span>
                                      )}
                                      {isUserChoice && isCorrectChoice && (
                                        <span className="text-green-600 text-sm">✓ Bạn chọn đúng</span>
                                      )}
                                    </div>
                                  </div>
                                  {question.optionImages?.[optionIndex] && (
                                    <div className="mt-2">
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
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
} 