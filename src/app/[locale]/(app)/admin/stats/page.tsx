'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchApiData } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import StatsModal from '@/components/ui/StatsModal';

interface AdminStats {
  overview: {
    totalUsers: number;
    totalAdmins: number;
    totalQuizzes: number;
    publishedQuizzes: number;
    pendingQuizzes: number;
    rejectedQuizzes: number;
    totalAttempts: number;
    totalCategories: number;
    activeCategories: number;
  };
  timeBasedStats: {
    today: { newUsers: number; newQuizzes: number; attempts: number };
    thisWeek: { newUsers: number; newQuizzes: number; attempts: number };
    thisMonth: { newUsers: number; newQuizzes: number; attempts: number };
  };
  topCategories: Array<{
    name: string;
    color: string;
    quizCount: number;
    totalQuestions: number;
  }>;
  topCreators: Array<{
    email: string;
    quizCount: number;
    totalQuestions: number;
  }>;
  categoryStats: Array<{
    name: string;
    color: string;
    isActive: boolean;
    totalQuizzes: number;
    publishedQuizzes: number;
    pendingQuizzes: number;
  }>;
  recentActivity: {
    users: Array<{ email: string; createdAt: string }>;
    quizzes: Array<{
      title: string;
      status: string;
      createdAt: string;
      author: { email: string };
      category: { name: string };
    }>;
    attempts: Array<{
      score: number;
      takenAt: string;
      user: { email: string } | null;
      quiz: { title: string };
    }>;
  };
  scoreStats: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
  growthTrends: {
    users: Array<{ _id: { year: number; month: number }; count: number }>;
    quizzes: Array<{ _id: { year: number; month: number }; count: number }>;
    attempts: Array<{ _id: { year: number; month: number }; count: number }>;
  };
}

