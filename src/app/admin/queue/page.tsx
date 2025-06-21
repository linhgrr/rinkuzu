'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import Pagination from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { IQuiz } from '@/types';
import Sidebar from '@/components/Sidebar';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [quizzes, setQuizzes] = useState<IQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<IQuiz | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<IQuiz | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; quiz: IQuiz | null }>({
    show: false,
    quiz: null
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    if ((session.user as any)?.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchQuizzes();
  }, [session, status, router, filter]);

  const fetchQuizzes = async (page: number = 1) => {
    if (!session) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      if (filter === 'pending') {
        params.append('status', 'pending');
      }

      const response = await fetch(`/api/quizzes?${params}`);
      const data = await response.json();

      if (data.success) {
        setQuizzes(data.data.quizzes);
        setPagination(data.data.pagination);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch quizzes');
      }
    } catch (error) {
      setError('Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchQuizzes(newPage);
  };

  const approveQuiz = async (quizId: string) => {
    setActionLoading(quizId);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setQuizzes(quizzes.map(quiz => 
          quiz._id === quizId ? { ...quiz, status: 'published' as any } : quiz
        ));
      } else {
        setError(data.error || 'Failed to approve quiz');
      }
    } catch (error) {
      setError('Failed to approve quiz');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectQuiz = async () => {
    if (!selectedQuiz) return;

    setActionLoading(selectedQuiz._id);
    try {
      const response = await fetch(`/api/quizzes/${selectedQuiz._id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectReason.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQuizzes(quizzes.map(quiz => 
          quiz._id === selectedQuiz._id ? { ...quiz, status: 'rejected' as any } : quiz
        ));
        setShowRejectModal(false);
        setSelectedQuiz(null);
        setRejectReason('');
      } else {
        setError(data.error || 'Failed to reject quiz');
      }
    } catch (error) {
      setError('Failed to reject quiz');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (quiz: IQuiz) => {
    setSelectedQuiz(quiz);
    setShowRejectModal(true);
    setRejectReason('');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingQuizzes = quizzes.filter(quiz => quiz.status === 'pending');

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - giống như trang chính */}
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
              <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                Admin
              </span>
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
        ) : (session.user as any)?.role !== 'admin' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Access denied. Admin privileges required.</div>
          </div>
        ) : (
        <>
        <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Queue</h1>
            <p className="mt-2 text-gray-600">
              Review and manage quiz submissions
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as 'pending' | 'all');
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending Only</option>
              <option value="all">All Quizzes</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {quizzes.filter(q => q.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-600">Pending Review (Current Page)</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {quizzes.filter(q => q.status === 'published').length}
                </div>
                <div className="text-sm text-gray-600">Published (Current Page)</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {quizzes.filter(q => q.status === 'rejected').length}
                </div>
                <div className="text-sm text-gray-600">Rejected (Current Page)</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {pagination.total}
                </div>
                <div className="text-sm text-gray-600">Total All</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Showing {quizzes.length} of {pagination.total} quizzes
            {filter === 'pending' && (
              <span className="ml-2 text-yellow-600 font-medium">
                (Pending only)
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Quiz List */}
        <div className="space-y-6">
          {quizzes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No quizzes found
                </h3>
                <p className="text-gray-600">
                  {filter === 'pending' 
                    ? 'There are no quizzes waiting for review.' 
                    : 'No quizzes have been created yet.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            quizzes.map((quiz) => (
              <Card key={quiz._id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <CardTitle className="text-xl">{quiz.title}</CardTitle>
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
                        <span>By: {(quiz.author as any)?.email || 'Unknown'}</span>
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
                        <span>{quiz.questions.length} questions</span>
                        <span>•</span>
                        <span>Created: {formatDate(new Date(quiz.createdAt))}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(quiz.status)}`}>
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
                      <Link 
                        href={`/quiz/${quiz.slug}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center"
                      >
                        Test Quiz →
                      </Link>
                      <Link href={`/edit/${quiz._id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400"
                        >
                          ✏️ Edit Quiz
                        </Button>
                      </Link>
                    </div>
                    
                    <div className="flex space-x-3">
                      {quiz.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectModal(quiz)}
                            disabled={actionLoading === quiz._id}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveQuiz(quiz._id)}
                            loading={actionLoading === quiz._id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Approve
                          </Button>
                        </>
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
                className="justify-center"
              />
            </div>
          )}
        </div>
        </div>
        </>
        )}
      </main>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedQuiz(null);
          setRejectReason('');
        }}
        title="Reject Quiz"
        description="Please provide a reason for rejecting this quiz"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason
            </label>
            <textarea
              id="reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this quiz is being rejected..."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedQuiz(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={rejectQuiz}
              loading={actionLoading === selectedQuiz?._id}
              disabled={!rejectReason.trim()}
            >
              Reject Quiz
            </Button>
          </div>
                  </div>
        </Modal>

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
                Admin: Delete Quiz
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                Are you sure you want to permanently delete this quiz?
              </p>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">
                "{deleteConfirmModal.quiz.title}"
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Author: {(deleteConfirmModal.quiz.author as any)?.email || 'Unknown'}
              </p>
              <p className="text-xs text-red-600 mt-3">
                ⚠️ This will permanently delete the quiz and all associated attempts. This action cannot be undone.
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
  );
} 