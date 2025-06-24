'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
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
    today: { newUsers: number; newQuizzes: number; attempts: number; };
    thisWeek: { newUsers: number; newQuizzes: number; attempts: number; };
    thisMonth: { newUsers: number; newQuizzes: number; attempts: number; };
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
    users: Array<{ email: string; createdAt: string; }>;
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
    users: Array<{ _id: { year: number; month: number }; count: number; }>;
    quizzes: Array<{ _id: { year: number; month: number }; count: number; }>;
    attempts: Array<{ _id: { year: number; month: number }; count: number; }>;
  };
}

export default function AdminStatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showCreatorsModal, setShowCreatorsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);

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

    fetchStats();
  }, [session, status, router]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch statistics');
      }
    } catch (error) {
      setError('Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMonth = (year: number, month: number) => {
    return new Date(year, month - 1).toLocaleDateString('vi-VN', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
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
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">{session?.user?.email}</span>
                <Button
                  onClick={() => signOut()}
                  variant="outline"
                  size="sm"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex">
          <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} currentPath={pathname} />
          <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
            <div className="p-8">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Đang tải thống kê...</p>
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
      {/* Navigation - giống như trang admin khác */}
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

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {session?.user?.email?.[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="text-gray-700 font-medium hidden sm:block">
                  {session?.user?.email}
                </span>
                <svg className={`w-4 h-4 text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => signOut()}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} currentPath={pathname} />

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Thống kê hệ thống</h1>
              <p className="text-gray-600 mt-2">Tổng quan về hoạt động và hiệu suất của hệ thống</p>
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
                      <CardTitle className="text-sm font-medium text-gray-600">Tổng người dùng</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">{stats.overview.totalUsers}</div>
                      <p className="text-xs text-gray-500">+{stats.timeBasedStats.thisMonth.newUsers} tháng này</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Tổng quiz</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{stats.overview.totalQuizzes}</div>
                      <p className="text-xs text-gray-500">{stats.overview.publishedQuizzes} đã xuất bản</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Lượt làm bài</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">{stats.overview.totalAttempts}</div>
                      <p className="text-xs text-gray-500">+{stats.timeBasedStats.thisMonth.attempts} tháng này</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">Điểm trung bình</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">{Math.round(stats.scoreStats.averageScore)}%</div>
                      <p className="text-xs text-gray-500">Cao nhất: {stats.scoreStats.highestScore}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Time-based Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Hoạt động theo thời gian</CardTitle>
                    <CardDescription>Thống kê hoạt động của hệ thống</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-medium text-blue-900 mb-2">Hôm nay</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-blue-700">{stats.timeBasedStats.today.newUsers} người dùng mới</p>
                          <p className="text-sm text-blue-700">{stats.timeBasedStats.today.newQuizzes} quiz mới</p>
                          <p className="text-sm text-blue-700">{stats.timeBasedStats.today.attempts} lượt làm bài</p>
                        </div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h3 className="font-medium text-green-900 mb-2">Tuần này</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-green-700">{stats.timeBasedStats.thisWeek.newUsers} người dùng mới</p>
                          <p className="text-sm text-green-700">{stats.timeBasedStats.thisWeek.newQuizzes} quiz mới</p>
                          <p className="text-sm text-green-700">{stats.timeBasedStats.thisWeek.attempts} lượt làm bài</p>
                        </div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <h3 className="font-medium text-purple-900 mb-2">Tháng này</h3>
                        <div className="space-y-1">
                          <p className="text-sm text-purple-700">{stats.timeBasedStats.thisMonth.newUsers} người dùng mới</p>
                          <p className="text-sm text-purple-700">{stats.timeBasedStats.thisMonth.newQuizzes} quiz mới</p>
                          <p className="text-sm text-purple-700">{stats.timeBasedStats.thisMonth.attempts} lượt làm bài</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quiz Status Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Trạng thái Quiz</CardTitle>
                    <CardDescription>Tổng quan về trạng thái các quiz trong hệ thống</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900">{stats.overview.totalQuizzes}</div>
                        <p className="text-sm text-gray-600">Tổng cộng</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{stats.overview.publishedQuizzes}</div>
                        <p className="text-sm text-green-600">Đã xuất bản</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{stats.overview.pendingQuizzes}</div>
                        <p className="text-sm text-yellow-600">Chờ duyệt</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{stats.overview.rejectedQuizzes}</div>
                        <p className="text-sm text-red-600">Bị từ chối</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Categories and Creators */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Top danh mục</CardTitle>
                        <CardDescription>Danh mục có nhiều quiz nhất</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCategoriesModal(true)}
                      >
                        Xem tất cả
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.topCategories.slice(0, 5).map((category, index) => (
                          <div key={category.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span className="font-medium">{category.name}</span>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">{category.quizCount} quiz</div>
                              <div className="text-gray-500">{category.totalQuestions} câu hỏi</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Top người tạo quiz</CardTitle>
                        <CardDescription>Người dùng tạo nhiều quiz nhất</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreatorsModal(true)}
                      >
                        Xem tất cả
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.topCreators.slice(0, 5).map((creator, index) => (
                          <div key={creator.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                              <span className="font-medium">{creator.email}</span>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium">{creator.quizCount} quiz</div>
                              <div className="text-gray-500">{creator.totalQuestions} câu hỏi</div>
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
                      <CardTitle>Hoạt động gần đây</CardTitle>
                      <CardDescription>Hoạt động trong 30 ngày qua</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowActivityModal(true)}
                    >
                      Xem tất cả
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Recent Users */}
                      <div>
                        <h4 className="font-medium mb-3 text-blue-600">Người dùng mới</h4>
                        <div className="space-y-2">
                          {stats.recentActivity.users.slice(0, 5).map((user, index) => (
                            <div key={index} className="text-sm p-2 bg-blue-50 rounded">
                              <div className="font-medium">{user.email}</div>
                              <div className="text-gray-500">{formatDate(user.createdAt)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Quizzes */}
                      <div>
                        <h4 className="font-medium mb-3 text-green-600">Quiz mới</h4>
                        <div className="space-y-2">
                          {stats.recentActivity.quizzes.slice(0, 5).map((quiz, index) => (
                            <div key={index} className="text-sm p-2 bg-green-50 rounded">
                              <div className="font-medium truncate">{quiz.title}</div>
                              <div className="flex items-center space-x-2 text-xs">
                                <span className={`px-2 py-1 rounded ${getStatusBadgeColor(quiz.status)}`}>
                                  {quiz.status}
                                </span>
                                <span className="text-gray-500">{formatDate(quiz.createdAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Attempts */}
                      <div>
                        <h4 className="font-medium mb-3 text-purple-600">Lượt làm bài gần đây</h4>
                        <div className="space-y-2">
                          {stats.recentActivity.attempts.slice(0, 5).map((attempt, index) => (
                            <div key={index} className="text-sm p-2 bg-purple-50 rounded">
                              <div className="font-medium truncate">{attempt.quiz.title}</div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">
                                  {attempt.user?.email || 'Ẩn danh'}
                                </span>
                                <span className="font-medium">{attempt.score}%</span>
                              </div>
                              <div className="text-gray-500 text-xs">{formatDate(attempt.takenAt)}</div>
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
                    <CardTitle>Thống kê theo danh mục</CardTitle>
                    <CardDescription>Chi tiết quiz theo từng danh mục</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4">Danh mục</th>
                            <th className="text-center py-3 px-4">Tổng quiz</th>
                            <th className="text-center py-3 px-4">Đã xuất bản</th>
                            <th className="text-center py-3 px-4">Chờ duyệt</th>
                            <th className="text-center py-3 px-4">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.categoryStats.slice(0, 10).map((category, index) => (
                            <tr key={category.name} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  <span className="font-medium">{category.name}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-4 font-medium">{category.totalQuizzes}</td>
                              <td className="text-center py-3 px-4 text-green-600">{category.publishedQuizzes}</td>
                              <td className="text-center py-3 px-4 text-yellow-600">{category.pendingQuizzes}</td>
                              <td className="text-center py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {category.isActive ? 'Hoạt động' : 'Không hoạt động'}
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
              title="Tất cả danh mục"
              type="categories"
              apiEndpoint="/api/admin/stats/categories"
            />

            <StatsModal
              isOpen={showCreatorsModal}
              onClose={() => setShowCreatorsModal(false)}
              title="Tất cả người tạo quiz"
              type="creators"
              apiEndpoint="/api/admin/stats/creators"
            />

            <StatsModal
              isOpen={showActivityModal}
              onClose={() => setShowActivityModal(false)}
              title="Tất cả hoạt động gần đây"
              type="activity"
              apiEndpoint="/api/admin/stats/activity?type=mixed"
            />
          </div>
        </main>
      </div>
    </div>
  );
} 