export default function AdminStatsPage() {
  const t = useTranslations('admin');
  const _tCommon = useTranslations('common');
  const { data: _session } = useSession();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showCreatorsModal, setShowCreatorsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApiData<AdminStats>('/api/admin/stats');
      setStats(data);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const _formatMonth = (year: number, month: number) => {
    return new Date(year, month - 1).toLocaleDateString('vi-VN', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="success">{status}</Badge>;
      case 'pending':
        return <Badge variant="warning">{status}</Badge>;
      case 'rejected':
        return <Badge variant="danger">{status}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="flex">
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            currentPath={pathname}
          />
          <main
            className={`flex-1 transition-[margin] duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}
          >
            <div className="p-8">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="size-12 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-trust mx-auto" />
                  <p className="mt-4 text-neutral-600">{t('loadingStatistics')}</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="flex">
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          currentPath={pathname}
        />

        {/* Main Content */}
        <main
          className={`flex-1 transition-[margin] duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}
        >
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-neutral-900">{t('statistics')}</h1>
              <p className="text-neutral-600 mt-2">{t('systemStatistics')}</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
                {error}
              </div>
            )}

            {stats && (
              <div className="space-y-8">
                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-600">
                        {t('totalUsersCount')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-brand-trust">
                        {stats?.overview?.totalUsers || 0}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {t('newThisMonth', {
                          count: stats?.timeBasedStats?.thisMonth?.newUsers || 0,
                        })}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-600">
                        {t('totalQuizzes')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {stats?.overview?.totalQuizzes || 0}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {t('publishedCount', { count: stats?.overview?.publishedQuizzes || 0 })}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-600">
                        {t('attemptsCount')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-brand-action">
                        {stats?.overview?.totalAttempts || 0}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {t('attempts', { count: stats?.timeBasedStats?.thisMonth?.attempts || 0 })}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-neutral-600">
                        {t('averageScore')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-brand-trust">
                        {Math.round(stats.scoreStats.averageScore)}%
                      </div>
                      <p className="text-xs text-neutral-500">
                        {t('highestScore', { score: stats.scoreStats.highestScore })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Time-based Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('activityOverTime')}</CardTitle>
                    <CardDescription>{t('systemActivityStats')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium text-green-800 mb-2">{t('today')}</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-brand-trust">
                            {t('newUsers', { count: stats.timeBasedStats.today.newUsers })}
                          </p>
                          <p className="text-sm text-brand-trust">
                            {t('newQuizzes', { count: stats.timeBasedStats.today.newQuizzes })}
                          </p>
                          <p className="text-sm text-brand-trust">
                            {t('attempts', { count: stats.timeBasedStats.today.attempts })}
                          </p>
                        </div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium text-green-900 mb-2">{t('thisWeek')}</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-green-700">
                            {t('newUsers', { count: stats.timeBasedStats.thisWeek.newUsers })}
                          </p>
                          <p className="text-sm text-green-700">
                            {t('newQuizzes', { count: stats.timeBasedStats.thisWeek.newQuizzes })}
                          </p>
                          <p className="text-sm text-green-700">
                            {t('attempts', { count: stats.timeBasedStats.thisWeek.attempts })}
                          </p>
                        </div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium text-brand-trust mb-2">{t('thisMonth')}</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-green-700">
                            {t('newUsers', { count: stats.timeBasedStats.thisMonth.newUsers })}
                          </p>
                          <p className="text-sm text-green-700">
                            {t('newQuizzes', { count: stats.timeBasedStats.thisMonth.newQuizzes })}
                          </p>
                          <p className="text-sm text-green-700">
                            {t('attempts', { count: stats.timeBasedStats.thisMonth.attempts })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quiz Status Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('quizStatus')}</CardTitle>
                    <CardDescription>{t('quizStatusOverview')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-neutral-50 rounded-lg">
                        <div className="text-2xl font-bold text-neutral-900">
                          {stats.overview.totalQuizzes}
                        </div>
                        <p className="text-sm text-neutral-600">{t('totalCount')}</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {stats.overview.publishedQuizzes}
                        </div>
                        <p className="text-sm text-green-600">{t('publishedStatus')}</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">
                          {stats.overview.pendingQuizzes}
                        </div>
                        <p className="text-sm text-yellow-600">{t('pendingStatus')}</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {stats.overview.rejectedQuizzes}
                        </div>
                        <p className="text-sm text-red-600">{t('rejectedStatus')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Categories and Creators */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{t('topCategories')}</CardTitle>
                        <CardDescription>{t('mostQuizzes')}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCategoriesModal(true)}
                        className="min-h-[36px] px-3"
                      >
                        {t('viewAll')}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.topCategories.slice(0, 5).map((category, index) => (
                          <div
                            key={category.name}
                            className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                          >
                            <div className="flex items-center gap-x-3">
                              <span className="text-sm font-medium text-neutral-500">
                                #{index + 1}
                              </span>
                              <div
                                className="size-4 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span className="font-medium">{category.name}</span>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">
                                {category.quizCount} {t('quiz')}
                              </div>
                              <div className="text-neutral-500">
                                {category.totalQuestions} {t('questions')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{t('topCreators')}</CardTitle>
                        <CardDescription>{t('mostQuizzesCreated')}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreatorsModal(true)}
                        className="min-h-[36px] px-3"
                      >
                        {t('viewAll')}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.topCreators.slice(0, 5).map((creator, index) => (
                          <div
                            key={creator.email}
                            className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                          >
                            <div className="flex items-center gap-x-3">
                              <span className="text-sm font-medium text-neutral-500">
                                #{index + 1}
                              </span>
                              <span className="font-medium">{creator.email}</span>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">
                                {creator.quizCount} {t('quiz')}
                              </div>
                              <div className="text-neutral-500">
                                {creator.totalQuestions} {t('questions')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{t('recentActivity')}</CardTitle>
                      <CardDescription>{t('last30Days')}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowActivityModal(true)}
                      className="min-h-[36px] px-3"
                    >
                      {t('viewAll')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Recent Users */}
                      <div>
                        <h4 className="font-medium mb-3 text-brand-trust">
                          {t('newUsers', { count: '' })}
                        </h4>
                        <div className="space-y-2">
                          {stats.recentActivity.users.slice(0, 5).map((user, index) => (
                            <div key={index} className="text-sm p-2 bg-green-50 rounded">
                              <div className="font-medium">{user.email}</div>
                              <div className="text-neutral-500">{formatDate(user.createdAt)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Quizzes */}
                      <div>
                        <h4 className="font-medium mb-3 text-green-600">
                          {t('newQuizzes', { count: '' })}
                        </h4>
                        <div className="space-y-2">
                          {stats.recentActivity.quizzes.slice(0, 5).map((quiz, index) => (
                            <div key={index} className="text-sm p-2 bg-green-50 rounded">
                              <div className="font-medium truncate">{quiz.title}</div>
                              <div className="flex items-center gap-x-2 text-xs">
                                {getStatusBadge(quiz.status)}
                                <span className="text-neutral-500">
                                  {formatDate(quiz.createdAt)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Attempts */}
                      <div>
                        <h4 className="font-medium mb-3 text-brand-trust">{t('recentAttempts')}</h4>
                        <div className="space-y-2">
                          {stats.recentActivity.attempts.slice(0, 5).map((attempt, index) => (
                            <div key={index} className="text-sm p-2 bg-green-50 rounded">
                              <div className="font-medium truncate">{attempt.quiz.title}</div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-500">
                                  {attempt.user?.email || t('anonymous')}
                                </span>
                                <span className="font-medium">{attempt.score}%</span>
                              </div>
                              <div className="text-neutral-500 text-xs">
                                {formatDate(attempt.takenAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Category Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('categoryStatistics')}</CardTitle>
                    <CardDescription>{t('detailsByCategory')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4">{t('category')}</th>
                            <th className="text-center py-3 px-4">{t('totalQuizzesCol')}</th>
                            <th className="text-center py-3 px-4">{t('publishedCol')}</th>
                            <th className="text-center py-3 px-4">{t('pendingCol')}</th>
                            <th className="text-center py-3 px-4">{t('statusCol')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.categoryStats.slice(0, 10).map((category, _index) => (
                            <tr key={category.name} className="border-b hover:bg-neutral-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-x-3">
                                  <div
                                    className="size-3 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  <span className="font-medium">{category.name}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-4 font-medium">
                                {category.totalQuizzes}
                              </td>
                              <td className="text-center py-3 px-4 text-green-600">
                                {category.publishedQuizzes}
                              </td>
                              <td className="text-center py-3 px-4 text-yellow-600">
                                {category.pendingQuizzes}
                              </td>
                              <td className="text-center py-3 px-4">
                                <span
                                  className={`inline-flex min-h-[28px] items-center rounded-full px-3 text-[13px] font-medium ${
                                    category.isActive
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {category.isActive ? t('active') : t('inactiveStatus')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Modals */}
            <StatsModal
              isOpen={showCategoriesModal}
              onClose={() => setShowCategoriesModal(false)}
              title={t('allCategories')}
              type="categories"
              apiEndpoint="/api/admin/stats/categories"
            />

            <StatsModal
              isOpen={showCreatorsModal}
              onClose={() => setShowCreatorsModal(false)}
              title={t('allCreators')}
              type="creators"
              apiEndpoint="/api/admin/stats/creators"
            />

            <StatsModal
              isOpen={showActivityModal}
              onClose={() => setShowActivityModal(false)}
              title={t('allRecentActivity')}
              type="activity"
              apiEndpoint="/api/admin/stats/activity?type=mixed"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
