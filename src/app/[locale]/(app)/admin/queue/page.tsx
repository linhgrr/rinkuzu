'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { QuizPreviewModal } from '@/features/quiz/components/QuizPreviewModal';
import Pagination from '@/components/ui/Pagination';
import { fetchApiData } from '@/lib/api/client';
import { formatDate } from '@/lib/utils';
import { IQuiz } from '@/types';
import {
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineLockClosed,
} from '@/components/icons';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import { UserProfileLink } from '@/components/user/UserProfileLink';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminQueuePage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const { data: _session } = useSession();
  const pathname = usePathname();
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
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    show: boolean;
    quiz: IQuiz | null;
  }>({
    show: false,
    quiz: null,
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });

  const fetchQuizzes = useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString(),
        });

        if (filter === 'pending') {
          params.append('status', 'pending');
        }

        const data = await fetchApiData<{ quizzes: IQuiz[]; pagination: PaginationData }>(
          `/api/quizzes?${params}`,
        );
        setQuizzes(data.quizzes);
        setPagination(data.pagination);
        setError('');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch quizzes');
      } finally {
        setLoading(false);
      }
    },
    [filter, pagination.limit],
  );

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchQuizzes(newPage);
  };

  const approveQuiz = async (quizId: string) => {
    setActionLoading(quizId);
    try {
      await fetchApiData(`/api/quizzes/${quizId}/approve`, {
        method: 'POST',
      });
      setQuizzes(
        quizzes.map((quiz) =>
          quiz._id === quizId ? { ...quiz, status: 'published' as any } : quiz,
        ),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to approve quiz');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectQuiz = async () => {
    if (!selectedQuiz) return;

    setActionLoading(selectedQuiz._id);
    try {
      await fetchApiData(`/api/quizzes/${selectedQuiz._id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: rejectReason.trim(),
        }),
      });
      setQuizzes(
        quizzes.map((quiz) =>
          quiz._id === selectedQuiz._id ? { ...quiz, status: 'rejected' as any } : quiz,
        ),
      );
      setShowRejectModal(false);
      setSelectedQuiz(null);
      setRejectReason('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reject quiz');
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

      await fetchApiData<null>(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
      });
      // Remove quiz from local state
      setQuizzes((prev) => prev.filter((q) => q._id !== quizId));
      setError('');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'An error occurred while deleting the quiz',
      );
    } finally {
      setDeletingQuizId(null);
      closeDeleteConfirm();
    }
  };

  const getStatusBadge = (status: string) => {
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    switch (status) {
      case 'pending':
        return <Badge variant="warning">{label}</Badge>;
      case 'published':
        return <Badge variant="success">{label}</Badge>;
      case 'rejected':
        return <Badge variant="danger">{label}</Badge>;
      default:
        return <Badge variant="default">{label}</Badge>;
    }
  };

  const _pendingQuizzes = quizzes.filter((quiz) => quiz.status === 'pending');

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main
        className={`py-8 transition-[margin] duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'} max-w-none px-4 sm:px-6 lg:px-8`}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust" />
              <div className="text-sm text-neutral-500">{tCommon('loading')}</div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-semibold text-neutral-900">{t('adminQueue')}</h1>
                <p className="mt-2 text-neutral-600">{t('reviewManageQuizzes')}</p>
              </div>

              <div className="flex items-center gap-x-4">
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as 'pending' | 'all');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="min-h-[40px] rounded-md border border-neutral-300 px-3 text-sm transition-[border-color,box-shadow] focus-visible:border-brand-trust focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--focus-ring-soft)]"
                >
                  <option value="pending">{t('pendingOnly')}</option>
                  <option value="all">{t('allQuizzes')}</option>
                </select>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {quizzes.filter((q) => q.status === 'pending').length}
                    </div>
                    <div className="text-sm text-neutral-600">{t('pendingReviewCurrentPage')}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {quizzes.filter((q) => q.status === 'published').length}
                    </div>
                    <div className="text-sm text-neutral-600">{t('publishedCurrentPage')}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {quizzes.filter((q) => q.status === 'rejected').length}
                    </div>
                    <div className="text-sm text-neutral-600">{t('rejectedCurrentPage')}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-brand-trust">{pagination.total}</div>
                    <div className="text-sm text-neutral-600">{t('totalAll')}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results Info */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-neutral-600">
                {t('showingQuizzes', { count: quizzes.length, total: pagination.total })}
                {filter === 'pending' && (
                  <span className="ml-2 text-yellow-600 font-medium">{t('pendingOnlyFilter')}</span>
                )}
              </p>
              <p className="text-sm text-neutral-500">
                {t('page')} {pagination.page} {t('of')} {pagination.totalPages}
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
                    <HiOutlineDocumentText className="text-4xl mx-auto mb-4 text-neutral-400" />
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                      {t('noQuizzesFound')}
                    </h3>
                    <p className="text-neutral-600">
                      {filter === 'pending' ? t('noQuizzesWaiting') : t('noQuizzesCreated')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                quizzes.map((quiz) => {
                  const createdAt = new Date(quiz.createdAt);
                  const createdAtIso = createdAt.toISOString();
                  const createdAtLabel = formatDate(createdAt);

                  return (
                    <Card key={quiz._id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-x-3">
                              <CardTitle className="text-xl">{quiz.title}</CardTitle>
                              {quiz.isPrivate && (
                                <span className="inline-flex min-h-[28px] items-center rounded-full bg-neutral-100 px-3 text-[13px] font-medium text-neutral-600">
                                  <HiOutlineLockClosed className="size-3 mr-1" />{' '}
                                  {tProfile('private')}
                                </span>
                              )}
                            </div>
                            <CardDescription className="mt-2">
                              {quiz.description || tProfile('noDescription')}
                            </CardDescription>
                            <div className="mt-3 flex items-center gap-x-4 text-sm text-neutral-600">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0">{t('by')}</span>
                                <UserProfileLink
                                  user={quiz.author as any}
                                  avatarSize={24}
                                  className="max-w-[220px] text-sm text-neutral-600"
                                  nameClassName="text-sm"
                                />
                              </div>
                              <span>•</span>
                              <span
                                className="inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium"
                                style={{
                                  backgroundColor: (quiz.category as any)?.color + '20',
                                  color: (quiz.category as any)?.color,
                                }}
                              >
                                {(quiz.category as any)?.name || tProfile('noCategory')}
                              </span>
                              <span>•</span>
                              <span>
                                {quiz.questions.length} {t('questions')}
                              </span>
                              <span>•</span>
                              <span>
                                {t('createdDate')}{' '}
                                <time dateTime={createdAtIso} suppressHydrationWarning>
                                  {createdAtLabel}
                                </time>
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(quiz.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-x-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPreviewModal(quiz)}
                              className="min-h-[36px] px-3"
                            >
                              <HiOutlineEye className="size-4 mr-1" /> {t('previewWithAnswers')}
                            </Button>
                            <Link
                              href={`/quiz/${quiz.slug}`}
                              className="text-brand-trust hover:text-green-700 text-sm font-medium inline-flex items-center"
                            >
                              {t('testQuiz')}
                            </Link>
                            <Link href={`/edit/${quiz._id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-[36px] px-3 text-brand-trust hover:text-brand-trust border-green-300 hover:border-green-400"
                              >
                                <HiOutlinePencil className="size-4 mr-1" /> {t('editQuiz')}
                              </Button>
                            </Link>
                          </div>

                          <div className="flex gap-x-3">
                            {quiz.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openRejectModal(quiz)}
                                  disabled={actionLoading === quiz._id}
                                  className="min-h-[36px] px-3"
                                >
                                  {t('reject')}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => approveQuiz(quiz._id)}
                                  loading={actionLoading === quiz._id}
                                  className="min-h-[36px] bg-green-600 px-3 hover:bg-green-700"
                                >
                                  {t('approve')}
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDeleteConfirm(quiz)}
                              className="min-h-[36px] px-3 text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                              disabled={deletingQuizId === quiz._id}
                            >
                              {deletingQuizId === quiz._id ? (
                                <>
                                  <div className="animate-spin rounded-full size-4 border-2 border-red-600 border-t-transparent mr-2"></div>
                                  {t('deleting')}
                                </>
                              ) : (
                                <>
                                  <HiOutlineTrash className="size-4 mr-1" /> {t('delete')}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
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
        title={t('rejectQuiz')}
        description={t('rejectQuizDescription')}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-neutral-700 mb-2">
              {t('rejectionReason')}
            </label>
            <Textarea
              id="reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('rejectReasonPlaceholder')}
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedQuiz(null);
                setRejectReason('');
              }}
              className="min-h-[40px] px-4"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={rejectQuiz}
              loading={actionLoading === selectedQuiz?._id}
              disabled={!rejectReason.trim()}
              className="min-h-[40px] px-4"
            >
              {t('rejectQuizButton')}
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
      <ConfirmModal
        isOpen={deleteConfirmModal.show}
        title={t('adminDeleteQuiz')}
        message={
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">{t('deleteQuizConfirm')}</p>
            <p className="text-sm font-medium text-neutral-900 bg-neutral-50 p-2 rounded">
              {`"${deleteConfirmModal.quiz?.title || ''}"`}
            </p>
            <p className="text-sm text-neutral-600">
              {t('author')} {(deleteConfirmModal.quiz?.author as any)?.email || 'Unknown'}
            </p>
            <p className="text-xs text-red-600">{t('deleteQuizWarning')}</p>
          </div>
        }
        confirmText={t('deleteQuizButton')}
        cancelText={t('cancel')}
        confirmVariant="destructive"
        onConfirm={() => deleteConfirmModal.quiz && handleDeleteQuiz(deleteConfirmModal.quiz._id)}
        onCancel={closeDeleteConfirm}
        isLoading={
          !!(
            deletingQuizId &&
            deleteConfirmModal.quiz &&
            deletingQuizId === deleteConfirmModal.quiz._id
          )
        }
      />
    </div>
  );
}
