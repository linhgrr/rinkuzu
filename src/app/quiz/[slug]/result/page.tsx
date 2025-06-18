'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuestionImage, OptionImage } from '@/components/ui/ImageDisplay';

interface QuizResultPageProps {
  params: { slug: string };
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  quizTitle: string;
  takenAt: string;
  results: {
    question: string;
    options: string[];
    type: 'single' | 'multiple';
    userAnswer: number | number[];
    correctAnswer: number | number[];
    isCorrect: boolean;
    isAnswered: boolean;
    questionImage?: string;
    optionImages?: (string | undefined)[];
  }[];
}

export default function QuizResultPage({ params }: QuizResultPageProps) {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const attemptId = searchParams.get('attemptId');

  useEffect(() => {
    const fetchResults = async () => {
      if (!attemptId) {
        setError('No attempt ID provided');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/attempts/${attemptId}`);
        const data = await response.json();

        if (data.success) {
          setResult(data.data);
        } else {
          setError(data.error || 'Failed to load results');
        }
      } catch (err) {
        setError('Failed to load results');
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
    if (score >= 90) return 'Excellent! 🎉';
    if (score >= 80) return 'Great job! 👍';
    if (score >= 70) return 'Good work! 👌';
    if (score >= 60) return 'Not bad! 📚';
    return 'Keep studying! 💪';
  };

  const formatAnswer = (answer: number | number[], options: string[], type: 'single' | 'multiple', isAnswered: boolean = true) => {
    if (!isAnswered) {
      return 'Not answered';
    }
    
    if (type === 'single') {
      return options[answer as number];
    } else {
      const indices = answer as number[];
      return indices.map(idx => options[idx]).join(', ');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Quiz Complete!</h1>
            <p className="mt-2 text-gray-600">{result.quizTitle}</p>
            <p className="text-sm text-gray-500">
              Completed on {new Date(result.takenAt).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">Your Score</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="space-y-4">
              <div className={`text-6xl font-bold ${getScoreColor(result.score)}`}>
                {result.score}%
              </div>
              
              <div className="text-xl text-gray-700">
                {getScoreMessage(result.score)}
              </div>

              <div className="flex justify-center space-x-8 text-sm text-gray-600">
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{result.correctAnswers}</div>
                  <div>Correct</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{result.results.filter(r => {
                    const isAnswered = r.isAnswered !== undefined 
                      ? r.isAnswered 
                      : (r.type === 'single' ? r.userAnswer !== -1 : Array.isArray(r.userAnswer) && r.userAnswer.length > 0);
                    return !r.isCorrect && isAnswered;
                  }).length}</div>
                  <div>Incorrect</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{result.results.filter(r => {
                    const isAnswered = r.isAnswered !== undefined 
                      ? r.isAnswered 
                      : (r.type === 'single' ? r.userAnswer !== -1 : Array.isArray(r.userAnswer) && r.userAnswer.length > 0);
                    return !isAnswered;
                  }).length}</div>
                  <div>Unanswered</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{result.totalQuestions}</div>
                  <div>Total</div>
                </div>
              </div>

              {/* Score visualization */}
              <div className="w-full bg-gray-200 rounded-full h-4 mt-6">
                <div
                  className={`h-4 rounded-full transition-all duration-1000 ${
                    result.score >= 80 ? 'bg-green-500' :
                    result.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
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
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{result.correctAnswers}</div>
                <div className="text-sm text-green-700">Correct Answers</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{result.results.filter(r => {
                  const isAnswered = r.isAnswered !== undefined 
                    ? r.isAnswered 
                    : (r.type === 'single' ? r.userAnswer !== -1 : Array.isArray(r.userAnswer) && r.userAnswer.length > 0);
                  return !r.isCorrect && isAnswered;
                }).length}</div>
                <div className="text-sm text-red-700">Incorrect Answers</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{result.results.filter(r => {
                  const isAnswered = r.isAnswered !== undefined 
                    ? r.isAnswered 
                    : (r.type === 'single' ? r.userAnswer !== -1 : Array.isArray(r.userAnswer) && r.userAnswer.length > 0);
                  return !isAnswered;
                }).length}</div>
                <div className="text-sm text-gray-700">Unanswered</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{result.score}%</div>
                <div className="text-sm text-blue-700">Overall Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Results */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Detailed Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {result.results.map((questionResult, index) => {
                // Fallback logic for backward compatibility with old data
                const isAnswered = questionResult.isAnswered !== undefined 
                  ? questionResult.isAnswered 
                  : (questionResult.type === 'single' 
                      ? questionResult.userAnswer !== -1 
                      : Array.isArray(questionResult.userAnswer) && questionResult.userAnswer.length > 0);
                
                return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    questionResult.isCorrect 
                      ? 'border-green-200 bg-green-50' 
                      : isAnswered
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex-1">
                      {index + 1}. {questionResult.question}
                    </h3>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        questionResult.type === 'single' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {questionResult.type === 'single' ? 'Single Choice' : 'Multiple Choice'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        questionResult.isCorrect 
                          ? 'bg-green-100 text-green-800' 
                          : isAnswered
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {questionResult.isCorrect 
                          ? '✓ Correct' 
                          : isAnswered 
                            ? '✗ Incorrect' 
                            : '— Unanswered'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Your answer: </span>
                      <span className={questionResult.isCorrect ? 'text-green-600' : isAnswered ? 'text-red-600' : 'text-gray-500'}>
                        {formatAnswer(questionResult.userAnswer, questionResult.options, questionResult.type, isAnswered)}
                      </span>
                    </div>

                    {!questionResult.isCorrect && (
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Correct answer: </span>
                        <span className="text-green-600">
                          {formatAnswer(questionResult.correctAnswer, questionResult.options, questionResult.type, true)}
                        </span>
                      </div>
                    )}

                    <div className="mt-3">
                      <p className="text-sm text-gray-600 font-medium mb-2">All options:</p>
                      <div className="grid grid-cols-1 gap-1">
                        {questionResult.options.map((option, optIdx) => {
                          let isUserAnswer = false;
                          
                          // Only check for user answer if question was answered
                          if (isAnswered) {
                            isUserAnswer = questionResult.type === 'single' 
                              ? questionResult.userAnswer === optIdx
                              : (questionResult.userAnswer as number[]).includes(optIdx);
                          }
                          
                          const isCorrectAnswer = questionResult.type === 'single'
                            ? questionResult.correctAnswer === optIdx
                            : (questionResult.correctAnswer as number[]).includes(optIdx);

                          const optionText = String.fromCharCode(65 + optIdx) + '. ' + option;

                          return (
                            <div
                              key={optIdx}
                              className={`text-sm p-2 rounded border ${
                                isCorrectAnswer 
                                  ? 'bg-green-100 border-green-300 text-green-800' 
                                  : isUserAnswer 
                                    ? 'bg-red-100 border-red-300 text-red-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                              }`}
                            >
                              <div className="flex-1">
                                <span className="text-gray-900">{optionText}</span>

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
                              {isUserAnswer && !isCorrectAnswer && isAnswered && <span className="ml-2 text-red-600">✗</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {questionResult.questionImage && (
                    <div className="mt-3">
                      <QuestionImage
                        src={questionResult.questionImage}
                        alt={`Question ${index + 1} image`}
                      />
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Message based on performance */}
        <Card className="mb-8">
          <CardContent className="text-center py-8">
            {result.score >= 80 ? (
              <div className="space-y-2">
                <div className="text-4xl">🏆</div>
                <h3 className="text-xl font-semibold text-gray-900">Outstanding Performance!</h3>
                <p className="text-gray-600">You've demonstrated excellent understanding of the material.</p>
              </div>
            ) : result.score >= 60 ? (
              <div className="space-y-2">
                <div className="text-4xl">📚</div>
                <h3 className="text-xl font-semibold text-gray-900">Good Job!</h3>
                <p className="text-gray-600">You're on the right track. Consider reviewing the topics you missed.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">💪</div>
                <h3 className="text-xl font-semibold text-gray-900">Keep Learning!</h3>
                <p className="text-gray-600">Don't worry, learning takes time. Review the material and try again.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="text-center py-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">What's Next?</h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href={`/quiz/${params.slug}`}>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Try Again
                  </Button>
                </Link>
                <Link href="/">
                  <Button className="w-full sm:w-auto">
                    Find More Quizzes
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share Results */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-center">Share Your Achievement</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Let others know about your quiz performance!
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = `I just scored ${result.score}% on "${result.quizTitle}"! 🎯`;
                  const url = window.location.href;
                  navigator.share?.({ title: 'Quiz Result', text, url }) || 
                  navigator.clipboard?.writeText(`${text} ${url}`);
                }}
              >
                📤 Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                🖨️ Print
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 