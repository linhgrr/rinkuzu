'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import { formatDate } from '@/lib/utils';
import { IQuiz } from '@/types';

export default function AdminQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();
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

  // Redirect if not admin
  if (session && (session.user as any)?.role !== 'admin') {
    router.push('/');
    return null;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  useEffect(() => {
    fetchQuizzes();
  }, [filter]);

  const fetchQuizzes = async () => {
    try {
      const url = filter === 'pending' ? '/api/quizzes?status=pending' : '/api/quizzes';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setQuizzes(data.data.quizzes);
      } else {
        setError(data.error || 'Failed to fetch quizzes');
      }
    } catch (error) {
      setError('Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                RinKuzu
              </Link>
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                Admin
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline">Manage Users</Button>
              </Link>
              <Link href="/create">
                <Button variant="outline">Create Quiz</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              onChange={(e) => setFilter(e.target.value as 'pending' | 'all')}
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
                  {pendingQuizzes.length}
                </div>
                <div className="text-sm text-gray-600">Pending Review</div>
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
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {quizzes.length}
                </div>
                <div className="text-sm text-gray-600">Total</div>
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
                      <CardTitle className="text-xl">{quiz.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {quiz.description || 'No description provided'}
                      </CardDescription>
                      <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                        <span>By: {(quiz.author as any)?.email || 'Unknown'}</span>
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
        </div>
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