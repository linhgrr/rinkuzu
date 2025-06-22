'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import Pagination from '@/components/ui/Pagination';
import Sidebar from '@/components/Sidebar';

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

// Chat message interface
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Chat history state for each bookmark
interface ChatHistoryState {
  [bookmarkId: string]: ChatMessage[];
}

export default function BookmarksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const itemsPerPage = 10;

  // AI Chat states
  const [showAIModal, setShowAIModal] = useState(false);
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
  const [userQuestion, setUserQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAIError] = useState('');
  
  // Multi-turn chat state
  const [chatHistories, setChatHistories] = useState<ChatHistoryState>({});

  // Load chat histories from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedChats = localStorage.getItem('bookmark-chat-histories');
      if (savedChats) {
        try {
          setChatHistories(JSON.parse(savedChats));
        } catch (error) {
          console.error('Failed to load chat histories:', error);
        }
      }
    }
  }, []);

  // Save chat histories to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(chatHistories).length > 0) {
      localStorage.setItem('bookmark-chat-histories', JSON.stringify(chatHistories));
    }
  }, [chatHistories]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    
    if (session?.user) {
      fetchBookmarks();
    }
  }, [session, status, router, currentPage]);

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      
      const response = await fetch(`/api/bookmarks?${params}`);
      const data = await response.json();

      if (data.success) {
        setBookmarks(data.data);
        setPagination(data.pagination);
      } else {
        setError(data.error || 'Failed to fetch bookmarks');
      }
    } catch (error) {
      setError('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const removeBookmark = async (bookmarkId: string) => {
    try {
      const response = await fetch(`/api/bookmarks/${bookmarkId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBookmarks(prev => prev.filter(b => b._id !== bookmarkId));
        // Also remove chat history for this bookmark
        setChatHistories(prev => {
          const newHistories = { ...prev };
          delete newHistories[bookmarkId];
          return newHistories;
        });
      } else {
        setError(data.error || 'Failed to remove bookmark');
      }
    } catch (error) {
      setError('Failed to remove bookmark');
    }
  };

  const formatCorrectAnswer = (question: Bookmark['question']) => {
    if (question.type === 'single') {
      return question.options[question.correctIndex!];
    } else {
      return question.correctIndexes!.map(idx => question.options[idx]).join(', ');
    }
  };

  const openAIModal = (bookmark: Bookmark) => {
    setCurrentBookmark(bookmark);
    setUserQuestion('');
    setAIError('');
    setShowAIModal(true);
    
    // Initialize chat history for this bookmark if it doesn't exist
    if (!chatHistories[bookmark._id]) {
      setChatHistories(prev => ({
        ...prev,
        [bookmark._id]: []
      }));
    }
    
    // Auto-scroll to bottom when modal opens
    scrollToBottom(300);
  };

  const closeAIModal = () => {
    setShowAIModal(false);
    setCurrentBookmark(null);
    setUserQuestion('');
    setAIError('');
  };

  const addMessageToHistory = (bookmarkId: string, message: ChatMessage) => {
    setChatHistories(prev => ({
      ...prev,
      [bookmarkId]: [...(prev[bookmarkId] || []), message]
    }));
    
    // Auto-scroll to bottom when new message is added
    scrollToBottom();
  };

  const askAI = async () => {
    if (!currentBookmark) return;
    
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
      addMessageToHistory(currentBookmark._id, userMessage);

      // Get current chat history for this bookmark
      const currentHistory = chatHistories[currentBookmark._id] || [];
      
      const resp = await fetch('/api/quiz/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentBookmark.question.text,
          options: currentBookmark.question.options,
          userQuestion: trimmedQuestion,
          questionImage: currentBookmark.question.questionImage,
          optionImages: currentBookmark.question.optionImages,
          chatHistory: [...currentHistory, userMessage]
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
        addMessageToHistory(currentBookmark._id, assistantMessage);
        
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

  const clearChatHistory = (bookmarkId: string) => {
    setChatHistories(prev => ({
      ...prev,
      [bookmarkId]: []
    }));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setError('');
  };

  const OptionImage = ({ src, alt }: { src: string; alt: string }) => (
    <img 
      src={src} 
      alt={alt} 
      className="max-w-full h-auto rounded border"
      style={{ maxHeight: '200px' }}
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">R</span>
                  </div>
                  <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>
        
        <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          currentPath={pathname}
        />
        
        <div className={`py-8 transition-all duration-300 ${
          session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
        } max-w-none px-4 sm:px-6 lg:px-8`}>
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading bookmarks...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {session ? (
                <>
                  <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                    All Quizzes
                  </Link>
                  
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                        <button 
                          onClick={() => signOut()}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="space-y-2">
                {session ? (
                  <>
                    <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      All Quizzes
                    </Link>
                    <button 
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Sign In
                    </Link>
                    <Link href="/register" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />
      
      {/* Main Content */}
      <main className={`py-8 transition-all duration-300 ${
        session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
      } max-w-none px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bookmarked Questions</h1>
              <p className="text-gray-600 mt-2">
                Questions you've saved for later review
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {pagination?.totalItems || 0} bookmarks
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center text-red-700">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {bookmarks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks yet</h3>
              <p className="text-gray-600 mb-6">
                Start bookmarking questions during quizzes to build your personal study collection
              </p>
              <Link href="/">
                <Button>Browse Quizzes</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bookmarks List */}
            <div className="space-y-6">
              {bookmarks.map((bookmark) => (
                <Card key={bookmark._id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {bookmark.question.text}
                        </CardTitle>
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="text-sm text-gray-600">
                            From: <Link href={`/quiz/${bookmark.quiz.slug}`} className="text-blue-600 hover:underline font-medium">
                              {bookmark.quiz.title}
                            </Link>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            bookmark.question.type === 'single' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {bookmark.question.type === 'single' ? 'Single Choice' : 'Multiple Choice'}
                          </span>
                          <div className="text-xs text-gray-500">
                            Saved {new Date(bookmark.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          onClick={() => openAIModal(bookmark)}
                          className="text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                        >
                          Ask Rin-chan
                          {chatHistories[bookmark._id] && chatHistories[bookmark._id].length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                              {Math.floor(chatHistories[bookmark._id].length / 2)}
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => removeBookmark(bookmark._id)}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    
                    {bookmark.question.questionImage && (
                      <div className="mt-4">
                        <OptionImage src={bookmark.question.questionImage} alt="Question image" />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">Correct answer: </span>
                        <span className="text-green-600">
                          {formatCorrectAnswer(bookmark.question)}
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="text-sm text-gray-600 font-medium mb-2">All options:</p>
                        <div className="grid grid-cols-1 gap-1">
                          {bookmark.question.options.map((option, optIdx) => {
                            const isCorrectAnswer = bookmark.question.type === 'single'
                              ? bookmark.question.correctIndex === optIdx
                              : bookmark.question.correctIndexes?.includes(optIdx);

                            const optionText = String.fromCharCode(65 + optIdx) + '. ' + option;

                            return (
                              <div
                                key={optIdx}
                                className={`text-sm p-2 rounded border ${
                                  isCorrectAnswer 
                                    ? 'bg-green-100 border-green-300 text-green-800' 
                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="text-gray-900">{optionText}</span>

                                  {bookmark.question.optionImages?.[optIdx] && (
                                    <div className="mt-2">
                                      <OptionImage
                                        src={bookmark.question.optionImages[optIdx]!}
                                        alt={`Option ${String.fromCharCode(65 + optIdx)} image`}
                                      />
                                    </div>
                                  )}
                                </div>

                                {isCorrectAnswer && <span className="ml-2 text-green-600">✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
        </div>
      </main>

      {/* AI Chat Modal */}
      {showAIModal && currentBookmark && (
        <Modal 
          isOpen={showAIModal} 
          onClose={closeAIModal}
          title="Chat with Rin-chan About This Question"
          size="wide"
        >
          <div className="space-y-4">
            {/* Question Context */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-2">{currentBookmark.question.text}</h4>
              <div className="text-sm text-gray-600">
                {currentBookmark.question.options.map((opt: string, idx: number) => (
                  <div key={idx} className="mb-1">
                    {String.fromCharCode(65 + idx)}. {opt}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat History */}
            {chatHistories[currentBookmark._id] && chatHistories[currentBookmark._id].length > 0 && (
              <div className="border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto chat-history-container">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900">
                    Chat History
                  </h4>
                  <Button
                    onClick={() => clearChatHistory(currentBookmark._id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Clear Chat
                  </Button>
                </div>
                <div className="space-y-3">
                  {chatHistories[currentBookmark._id].map((message, idx) => (
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