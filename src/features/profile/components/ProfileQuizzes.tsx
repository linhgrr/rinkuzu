'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuizPreviewModal } from '@/features/quiz/components/QuizPreviewModal';
import Pagination from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { IQuiz, PaginationMeta } from '@/types';
import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import {
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineLockClosed,
  HiOutlinePlay,
} from '@/components/icons';

export default function ProfileQuizzes() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const [quizzes, setQuizzes] = useState<IQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('all');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<IQuiz | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<IQuiz | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    currentPage: 1,
    itemsPerPage: 12,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const ITEMS_PER_PAGE = 12;

  const fetchMyQuizzes = useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          mine: 'true',
        });

        if (filter !== 'all') {
          params.append('status', filter);
        }

        const data = await fetchApiData<{ quizzes: IQuiz[]; pagination: PaginationMeta }>(
          `/api/quizzes?${params}`,
        );
        setQuizzes(data.quizzes);
        setPagination(data.pagination);
        setError('');
      } catch (error: any) {
        setError(error.message || 'Failed to fetch quizzes');
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    fetchMyQuizzes();
  }, [fetchMyQuizzes]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, currentPage: newPage }));
    fetchMyQuizzes(newPage);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <HiOutlineClock className="w-5 h-5 text-yellow-500" />;
      case 'published':
        return <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <HiOutlineXCircle className="w-5 h-5 text-red-500" />;
      default:
        return <HiOutlineDocumentText className="w-5 h-5 text-neutral-500" />;
    }
  };

  const _getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return t('quizWaitingReview');
      case 'published':
        return t('quizLive');
      case 'rejected':
        return t('quizRejected');
      default:
        return '';
    }
  };

  const openPreviewModal = (quiz: IQuiz) => {
    setPreviewQuiz(quiz);
    setShowPreviewModal(true);
  };

  const openDeleteConfirm = (quiz: IQuiz) => {
    setQuizToDelete(quiz);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      setDeletingQuizId(quizId);

      const data = await fetchApiResponse<null, { message?: string }>(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
      });
      setQuizzes((prev) => prev.filter((q) => q._id !== quizId));
      setError('');
      toast.success(data.message || 'Quiz deleted successfully');
    } catch (error: any) {
      setError(error.message || 'An error occurred while deleting the quiz');
    } finally {
      setDeletingQuizId(null);
      setQuizToDelete(null);
    }
  };

  if (loading && quizzes.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
          <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">{t('myQuizzes')}</h2>

        <div className="flex items-center space-x-4 w-full sm:w-auto">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as any);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand-trust focus:outline-none focus:ring-2 focus:ring-brand-trust flex-1 sm:flex-none"
          >
            <option value="all">{t('allStatus')}</option>
            <option value="pending">{t('pending')}</option>
            <option value="published">{t('published')}</option>
            <option value="rejected">{t('rejected')}</option>
          </select>
          <Link href="/create">
            <Button>{t('newQuiz')}</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-neutral-900">{pagination.totalItems}</div>
            <div className="text-xs text-neutral-600">{tCommon('total')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {quizzes.filter((q) => q.status === 'pending').length}
            </div>
            <div className="text-xs text-neutral-600">{t('pending')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {quizzes.filter((q) => q.status === 'published').length}
            </div>
            <div className="text-xs text-neutral-600">{t('published')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {quizzes.filter((q) => q.status === 'rejected').length}
            </div>
            <div className="text-xs text-neutral-600">{t('rejected')}</div>
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
              <EmptyState
                icon={<HiOutlineDocumentText className="w-12 h-12 text-neutral-400" />}
                title={t('noQuizzes')}
                description={t('createFirst')}
                action={
                  <Link href="/create">
                    <Button>{t('createFirst')}</Button>
                  </Link>
                }
              />
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
                        <span className="flex items-center text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full shrink-0">
                          <HiOutlineLockClosed className="w-3 h-3 mr-1" /> {t('private')}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusColor(quiz.status)}`}
                      >
                        {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
                      </span>
                    </div>
                    <CardDescription className="mt-1 text-sm line-clamp-2">
                      {quiz.description || t('noDescription')}
                    </CardDescription>
                    <div className="mt-2 flex items-center space-x-2 text-xs text-neutral-500 flex-wrap">
                      <span>{quiz.questions.length} Qs</span>
                      <span>•</span>
                      <span style={{ color: (quiz.category as any)?.color }}>
                        {(quiz.category as any)?.name || t('noCategory')}
                      </span>
                      <span>•</span>
                      <span>{formatDate(new Date(quiz.createdAt))}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Link href={`/quiz/${quiz.slug}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-brand-action hover:text-brand-action-hover border-orange-200 hover:border-orange-300"
                      >
                        <HiOutlinePlay className="w-4 h-4" />
                      </Button>
                    </Link>

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
              currentPage={pagination.currentPage}
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

      <ConfirmModal
        isOpen={!!quizToDelete}
        title={t('deleteQuiz')}
        message={quizToDelete ? t('deleteQuizConfirm', { title: quizToDelete.title }) : ''}
        confirmText={tCommon('delete')}
        confirmVariant="destructive"
        isLoading={!!quizToDelete && deletingQuizId === quizToDelete._id}
        onCancel={() => setQuizToDelete(null)}
        onConfirm={() => quizToDelete && handleDeleteQuiz(quizToDelete._id)}
      />
    </div>
  );
}
