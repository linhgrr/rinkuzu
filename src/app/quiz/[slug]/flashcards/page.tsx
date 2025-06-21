'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Flashcard } from '@/components/ui/Flashcard';

interface Question {
  question: string;
  options: string[];
  type: 'single' | 'multiple';
  correctIndex: number;
  correctIndexes?: number[];
}

interface Quiz {
  _id: string;
  title: string;
  description?: string;
  questions: Question[];
  slug: string;
}

interface FlashcardProgress {
  known: number[];
  unknown: number[];
  currentIndex: number;
}

export default function FlashcardPage() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<FlashcardProgress>({
    known: [],
    unknown: [],
    currentIndex: 0
  });
  const [showResults, setShowResults] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);

  useEffect(() => {
    fetchQuiz();
  }, [params.slug]);

  // Prevent scroll on mobile for flashcard page
  useEffect(() => {
    // Check if it's a mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
      // Save original body style
      const originalStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        height: document.body.style.height,
        width: document.body.style.width
      };

      // Apply mobile-specific styles to prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.height = '100vh';
      document.body.style.width = '100vw';

      // Cleanup function to restore original styles
      return () => {
        document.body.style.overflow = originalStyle.overflow;
        document.body.style.position = originalStyle.position;
        document.body.style.height = originalStyle.height;
        document.body.style.width = originalStyle.width;
      };
    }
  }, []);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz/${params.slug}/flashcards`);
      const data = await response.json();

      if (data.success) {
        setQuiz(data.data);
        setCurrentQuestions(data.data.questions);
      } else {
        setError(data.error || 'Failed to load quiz');
      }
    } catch (error) {
      setError('Failed to load quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!quiz) return;

    const currentQuestionIndex = progress.currentIndex;
    
    if (direction === 'right') {
      // Known - add to known list
      setProgress(prev => ({
        ...prev,
        known: [...prev.known, currentQuestionIndex],
        currentIndex: prev.currentIndex + 1
      }));
    } else {
      // Unknown - add to unknown list
      setProgress(prev => ({
        ...prev,
        unknown: [...prev.unknown, currentQuestionIndex],
        currentIndex: prev.currentIndex + 1
      }));
    }
  };

  const resetProgress = () => {
    // Reset về tất cả câu hỏi gốc
    if (quiz) {
      setCurrentQuestions(quiz.questions);
    }
    setProgress({
      known: [],
      unknown: [],
      currentIndex: 0
    });
    setShowResults(false);
  };

  const continuePractice = () => {
    // Tạo danh sách mới chỉ với các câu chưa biết
    const unknownQuestions = progress.unknown.map(index => quiz!.questions[index]);
    
    // Cập nhật danh sách câu hỏi hiện tại để chỉ chứa câu chưa biết
    setCurrentQuestions(unknownQuestions);
    
    // Reset progress để học lại các câu chưa biết
    setProgress({
      known: [],
      unknown: [],
      currentIndex: 0
    });
    setShowResults(false);
  };

  const getCurrentQuestion = () => {
    if (currentQuestions.length === 0 || progress.currentIndex >= currentQuestions.length) return null;
    return currentQuestions[progress.currentIndex];
  };

  const getProgressPercentage = () => {
    if (currentQuestions.length === 0) return 0;
    return Math.round((progress.currentIndex / currentQuestions.length) * 100);
  };

  const getKnownCount = () => progress.known.length;
  const getUnknownCount = () => progress.unknown.length;
  const getRemainingCount = () => {
    if (!quiz) return 0;
    return quiz.questions.length - progress.currentIndex;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/quizzes">
              <Button>Back to Quizzes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quiz Not Found</h2>
            <p className="text-gray-600 mb-4">The quiz you're looking for doesn't exist.</p>
            <Link href="/quizzes">
              <Button>Back to Quizzes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show results when all questions are completed
  if (currentQuestions.length > 0 && progress.currentIndex >= currentQuestions.length && !showResults) {
    setShowResults(true);
  }

  if (showResults) {
      return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link href="/quizzes" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">R</span>
                  </div>
                  <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link href={`/quiz/${quiz.slug}`}>
                  <Button variant="outline">Take Quiz</Button>
                </Link>
                <Link href="/quizzes">
                  <Button variant="outline">All Quizzes</Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Flashcard Results</h1>
            <p className="text-gray-600">{quiz.title}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">{getKnownCount()}</div>
                <div className="text-sm text-gray-600">Questions You Know</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-red-600 mb-2">{getUnknownCount()}</div>
                <div className="text-sm text-gray-600">Questions to Review</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {Math.round((getKnownCount() / quiz.questions.length) * 100)}%
                </div>
                <div className="text-sm text-gray-600">Mastery Level</div>
              </CardContent>
            </Card>
          </div>

          {getUnknownCount() > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Questions to Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {progress.unknown.map((questionIndex, index) => {
                    const question = quiz.questions[questionIndex];
                    return (
                      <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-gray-900">
                          Question {questionIndex + 1}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {question.question.substring(0, 100)}...
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center space-x-4">
            {getUnknownCount() > 0 ? (
              <Button onClick={continuePractice} className="bg-blue-600 hover:bg-blue-700">
                Continue Practice
              </Button>
            ) : (
              <Button onClick={resetProgress} className="bg-blue-600 hover:bg-blue-700">
                Practice Again
              </Button>
            )}
            <Link href={`/quiz/${quiz.slug}`}>
              <Button variant="outline">Take Full Quiz</Button>
            </Link>
            <Link href="/quizzes">
              <Button variant="outline">Back to Quizzes</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = getCurrentQuestion();

  return (
    <div className="h-screen bg-gray-50 flex flex-col items-center relative overflow-hidden" 
         style={{ 
           touchAction: 'none', // Disable all default touch behaviors
           WebkitTouchCallout: 'none', // Disable iOS callout
           WebkitUserSelect: 'none', // Disable text selection
           userSelect: 'none'
         }}>
      {/* Fixed top bar with counters and progress */}
      <div className="fixed top-20 left-0 right-0 z-50 flex items-center justify-between px-4">
        <div className="bg-red-100 text-red-700 px-4 py-2 rounded-full shadow-lg text-sm font-medium">
          Chưa biết: {getUnknownCount()}
        </div>
        
        {/* Progress Bar */}
        <div className="flex-1 mx-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {progress.currentIndex + 1} of {currentQuestions.length}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {getProgressPercentage()}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>
        </div>
        
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full shadow-lg text-sm font-medium">
          Đã biết: {getKnownCount()}
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/quizzes" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href={`/quiz/${quiz.slug}`}>
                <Button variant="outline">Take Quiz</Button>
              </Link>
              <Link href="/quizzes">
                <Button variant="outline">All Quizzes</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full flex-1 flex flex-col items-center justify-center pt-20 overflow-hidden">
        {/* Flashcard (centered) */}
        <div className="flex flex-col items-center justify-center h-full w-full overflow-hidden">
          {currentQuestion && (
            <Flashcard
              key={`${progress.currentIndex}-${currentQuestion.question.substring(0, 50)}`}
              question={currentQuestion.question}
              options={currentQuestion.options}
              correctIndex={currentQuestion.correctIndex}
              correctIndexes={currentQuestion.correctIndexes}
              type={currentQuestion.type}
              onSwipe={handleSwipe}
              isLast={progress.currentIndex === quiz.questions.length - 1}
            />
          )}
        </div>
      </main>
    </div>
  );
} 