'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';
import { ROUTES } from '@/shared/constants';
import { fetchApiSuccess } from '@/lib/api/client';
import {
    HiOutlineDocumentText,
    HiOutlineClock,
    HiOutlineEmojiHappy,
    HiOutlineEmojiSad,
    HiOutlineThumbUp,
    HiOutlineStar,
    HiOutlineAcademicCap,
    HiOutlineLightningBolt
} from '@/components/icons';

interface AttemptHistory {
    _id: string;
    score: number;
    takenAt: string;
    quiz: {
        title: string;
        slug: string;
        description?: string;
        totalQuestions: number;
    };
}

interface PaginationInfo {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export default function ProfileHistory() {
    const t = useTranslations('profile');
    const tCommon = useTranslations('common');
    const [attempts, setAttempts] = useState<AttemptHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState<PaginationInfo | null>(null);
    const itemsPerPage = 10;

    const fetchAttempts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
            });

            const data = await fetchApiSuccess<AttemptHistory[], { pagination: PaginationInfo }>(`/api/user/attempts?${params}`);
            setAttempts(data.data);
            setPagination(data.pagination);
            setError('');
        } catch (error: any) {
            setError(error.message || 'Failed to load quiz history');
        } finally {
            setLoading(false);
        }
    }, [currentPage]);

    useEffect(() => {
        fetchAttempts();
    }, [fetchAttempts]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-50';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    const getPerformanceBadge = (score: number) => {
        if (score >= 90) return { text: t('excellent'), icon: <HiOutlineAcademicCap className="w-4 h-4" /> };
        if (score >= 80) return { text: t('great'), icon: <HiOutlineStar className="w-4 h-4" /> };
        if (score >= 70) return { text: t('good'), icon: <HiOutlineThumbUp className="w-4 h-4" /> };
        if (score >= 60) return { text: t('pass'), icon: <HiOutlineEmojiHappy className="w-4 h-4" /> };
        return { text: t('needsWork'), icon: <HiOutlineEmojiSad className="w-4 h-4" /> };
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        setError('');
    };

    if (loading && attempts.length === 0) {
        return (
            <div className="flex justify-center py-12">
                <div className="text-gray-500">{tCommon('loadingHistory')}</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('quizHistory')}</h2>
                <p className="mt-1 text-gray-600">
                    {t('quizHistoryDescription')}
                </p>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                </div>
            )}

            {attempts.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <div className="flex justify-center mb-4">
                            <HiOutlineDocumentText className="w-16 h-16 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {t('noHistory')}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {t('exploreQuizzes')}
                        </p>
                        <Link href={ROUTES.DASHBOARD}>
                            <Button>{tCommon('browseQuizzes')}</Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="text-center py-4">
                                <div className="text-xl font-bold text-blue-600">
                                    {pagination?.totalItems || attempts.length}
                                </div>
                                <div className="text-xs text-gray-600">{t('totalAttempts')}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="text-center py-4">
                                <div className="text-xl font-bold text-green-600">
                                    {attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : 0}%
                                </div>
                                <div className="text-xs text-gray-600">{t('avgScore')}</div>
                            </CardContent>
                        </Card>
                        {/* Simplified stats for mobile */}
                    </div>

                    {/* Attempts List */}
                    <div className="space-y-4">
                        {attempts.map((attempt) => {
                            const badge = getPerformanceBadge(attempt.score);
                            return (
                                <Card key={attempt._id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 sm:p-6">
                                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 flex-wrap gap-y-1 mb-1">
                                                    <h3 className="text-lg font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-md">
                                                        {attempt.quiz.title}
                                                    </h3>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreColor(attempt.score)}`}>
                                                        {badge.icon} {badge.text}
                                                    </span>
                                                </div>

                                                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                                                    <span className="flex items-center gap-1"><HiOutlineDocumentText className="w-3 h-3" /> {tCommon('questionsCount', { count: attempt.quiz.totalQuestions })}</span>
                                                    <span className="flex items-center gap-1"><HiOutlineClock className="w-3 h-3" /> {formatDate(new Date(attempt.takenAt))}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                                <div className="text-right sm:text-left">
                                                    <div className={`text-2xl font-bold ${getScoreColor(attempt.score).split(' ')[0]}`}>
                                                        {attempt.score}%
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Link href={`/history/${attempt._id}`}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                                                        >
                                                            {t('details')}
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/quiz/${attempt.quiz.slug}`}>
                                                        <Button variant="outline" size="sm">
                                                            {t('redo')}
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="mt-8 flex justify-center">
                            <Pagination
                                currentPage={pagination.currentPage}
                                totalPages={pagination.totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
