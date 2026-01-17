'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { QuizPreviewModal } from '@/components/ui/QuizPreviewModal';
import Pagination from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { IQuiz } from '@/types';
import { useSession } from 'next-auth/react';
import {
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineDocumentText,
    HiOutlineEye,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineLockClosed
} from '@/components/icons';

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function ProfileQuizzes() {
    const { data: session } = useSession();
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
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0
    });

    useEffect(() => {
        if (session) {
            fetchMyQuizzes();
        }
    }, [session, filter]);

    const fetchMyQuizzes = async (page: number = 1) => {
        if (!session) return;

        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
                mine: 'true'
            });

            if (filter !== 'all') {
                params.append('status', filter);
            }

            const response = await fetch(`/api/quizzes?${params}`);
            const data = await response.json();

            if (data.success) {
                // The API might return all quizzes, we filter just in case or trust API 'mine=true'
                const userQuizzes = data.data.quizzes; // Assuming API handles 'mine' correctly
                setQuizzes(userQuizzes);
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
        fetchMyQuizzes(newPage);
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
            case 'pending': return <HiOutlineClock className="w-5 h-5 text-yellow-500" />;
            case 'published': return <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />;
            case 'rejected': return <HiOutlineXCircle className="w-5 h-5 text-red-500" />;
            default: return <HiOutlineDocumentText className="w-5 h-5 text-gray-500" />;
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
                setQuizzes(prev => prev.filter(q => q._id !== quizId));
                setError('');
                toast.success(data.message || 'Quiz deleted successfully');
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

    if (loading && quizzes.length === 0) {
        return (
            <div className="flex justify-center py-12">
                <div className="text-gray-500">Loading your quizzes...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">My Quizzes</h2>
                    <p className="mt-1 text-gray-600">
                        Manage and track your quiz submissions
                    </p>
                </div>

                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <select
                        value={filter}
                        onChange={(e) => {
                            setFilter(e.target.value as any);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none"
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
                        <div className="text-xs text-gray-600">Total</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                            {quizzes.filter(q => q.status === 'pending').length}
                        </div>
                        <div className="text-xs text-gray-600">Pending</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                            {quizzes.filter(q => q.status === 'published').length}
                        </div>
                        <div className="text-xs text-gray-600">Published</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                            {quizzes.filter(q => q.status === 'rejected').length}
                        </div>
                        <div className="text-xs text-gray-600">Rejected</div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                </div>
            )}

            {/* Quiz List */}
            <div className="space-y-4">
                {quizzes.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-12">
                            <div className="flex justify-center mb-4">
                                <HiOutlineDocumentText className="w-12 h-12 text-gray-400" />
                            </div>
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
                    quizzes.map((quiz) => (
                        <Card key={quiz._id}>
                            <CardHeader className="p-4 sm:p-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                                            <CardTitle className="text-lg truncate">{quiz.title}</CardTitle>
                                            <span className="text-xl shrink-0">{getStatusIcon(quiz.status)}</span>
                                            {quiz.isPrivate && (
                                                <span className="flex items-center text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                                                    <HiOutlineLockClosed className="w-3 h-3 mr-1" /> Private
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(quiz.status)}`}>
                                                {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
                                            </span>
                                        </div>
                                        <CardDescription className="mt-1 text-sm line-clamp-2">
                                            {quiz.description || 'No description provided'}
                                        </CardDescription>
                                        <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500 flex-wrap">
                                            <span>{quiz.questions.length} Qs</span>
                                            <span>•</span>
                                            <span style={{ color: (quiz.category as any)?.color }}>
                                                {(quiz.category as any)?.name || 'No Category'}
                                            </span>
                                            <span>•</span>
                                            <span>{formatDate(new Date(quiz.createdAt))}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openPreviewModal(quiz)}
                                            className="hidden sm:inline-flex"
                                        >
                                            <HiOutlineEye className="w-4 h-4" />
                                        </Button>

                                        <Link href={`/edit/${quiz._id}`}>
                                            <Button size="sm" variant="outline">
                                                <HiOutlinePencil className="w-4 h-4" />
                                            </Button>
                                        </Link>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openDeleteConfirm(quiz)}
                                            className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                )}

                {pagination.totalPages > 1 && (
                    <div className="mt-8 flex justify-center">
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>

            {/* Preview and Delete Modals */}
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

            {deleteConfirmModal.show && deleteConfirmModal.quiz && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold mb-2">Delete Quiz?</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to delete "{deleteConfirmModal.quiz.title}"? This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={closeDeleteConfirm}>Cancel</Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleDeleteQuiz(deleteConfirmModal.quiz!._id)}
                                disabled={deletingQuizId === deleteConfirmModal.quiz._id}
                            >
                                {deletingQuizId ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
