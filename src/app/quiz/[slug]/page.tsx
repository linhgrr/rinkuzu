'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useQuizStore } from '@/store/useQuizStore';
import { IQuiz } from '@/types';

interface QuizPlayerPageProps {
  params: { slug: string };
}

export default function QuizPlayerPage({ params }: QuizPlayerPageProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [quiz, setQuiz] = useState<IQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | number[])[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Ask AI states
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiExplanation, setAIExplanation] = useState('');
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');

  // Exit quiz states
  const [showExitModal, setShowExitModal] = useState(false);

  // If user is logged in, skip email input
  useEffect(() => {
    if (session?.user?.email) {
      setUserEmail(session.user.email);
      setShowEmailInput(false);
    }
  }, [session]);

  useEffect(() => {
    fetchQuiz();
  }, [params.slug]);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz/${params.slug}/play`);
      const data = await response.json();

      if (data.success) {
        setQuiz(data.data);
        // Initialize answers based on question types
        const initialAnswers = data.data.questions.map((q: any, index: number) => {
          console.log(`Question ${index}:`, { type: q.type, question: q.question });
          return q.type === 'multiple' ? [] : -1;
        });
        setUserAnswers(initialAnswers);
        console.log('Quiz initialized with answers:', initialAnswers);
      } else {
        setError(data.error || 'Quiz not found');
      }
    } catch (error) {
      setError('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    if (!session?.user?.email && !userEmail.trim()) {
      setError('Please enter your email to start the quiz');
      return;
    }
    setShowEmailInput(false);
    setError('');
  };

  const selectAnswer = (answerIndex: number) => {
    if (!quiz) return;
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    const newAnswers = [...userAnswers];
    
    if (currentQuestion.type === 'single') {
      // Single choice: replace answer
      newAnswers[currentQuestionIndex] = answerIndex;
    } else {
      // Multiple choice: toggle answer in array
      let currentAnswers = newAnswers[currentQuestionIndex];
      
      // Ensure currentAnswers is an array for multiple choice
      if (!Array.isArray(currentAnswers)) {
        currentAnswers = [];
      }
      
      const answerExists = currentAnswers.includes(answerIndex);
      
      if (answerExists) {
        // Remove answer
        newAnswers[currentQuestionIndex] = currentAnswers.filter(a => a !== answerIndex);
      } else {
        // Add answer
        newAnswers[currentQuestionIndex] = [...currentAnswers, answerIndex].sort();
      }
    }
    setUserAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < quiz!.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    
    const unanswered = userAnswers.filter((answer, index) => {
      const question = quiz.questions[index];
      if (question.type === 'single') {
        return answer === -1;
      } else {
        return !Array.isArray(answer) || answer.length === 0;
      }
    }).length;
    
    if (unanswered > 0) {
      if (!confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        answers: userAnswers,
        userEmail: session?.user?.email || userEmail.trim(),
      };
      
      const response = await fetch(`/api/quiz/${params.slug}/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/quiz/${params.slug}/result?attemptId=${data.data.attemptId}&score=${data.data.score}`);
      } else {
        setError(data.error || 'Failed to submit quiz');
      }
    } catch (error) {
      setError('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const askAI = async () => {
    if (!quiz) return;
    
    setLoadingAI(true);
    setAIError('');
    setAIExplanation('');
    
    try {
      const currentQuestion = quiz.questions[currentQuestionIndex];
      const response = await fetch('/api/quiz/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: currentQuestion.question,
          options: currentQuestion.options,
          userQuestion: userQuestion.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAIExplanation(data.data.explanation);
      } else {
        setAIError(data.error || 'Failed to get AI explanation');
      }
    } catch (error) {
      setAIError('Failed to connect to AI service');
    } finally {
      setLoadingAI(false);
    }
  };

  const openAIModal = () => {
    setShowAIModal(true);
    setUserQuestion('');
    setAIExplanation('');
    setAIError('');
  };

  const closeAIModal = () => {
    setShowAIModal(false);
  };

  // Exit quiz functions
  const openExitModal = () => {
    setShowExitModal(true);
  };

  const closeExitModal = () => {
    setShowExitModal(false);
  };

  const exitQuiz = () => {
    router.push('/quizzes');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error && !quiz) {
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

  if (!quiz) return null;

  // Email input screen (only for non-logged in users)
  if (showEmailInput && !session?.user?.email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center">{quiz.title}</CardTitle>
            {quiz.description && (
              <p className="text-sm text-gray-600 text-center mt-2">{quiz.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center text-sm text-gray-600">
                <p>📝 {quiz.questions.length} questions</p>
                <p>⏱️ No time limit</p>
              </div>
              
              {error && (
                <div className="rounded-md bg-red-50 p-3">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 <Link href="/login" className="underline font-medium">Login</Link> to track your quiz history or continue as guest below.
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email *
                </label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  We'll use this to track your quiz attempt
                </p>
              </div>

              <div className="flex gap-3">
                <Link href="/quizzes" className="flex-1">
                  <Button variant="outline" className="w-full">
                    ← Back to Quizzes
                  </Button>
                </Link>
                <Link href={`/quiz/${params.slug}/flashcards`} className="flex-1">
                  <Button variant="outline" className="w-full bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100">
                    🗂️ Learn with Flashcards
                  </Button>
                </Link>
                <Button onClick={startQuiz} className="flex-1">
                  Start Quiz
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz interface
  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = Math.round(((currentQuestionIndex + 1) / quiz.questions.length) * 100);
  const answeredQuestions = userAnswers.filter((answer, index) => {
    const question = quiz.questions[index];
    if (question.type === 'single') {
      return answer !== -1;
    } else {
      return Array.isArray(answer) && answer.length > 0;
    }
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={openExitModal}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                ← Exit Quiz
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{quiz.title}</h1>
                <p className="text-sm text-gray-600">
                  {session?.user?.email ? (
                    <span className="text-green-600">👤 {session.user.email}</span>
                  ) : (
                    <span className="text-gray-500">📧 {userEmail}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </div>
              <div className="text-xs text-gray-500">
                {answeredQuestions} answered
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Question */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-xl">
                  {currentQuestion.question}
                </CardTitle>
                <div className="text-sm text-gray-600 mt-2">
                  {currentQuestion.type === 'single' ? (
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      📝 Single Choice - Select one answer
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                      ☑️ Multiple Choice - Select all that apply
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={openAIModal}
                className="ml-4 text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
              >
                🤖 Ask AI
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const currentAnswer = userAnswers[currentQuestionIndex];
                let isSelected = false;
                
                if (currentQuestion.type === 'single') {
                  isSelected = currentAnswer === index;
                } else {
                  // For multiple choice, ensure we have an array
                  isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(index);
                }
                
                return (
                  <label
                    key={index}
                    className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type={currentQuestion.type === 'single' ? 'radio' : 'checkbox'}
                      name={`question-${currentQuestionIndex}`}
                      value={index}
                      checked={isSelected}
                      onChange={() => selectAnswer(index)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 mr-3 flex items-center justify-center border-2 ${
                      currentQuestion.type === 'single' ? 'rounded-full' : 'rounded'
                    } ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        currentQuestion.type === 'single' ? (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        ) : (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )
                      )}
                    </div>
                    <span className="text-gray-900">{option}</span>
                  </label>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8">
              <Button
                variant="outline"
                onClick={previousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>

              <div className="text-sm text-gray-600">
                {currentQuestionIndex + 1} / {quiz.questions.length}
              </div>

              {currentQuestionIndex === quiz.questions.length - 1 ? (
                <Button
                  onClick={submitQuiz}
                  loading={submitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Submit Quiz
                </Button>
              ) : (
                <Button
                  onClick={nextQuestion}
                  disabled={currentQuestionIndex === quiz.questions.length - 1}
                >
                  Next
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question overview */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Question Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-2">
              {quiz.questions.map((question, index) => {
                let isAnswered = false;
                const answer = userAnswers[index];
                
                if (question.type === 'single') {
                  isAnswered = answer !== -1;
                } else {
                  isAnswered = Array.isArray(answer) && answer.length > 0;
                }
                
                return (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white'
                        : isAnswered
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-300'
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center space-x-6 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-600 rounded mr-2"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded mr-2"></div>
                <span>Not answered</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exit Quiz Modal */}
        <Modal
          isOpen={showExitModal}
          onClose={closeExitModal}
          title="⚠️ Exit Quiz"
          size="small"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to exit this quiz? Your progress will not be saved and you'll need to start over.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You have answered {answeredQuestions} out of {quiz.questions.length} questions. This progress will be lost if you exit.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={closeExitModal}
                className="flex-1"
              >
                Continue Quiz
              </Button>
              <Button
                onClick={exitQuiz}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Exit Quiz
              </Button>
            </div>
          </div>
        </Modal>

        {/* Ask AI Modal */}
        <Modal
          isOpen={showAIModal}
          onClose={closeAIModal}
          title="🤖 Ask AI about this question"
          size="wide"
        >
          <div className="space-y-4">
            {/* Current Question Display */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Current Question:</h4>
              <p className="text-sm text-gray-700">{quiz && currentQuestion.question}</p>
              <div className="mt-2 space-y-1">
                {quiz && currentQuestion.options.map((option, index) => (
                  <div key={index} className="text-xs text-gray-600">
                    {String.fromCharCode(65 + index)}. {option}
                  </div>
                ))}
              </div>
            </div>

            {/* User Question Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ask a specific question (optional):
              </label>
              <Input
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder="e.g., What does this concept mean? How do I approach this type of question?"
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for a general explanation of the question
              </p>
            </div>

            {/* Ask Button */}
            <Button
              onClick={askAI}
              loading={loadingAI}
              disabled={loadingAI}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loadingAI ? 'Getting AI explanation...' : 'Get AI Explanation'}
            </Button>

            {/* AI Response */}
            {aiError && (
              <div className="rounded-md bg-red-50 p-3">
                <div className="text-sm text-red-700">{aiError}</div>
              </div>
            )}

            {aiExplanation && (
              <div className="rounded-md bg-green-50 p-4">
                <h4 className="font-medium text-green-900 mb-3">🎓 AI Explanation:</h4>
                <MarkdownRenderer 
                  content={aiExplanation} 
                  className="text-green-800"
                />
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-md">
              <strong>📝 Note:</strong> This AI explanation is for learning purposes. 
              It won't reveal the correct answer directly but will help you understand 
              the concepts and approach to solve the question.
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
} 