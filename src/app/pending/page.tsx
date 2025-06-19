'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import { formatDate } from '@/lib/utils';
import { IQuiz } from '@/types';
import Sidebar from '@/components/Sidebar';

export default function PendingQuizzesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [quizzes, setQuizzes] = useState<IQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('all');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<IQuiz | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; quiz: IQuiz | null }>({
    show: false,
    quiz: null
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (session) {
      fetchMyQuizzes();
    } else {
      router.push('/login');
    }
  }, [session, status, router, filter]);

  const fetchMyQuizzes = async () => {
    if (!session) return;
    
    try {
      let url = '/api/quizzes';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        // Filter to only show user's own quizzes (server should handle this but double-check)
        const userQuizzes = data.data.quizzes.filter((quiz: IQuiz) => 
          typeof quiz.author === 'string' 
            ? quiz.author === (session.user as any).id
            : (quiz.author as any)?._id === (session.user as any).id
        );
        setQuizzes(userQuizzes);
      } else {
        setError(data.error || 'Failed to fetch quizzes');
      }
    } catch (error) {
      setError('Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'published': return '✅';
      case 'rejected': return '❌';
      default: return '📝';
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending': return 'Your quiz is waiting for admin review';
      case 'published': return 'Your quiz is live and can be accessed by students';
      case 'rejected': return 'Your quiz was rejected. Check the feedback and resubmit if needed';
      default: return '';
    }
  };

  const openPreviewModal = (quiz: IQuiz) => {
    setPreviewQuiz(quiz);
    setShowPreviewModal(true);
  };

  const openDeleteConfirm = (quiz: IQuiz) => {
    setDeleteConfirmModal({ show: true, quiz });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmModal({ show: false, quiz: null });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      setDeletingQuizId(quizId);

      const response = await fetch(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        // Remove quiz from local state
        setQuizzes(prev => prev.filter(q => q._id !== quizId));
        setError('');
        
        // Show success message (you could add a toast notification here)
        alert(data.message || 'Quiz deleted successfully');
      } else {
        setError(data.error || 'Failed to delete quiz');
      }
    } catch (error) {
      setError('An error occurred while deleting the quiz');
    } finally {
      setDeletingQuizId(null);
      closeDeleteConfirm();
    }
  };

  const filteredQuizzes = quizzes.filter(quiz => filter === 'all' || quiz.status === filter);

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
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : !session ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Redirecting to login...</div>
          </div>
        ) : (
        <>
        <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Quizzes</h1>
            <p className="mt-2 text-gray-600">
              Manage and track your quiz submissions
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
            <Link href="/create">
              <Button>+ New Quiz</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {quizzes.length}
                </div>
                <div className="text-sm text-gray-600">Total Quizzes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {quizzes.filter(q => q.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {quizzes.filter(q => q.status === 'published').length}
                </div>
                <div className="text-sm text-gray-600">Published</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {quizzes.filter(q => q.status === 'rejected').length}
                </div>
                <div className="text-sm text-gray-600">Rejected</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Quiz List */}
        <div className="space-y-6">
          {filteredQuizzes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {filter === 'all' ? 'No quizzes created yet' : `No ${filter} quizzes`}
                </h3>
                <p className="text-gray-600 mb-6">
                  {filter === 'all' 
                    ? 'Get started by creating your first quiz from a PDF document.' 
                    : `You don't have any ${filter} quizzes at the moment.`
                  }
                </p>
                <Link href="/create">
                  <Button>Create Your First Quiz</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            filteredQuizzes.map((quiz) => (
              <Card key={quiz._id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <CardTitle className="text-xl">{quiz.title}</CardTitle>
                        <span className="text-2xl">{getStatusIcon(quiz.status)}</span>
                        {quiz.isPrivate && (
                          <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center">
                            🔒 Private
                          </span>
                        )}
                      </div>
                      <CardDescription className="mt-2">
                        {quiz.description || 'No description provided'}
                      </CardDescription>
                      <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                        <span>{quiz.questions.length} questions</span>
                        <span>•</span>
                        <span 
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full"
                          style={{ 
                            backgroundColor: (quiz.category as any)?.color + '20', 
                            color: (quiz.category as any)?.color 
                          }}
                        >
                          {(quiz.category as any)?.name || 'No Category'}
                        </span>
                        <span>•</span>
                        <span>Created: {formatDate(new Date(quiz.createdAt))}</span>
                        {quiz.status === 'published' && (
                          <>
                            <span>•</span>
                            <span>Slug: {quiz.slug}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          {getStatusMessage(quiz.status)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(quiz.status)}`}>
                      {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPreviewModal(quiz)}
                      >
                        👁️ Preview with Answers
                      </Button>
                      
                      {quiz.status === 'published' && (
                        <>
                          <Link 
                            href={`/quiz/${quiz.slug}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                          >
                            Test Quiz →
                          </Link>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/quiz/${quiz.slug}`;
                              navigator.clipboard.writeText(url);
                              alert('Quiz link copied to clipboard!');
                            }}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            📋 Copy Link
                          </button>
                        </>
                      )}
                      {quiz.status === 'pending' && (
                        <span className="text-yellow-600 text-sm">
                          ⏳ Waiting for admin approval
                        </span>
                      )}
                      {quiz.status === 'rejected' && (
                        <span className="text-red-600 text-sm">
                          ❌ Rejected - see feedback in description
                        </span>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                        <Link href={`/edit/${quiz._id}`}>
                          <Button size="sm" variant="outline">
                            ✏️ Edit
                          </Button>
                        </Link>
                      {quiz.status === 'rejected' && (
                        <Link href="/create">
                          <Button size="sm" variant="outline">
                            Create New Quiz
                          </Button>
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDeleteConfirm(quiz)}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                        disabled={deletingQuizId === quiz._id}
                      >
                        {deletingQuizId === quiz._id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent mr-2"></div>
                            Deleting...
                          </>
                        ) : (
                          <>🗑️ Delete</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Tips */}
        {quizzes.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">💡 Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• <strong>Pending:</strong> Your quiz is in the admin review queue. This usually takes 1-2 business days.</li>
                <li>• <strong>Published:</strong> Your quiz is live! Share the link with your students.</li>
                <li>• <strong>Rejected:</strong> Check the feedback and create a new improved version.</li>
                <li>• <strong>Pro tip:</strong> Use clear, descriptive titles and provide context in descriptions for faster approval.</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Preview Modal */}
        {previewQuiz && (
          <QuizPreviewModal
            isOpen={showPreviewModal}
            onClose={() => {
              setShowPreviewModal(false);
              setPreviewQuiz(null);
            }}
            title={previewQuiz.title}
            questions={previewQuiz.questions}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal.show && deleteConfirmModal.quiz && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  Confirm Delete
                </h3>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  Are you sure you want to delete this quiz?
                </p>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">
                  "{deleteConfirmModal.quiz.title}"
                </p>
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ This action cannot be undone. The quiz and all associated data will be permanently deleted.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={closeDeleteConfirm}
                  disabled={deletingQuizId === deleteConfirmModal.quiz._id}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteQuiz(deleteConfirmModal.quiz!._id)}
                  disabled={deletingQuizId === deleteConfirmModal.quiz._id}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletingQuizId === deleteConfirmModal.quiz._id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Quiz'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
        </>
        )}
      </main>
    </div>
  );
} 