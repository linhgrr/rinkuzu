'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

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

// Chat message interface
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Chat history state for each question
interface ChatHistoryState {
  [questionIndex: number]: ChatMessage[];
}

export default function QuizResultPage({ params }: QuizResultPageProps) {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuestionData, setAIQuestionData] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');
  
  // Multi-turn chat state
  const [chatHistories, setChatHistories] = useState<ChatHistoryState>({});

  // Load chat histories from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && attemptId) {
      const savedChats = localStorage.getItem(`chat-histories-${attemptId}`);
      if (savedChats) {
        try {
          setChatHistories(JSON.parse(savedChats));
        } catch (error) {
          console.error('Failed to load chat histories:', error);
        }
      }
    }
  }, [attemptId]);

  // Save chat histories to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && attemptId && Object.keys(chatHistories).length > 0) {
      localStorage.setItem(`chat-histories-${attemptId}`, JSON.stringify(chatHistories));
    }
  }, [chatHistories, attemptId]);

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

  const formatCorrectAnswer = (question: QuizResult['quiz']['questions'][0]) => {
    if (question.type === 'single') {
      return question.options[question.correctIndex!];
    } else {
      return question.correctIndexes!.map(idx => question.options[idx]).join(', ');
    }
  };

  const openAIModal = (qData: any, questionIndex: number) => {
    setAIQuestionData(qData);
    setCurrentQuestionIndex(questionIndex);
    setUserQuestion('');
    setAIError('');
    setShowAIModal(true);
    
    // Initialize chat history for this question if it doesn't exist
    if (!chatHistories[questionIndex]) {
      setChatHistories(prev => ({
        ...prev,
        [questionIndex]: []
      }));
    }
    
    // Auto-scroll to bottom when modal opens (for existing chat history)
    scrollToBottom(300); // Longer delay to ensure modal is fully rendered
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setCurrentQuestionIndex(-1);
    setUserQuestion('');
    setAIError('');
  };

  const addMessageToHistory = (questionIndex: number, message: ChatMessage) => {
    setChatHistories(prev => ({
      ...prev,
      [questionIndex]: [...(prev[questionIndex] || []), message]
    }));
    
    // Auto-scroll to bottom when new message is added
    scrollToBottom();
  };

  const askAI = async () => {
    if (!aiQuestionData || currentQuestionIndex === -1) return;
    
    const trimmedQuestion = userQuestion.trim();
    if (!trimmedQuestion) {
      setAIError('Please enter a question to ask Rin-chan!');
      return;
    }

    setLoadingAI(true);
    setAIError('');
    
    try {
      // Add user message to chat history
      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmedQuestion,
        timestamp: new Date().toISOString()
      };
      addMessageToHistory(currentQuestionIndex, userMessage);

      // Get current chat history for this question
      const currentHistory = chatHistories[currentQuestionIndex] || [];
      
      const resp = await fetch('/api/quiz/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: aiQuestionData.question,
          options: aiQuestionData.options,
          userQuestion: trimmedQuestion,
          questionImage: aiQuestionData.questionImage,
          optionImages: aiQuestionData.optionImages,
          chatHistory: [...currentHistory, userMessage] // Include the new user message
        })
      });
      
      const data = await resp.json();
      
      if (data.success) {
        // Add assistant response to chat history
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.data.explanation,
          timestamp: data.data.timestamp
        };
        addMessageToHistory(currentQuestionIndex, assistantMessage);
        
        // Clear input
        setUserQuestion('');
      } else {
        setAIError(data.error || 'Failed to get AI explanation');
      }
    } catch (err) {
      setAIError('Failed to connect to AI service. Please try again.');
    } finally {
      setLoadingAI(false);
    }
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

  // Scroll to bottom of chat
  const scrollToBottom = (delay: number = 100) => {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-history-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, delay);
  };

  const clearChatHistory = (questionIndex: number) => {
    setChatHistories(prev => ({
      ...prev,
      [questionIndex]: []
    }));
  };

  // Get chat statistics
  const getChatStats = () => {
    const totalTurns = Object.values(chatHistories).reduce((sum, history) => 
      sum + Math.floor(history.length / 2), 0
    );
    const questionsWithChat = Object.keys(chatHistories).filter(key => 
      chatHistories[parseInt(key)].length > 0
    ).length;
    
    return { totalTurns, questionsWithChat };
  };

  // Calculate statistics
  const correctCount = result?.quiz.questions.filter(q => q.isCorrect).length || 0;
  const incorrectCount = result?.quiz.questions.filter(q => {
    const isAnswered = q.type === 'single' 
      ? q.userAnswer !== -1 
      : Array.isArray(q.userAnswer) && q.userAnswer.length > 0;
    return !q.isCorrect && isAnswered;
  }).length || 0;
  const unansweredCount = result?.quiz.questions.filter(q => {
    const isAnswered = q.type === 'single' 
      ? q.userAnswer !== -1 
      : Array.isArray(q.userAnswer) && q.userAnswer.length > 0;
    return !isAnswered;
  }).length || 0;
  const totalQuestions = result?.quiz.questions.length || 0;

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

  const OptionImage = ({ src, alt }: { src: string; alt: string }) => (
    <img 
      src={src} 
      alt={alt} 
      className="max-w-full h-auto rounded border"
      style={{ maxHeight: '200px' }}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Quiz Complete!</h1>
            <p className="mt-2 text-gray-600">{result.quiz.title}</p>
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
                  <div className="font-semibold text-lg text-gray-900">{correctCount}</div>
                  <div>Correct</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{incorrectCount}</div>
                  <div>Incorrect</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{unansweredCount}</div>
                  <div>Unanswered</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg text-gray-900">{totalQuestions}</div>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                <div className="text-sm text-green-700">Correct Answers</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
                <div className="text-sm text-red-700">Incorrect Answers</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{unansweredCount}</div>
                <div className="text-sm text-gray-700">Unanswered</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{result.score}%</div>
                <div className="text-sm text-blue-700">Overall Score</div>
              </div>
            </div>
            
            {/* Chat Statistics */}
            {Object.keys(chatHistories).length > 0 && (() => {
              const { totalTurns, questionsWithChat } = getChatStats();
              return totalTurns > 0 ? (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">💬 Chat with Rin-chan Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-xl font-bold text-purple-600">{totalTurns}</div>
                      <div className="text-sm text-purple-700">Total Chat Turns</div>
                    </div>
                    <div className="text-center p-3 bg-indigo-50 rounded-lg">
                      <div className="text-xl font-bold text-indigo-600">{questionsWithChat}</div>
                      <div className="text-sm text-indigo-700">Questions Discussed</div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </CardContent>
        </Card>

        {/* Detailed Results */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Detailed Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {result.quiz.questions.map((questionResult, index) => {
                // Calculate if answered based on user answer
                const isAnswered = questionResult.type === 'single' 
                  ? questionResult.userAnswer !== -1 
                  : Array.isArray(questionResult.userAnswer) && questionResult.userAnswer.length > 0;
                
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
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900 flex-1">
                        {index + 1}. {questionResult.question}
                      </h3>
                      <Button 
                        variant="outline" 
                        onClick={() => openAIModal(questionResult, index)} 
                        className="text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                      >
                        Ask Rin-chan
                        {chatHistories[index] && chatHistories[index].length > 0 && (
                          <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                            {Math.floor(chatHistories[index].length / 2)}
                          </span>
                        )}
                      </Button>
                    </div>
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

                  {questionResult.questionImage && (
                    <div className="mb-4">
                      <OptionImage src={questionResult.questionImage} alt="Question image" />
                    </div>
                  )}

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
                          {formatCorrectAnswer(questionResult)}
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
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <Link href={`/quiz/${params.slug}`}>
            <Button variant="outline">Take Again</Button>
          </Link>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </main>

      {/* AI Chat Modal */}
      {showAIModal && (
        <Modal 
          isOpen={showAIModal} 
          onClose={closeAIModal}
          title="Chat with Rin-chan About This Question"
          size="wide"
        >
          <div className="space-y-4">
            {/* Question Context */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-2">{aiQuestionData?.question}</h4>
              <div className="text-sm text-gray-600">
                {aiQuestionData?.options?.map((opt: string, idx: number) => (
                  <div key={idx} className="mb-1">
                    {String.fromCharCode(65 + idx)}. {opt}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat History */}
            {chatHistories[currentQuestionIndex] && chatHistories[currentQuestionIndex].length > 0 && (
              <div className="border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto chat-history-container">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900">
                    Chat History 
                   
                  </h4>
                  <Button
                    onClick={() => clearChatHistory(currentQuestionIndex)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Clear Chat
                  </Button>
                </div>
                <div className="space-y-3">
                  {chatHistories[currentQuestionIndex].map((message, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-50 border-l-4 border-blue-400'
                          : 'bg-purple-50 border-l-4 border-purple-400'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {message.role === 'user' ? 'You' : '🎓 Rin-chan'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        {message.role === 'assistant' ? (
                          <MarkdownRenderer content={message.content} />
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Loading indicator when AI is thinking */}
                  {loadingAI && (
                    <div className="p-3 rounded-lg bg-purple-50 border-l-4 border-purple-400">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">🎓 Rin-chan</span>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Thinking...</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* New Message Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ask Rin-chan something about this question:
              </label>
              <textarea
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="Ask about concepts, explanations, or how to approach this type of question..."
                disabled={loadingAI}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>💡 Tip: Be specific about what you want to understand!</span>
                <span>Press Ctrl+Enter to send</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex">
              <Button
                onClick={askAI}
                disabled={loadingAI || !userQuestion.trim()}
                className="w-full"
              >
                {loadingAI ? 'Rin-chan is thinking...' : 'Ask Rin-chan'}
              </Button>
            </div>
            
            {/* Error Display */}
            {aiError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {aiError}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
} 