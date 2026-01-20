'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import {
    HiOutlineCloudUpload,
    HiOutlineClock,
    HiOutlineChartBar,
    HiOutlineAcademicCap,
    HiOutlineLightningBolt,
    HiArrowRight,
    HiOutlineBookOpen
} from '@/components/icons';
import { mockCourses, mockDailyStats } from './mock-data';
import KnowledgeGraph from './KnowledgeGraph';

// Reusable premium stat card
const StatCard = ({ title, value, subtitle, icon: Icon, gradient }: any) => (
    <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-transform hover:scale-[1.02] ${gradient}`}>
        <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {subtitle && (
                    <span className="text-xs font-medium bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">
                        {subtitle}
                    </span>
                )}
            </div>
            <div>
                <div className="text-3xl font-bold mb-1 tracking-tight">{value}</div>
                <div className="text-white/80 text-sm font-medium">{title}</div>
            </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
    </div>
);

export default function AdaptiveLearningDashboard() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const tCommon = useTranslations('common');

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <HiOutlineAcademicCap className="w-8 h-8 text-indigo-600" />
                        {t('dashboardTitle')}
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg max-w-2xl">
                        {t('dashboardDescription')}
                    </p>
                </div>
                <Button
                    onClick={() => router.push('/adaptive-learning/upload')}
                    className="rounded-full shadow-lg hover:shadow-xl transition-all bg-indigo-600 hover:bg-indigo-700 text-white px-6"
                    size="lg"
                >
                    <HiOutlineCloudUpload className="w-5 h-5 mr-2" />
                    {t('uploadNewMaterial')}
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={t('stats.exercisesCompleted')}
                    value={mockDailyStats.exercisesCompleted}
                    subtitle={t('stats.exercisesCompletedSubtitle', { count: 4 })}
                    icon={HiOutlineChartBar}
                    gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <StatCard
                    title={t('stats.learningTime')}
                    value={t('stats.learningTimeValue', { minutes: mockDailyStats.timeSpentMinutes })}
                    subtitle={t('stats.learningTimeTarget', { minutes: 60 })}
                    icon={HiOutlineClock}
                    gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
                />
                <StatCard
                    title={t('stats.currentStreak')}
                    value={t('stats.streakDays', { count: mockDailyStats.streakDays })}
                    icon={HiOutlineLightningBolt}
                    gradient="bg-gradient-to-br from-orange-400 to-pink-500"
                />
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center space-y-3">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <span className="font-bold text-lg">A+</span>
                    </div>
                    <div>
                        <div className="text-gray-900 font-bold">{t('stats.accuracyRate')}</div>
                        <div className="text-green-600 font-semibold text-xl">{mockDailyStats.accuracy}%</div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Active Courses */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900">{t('activeLearningPaths')}</h2>
                        <Button variant="ghost" className="text-indigo-600 hover:bg-indigo-50">{tCommon('viewAll')}</Button>
                    </div>

                    <div className="space-y-4">
                        {mockCourses.map((course) => (
                            <div
                                key={course.id}
                                className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                                onClick={() => router.push(`/adaptive-learning/exercise/ex-01`)}
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-2xl group-hover:w-2 transition-all" />

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <HiOutlineBookOpen className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900 truncate">{course.title}</h3>
                                            <Badge variant={course.progress > 80 ? 'success' : 'warning'} size="sm">
                                                {course.progress}%
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">
                                            {t('currentTopic')} <span className="text-gray-700 font-medium">{course.currentTopic}</span>
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                                        <div className="w-full sm:w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${course.progress}%` }} />
                                        </div>
                                        <span className="text-xs text-indigo-600 font-medium group-hover:translate-x-1 transition-transform flex items-center">
                                            {t('continue')} <HiArrowRight className="w-3 h-3 ml-1" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Recommendations & Activity */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-900">{t('recommendedForYou')}</h2>

                    <Card className="bg-gradient-to-b from-gray-900 to-gray-800 text-white border-none shadow-xl">
                        <CardContent className="p-6 space-y-6">
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{t('focusArea')}</div>
                                <h3 className="text-lg font-bold text-white mb-2">{t('recommendedTopicTitle')}</h3>
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    {t('recommendedTopicDescription')}
                                </p>
                            </div>
                            <Button className="w-full bg-white text-gray-900 hover:bg-gray-100 font-semibold rounded-xl py-6">
                                {t('startFocusedReview')}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4">{t('recentActivity')}</h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <div>
                                        <div className="text-sm font-medium text-gray-700">{t('recentActivityItem', { title: t('recentActivityCourseTitle') })}</div>
                                        <div className="text-xs text-gray-400">{t('timeAgoHours', { count: 2 })}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Knowledge Graph Section */}
            <div className="mt-8">
                <KnowledgeGraph />
            </div>
        </div>
    );
}
