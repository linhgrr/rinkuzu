'use client';

import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import {
    FiTarget,
    FiZap,
    FiBookOpen,
    FiCheckCircle,
    FiClock,
    FiBarChart2,
    FiStar,
    FiUploadCloud,
    FiTrash2,
    FiSearch,
    FiBook,
    FiChevronRight,
    FiAward,
    FiActivity
} from 'react-icons/fi';
import {
    FcDocument,
    FcFile,
    FcFolder,
    FcIdea,
    FcLibrary,
    FcMindMap,
    FcNews,
    FcOpenedFolder,
    FcReading,
    FcReadingEbook,
    FcFlashOn,
    FcSportsMode,
    FcPuzzle
} from 'react-icons/fc';

const FC_ICONS = [
    FcReadingEbook,
    FcDocument,
    FcIdea,
    FcMindMap,
    FcNews,
    FcLibrary,
    FcReading,
    FcOpenedFolder,
    FcPuzzle,
    FcFolder
];
import { checkApiHealth, createSessionFromPipeline, deleteSubject, getSessionHistory, getSubjects } from './api-client';
import type { PipelineJobHistoryItem, SessionHistoryItem } from './types';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonCard } from './Skeletons';
import { SubjectCard } from './SubjectCard';

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface DashboardProps {
    initialSubjects: PipelineJobHistoryItem[];
    initialSessionHistory: SessionHistoryItem[];
}

export default function AdaptiveLearningDashboard({
    initialSubjects,
    initialSessionHistory
}: DashboardProps) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');

    const [subjects, setSubjects] = useState<PipelineJobHistoryItem[]>(initialSubjects);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [apiOnline, setApiOnline] = useState<boolean | null>(true);
    const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<PipelineJobHistoryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(initialSessionHistory);

    // Simple state for toast notifications
    const [toastMsg, setToastMsg] = useState<{ title: string, type: 'error' | 'success' } | null>(null);

    const showToast = useCallback((title: string, type: 'error' | 'success' = 'error') => {
        setToastMsg({ title, type });
        setTimeout(() => setToastMsg(null), 5000);
    }, []);

    const refreshSubjects = useCallback(async () => {
        try {
            const data = await getSubjects();
            setSubjects(data);
        } catch (e) {
            console.error('Failed to refresh subjects', e);
        }
    }, []);

    const handleGoUpload = useCallback(() => {
        router.push('/adaptive-learning/upload');
    }, [router]);

    const handleOpenSubject = useCallback(async (jobId: string) => {
        if (loadingJobId || deletingJobId) return;
        setLoadingJobId(jobId);

        try {
            const session = await createSessionFromPipeline(jobId, 50);
            localStorage.setItem('al_session_id', session.session_id);
            router.push(`/adaptive-learning/subject/${session.session_id}`);
        } catch (err) {
            console.error(`Error creating session: ${(err as Error).message}`);
            showToast(`Could not start session: ${(err as Error).message}`, 'error');
            setLoadingJobId(null);
        }
    }, [router, loadingJobId, deletingJobId, showToast]);

    const handleDeleteClick = useCallback((job: PipelineJobHistoryItem) => {
        setItemToDelete(job);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!itemToDelete || loadingJobId || deletingJobId) return;

        setDeletingJobId(itemToDelete.job_id);
        try {
            await deleteSubject(itemToDelete.job_id, true);
            await refreshSubjects();

            if (localStorage.getItem('al_pipeline_job_id') === itemToDelete.job_id) {
                localStorage.removeItem('al_pipeline_job_id');
                localStorage.removeItem('al_pipeline_filename');
                localStorage.removeItem('al_pipeline_subject_name');
            }
            showToast('Document deleted successfully', 'success');
        } catch (err) {
            console.error(`Error deleting subject: ${(err as Error).message}`);
            showToast('Failed to delete document.', 'error');
        } finally {
            setDeletingJobId(null);
            setItemToDelete(null);
        }
    }, [itemToDelete, loadingJobId, deletingJobId, refreshSubjects, showToast]);

    const handleCancelDelete = useCallback(() => {
        if (!deletingJobId) {
            setItemToDelete(null);
        }
    }, [deletingJobId]);

    const filteredSubjects = subjects.filter((job) => {
        if (!searchQuery) return true;
        const displayName = job.filename?.replace(/\.[^.]+$/, '') || job.subject_id || job.job_id;
        return displayName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const upNextSubject = subjects.length > 0 ? subjects[0] : null;

    return (
        <div className="font-sans text-slate-900 selection:bg-slate-200">
            {/* Custom Toast Container for Errors */}
            {toastMsg && (
                <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl border shadow-lg flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-5 ${toastMsg.type === 'error' ? 'bg-white border-red-200 text-slate-900' : 'bg-slate-900 text-white border-transparent'}`}>
                    {toastMsg.type === 'error' ? (
                        <FiZap className="text-red-500 w-5 h-5 shrink-0" aria-hidden="true" />
                    ) : (
                        <div className="w-10 h-10 shrink-0 bg-white/10 rounded-full flex items-center justify-center p-1">
                            <Image src="/images/mascot_image.png" alt="Mascot" width={40} height={40} className="w-full h-full object-contain" />
                        </div>
                    )}
                    <span className="text-sm font-medium">{toastMsg.title}</span>
                </div>
            )}

            <div className="mx-auto max-w-6xl space-y-10">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">{t('dashboard.welcomeBack')}</h1>
                        <p className="text-slate-600 mt-2 text-base max-w-xl">{t('dashboard.pickUpDescription')}</p>
                        {apiOnline === false && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-50 border border-orange-100 text-orange-600 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                {t('dashboard.connectionLimited')}
                            </div>
                        )}
                        {error && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                {error}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Streak */}
                        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-sm">
                            <span className="text-lg leading-none select-none" aria-label="Streak">🔥</span>
                            <span className="font-bold text-sm text-orange-600 tracking-tight">{t('dashboard.dayStreak', { count: 12 })}</span>
                        </div>
                        {/* Daily Goal Progress Bar */}
                        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-sm min-w-[140px] md:min-w-[160px]">
                            <FiTarget className="text-slate-500 w-4 h-4 shrink-0" aria-label="Goal" />
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-slate-700 tracking-wider">
                                        {t('dashboard.dailyGoalProgress', { current: 2, total: 3 })}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: '66%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">

                    {/* Left Column (Primary Actions & Data) */}
                    <div className="lg:col-span-2 space-y-8 md:space-y-10">

                        {/* Up Next Card */}
                        {loading && !upNextSubject ? (
                            <section className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-sm relative overflow-hidden hidden md:block animate-pulse h-64">
                                <div className="h-4 bg-slate-100 rounded w-24 mb-6"></div>
                                <div className="h-8 bg-slate-100 rounded w-1/2 mb-4"></div>
                                <div className="h-4 bg-slate-50 rounded w-3/4 mb-10"></div>
                                <div className="h-12 bg-slate-100 rounded-xl w-40"></div>
                            </section>
                        ) : upNextSubject ? (
                            <section className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-sm hover:border-teal-400 hover:shadow-[0_0_20px_rgba(20,184,166,0.15)] transition-all duration-500 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/4 pointer-events-none"></div>

                                {/* Mascot Image */}
                                <div className="absolute right-0 bottom-0 pointer-events-none hidden sm:block opacity-90 transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-2 z-0">
                                    <Image src="/images/mascot_image.png" alt="Mascot" width={288} height={288} className="w-64 h-64 md:w-72 md:h-72 object-contain" />
                                </div>

                                <div className="relative z-10 flex flex-col items-start gap-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="bg-teal-100 text-teal-700 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">{t('dashboard.upNext')}</span>
                                        <span className="text-teal-600 text-sm font-medium">{t('dashboard.continueLearning')}</span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                                        {upNextSubject.subject_id || upNextSubject.filename.replace(/\.[^.]+$/, '')}
                                    </h2>
                                    <p className="text-slate-600 mb-6 max-w-[420px] leading-relaxed text-base">
                                        {t('dashboard.nextLevelDescription')}
                                    </p>
                                    <button
                                        onClick={() => handleOpenSubject(upNextSubject.job_id)}
                                        disabled={loadingJobId === upNextSubject.job_id}
                                        className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-3.5 px-8 rounded-xl flex items-center justify-center gap-2.5 shadow-lg hover:shadow-teal-500/25 border border-teal-500 transition-all duration-300 w-full sm:w-auto disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600 min-h-[56px]"
                                    >
                                        {loadingJobId === upNextSubject.job_id ? (
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <>
                                                <FiBookOpen className="w-5 h-5 opacity-80" aria-hidden="true" />
                                                {t('dashboard.continueSession')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </section>
                        ) : (
                            <section className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm text-center py-20 flex flex-col items-center">
                                <div className="bg-slate-50 p-5 border border-slate-100 rounded-2xl mb-6">
                                    <FiUploadCloud className="text-slate-400 w-8 h-8" aria-hidden="true" />
                                </div>
                                <h2 className="text-2xl font-bold mb-3 text-slate-900 tracking-tight">{t('dashboard.uploadMaterialTitle')}</h2>
                                <p className="text-slate-600 mb-8 max-w-sm mx-auto">{t('dashboard.uploadMaterialHint')}</p>
                                <button
                                    onClick={handleGoUpload}
                                    className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-3.5 px-8 rounded-xl inline-flex items-center justify-center gap-2.5 shadow-lg hover:shadow-teal-500/25 border border-teal-500 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-600 min-h-[56px]"
                                >
                                    <FiUploadCloud className="w-5 h-5 opacity-80" aria-hidden="true" />
                                    {t('dashboard.uploadDocument')}
                                </button>
                            </section>
                        )}

                        {/* Library Stack Overview */}
                        <section className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-sm overflow-hidden flex flex-col items-stretch">
                            <div className="flex flex-col sm:flex-row sm:items-start lg:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2.5 text-slate-900 tracking-tight">
                                        <FiBookOpen className="text-slate-400 w-5 h-5" aria-hidden="true" />
                                        {t('dashboard.yourLibrary')}
                                    </h3>
                                    <p className="text-xs text-slate-600 mt-2">{t('dashboard.libraryDescription')}</p>
                                </div>
                                <div className="flex flex-row gap-3 items-center w-full sm:w-auto">
                                    <div className="relative w-full sm:w-48">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                        <input
                                            type="text"
                                            placeholder={t('dashboard.searchPlaceholder')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            spellCheck={false}
                                            autoComplete="off"
                                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                                            aria-label="Search documents"
                                        />
                                    </div>
                                    <button
                                        onClick={handleGoUpload}
                                        className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 min-h-[44px] min-w-[44px]"
                                        title="Upload new document"
                                    >
                                        <FiUploadCloud className="w-4 h-4 opacity-70" aria-hidden="true" />
                                        <span className="hidden md:inline text-sm">{t('uploadPage.upload')}</span>
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex flex-col pb-4 mt-2">
                                    {[1, 2, 3].map((i) => <SkeletonCard key={`skel-${i}`} />)}
                                </div>
                            ) : filteredSubjects.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed mb-4">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                                        <FiBookOpen className="w-5 h-5 text-slate-400" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{t('dashboard.noDocumentsTitle')}</h3>
                                    <p className="text-xs text-slate-600 mt-1 max-w-[200px] mx-auto">{t('dashboard.noDocumentsDescription')}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col pb-4 mt-2">
                                    {filteredSubjects.map((job, idx) => (
                                        <SubjectCard
                                            key={job.job_id}
                                            job={job}
                                            index={idx}
                                            onOpen={handleOpenSubject}
                                            onDelete={handleDeleteClick}
                                            loading={loadingJobId === job.job_id}
                                            deleting={deletingJobId === job.job_id}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column (Context & Motivation) */}
                    <div className="space-y-8 md:space-y-10">

                        {/* Daily Quests */}
                        <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-slate-900 tracking-tight">
                                <FiTarget className="text-slate-400 w-5 h-5" aria-hidden="true" />
                                {t('dashboard.dailyQuests')}
                            </h3>
                            <ul className="space-y-5">
                                <li className="flex items-start gap-4 group cursor-pointer">
                                    <div className="mt-0.5 relative">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                                            <FiZap className="text-amber-500 w-4 h-4" aria-label="Speed" />
                                        </div>
                                    </div>
                                    <div className="flex-1 mt-1.5">
                                        <p className="text-sm font-semibold text-slate-900 group-hover:text-black transition-colors duration-300">{t('dashboard.completeOneLesson')}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-mono">10 XP</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4 group cursor-pointer">
                                    <div className="mt-0.5 relative">
                                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
                                            <FiTarget className="text-rose-500 w-4 h-4" aria-label="Accuracy" />
                                        </div>
                                    </div>
                                    <div className="flex-1 mt-1.5">
                                        <p className="text-sm font-semibold text-slate-900 group-hover:text-black transition-colors duration-300">{t('dashboard.achieveAccuracy')}</p>
                                        <p className="text-xs text-slate-500 mt-1 font-mono">20 XP</p>
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* Achievements */}
                        <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-slate-900 tracking-tight">
                                <FiAward className="text-slate-400 w-5 h-5" aria-hidden="true" />
                                {t('dashboard.recentBadges')}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gradient-to-b from-amber-50 to-orange-50 p-5 rounded-2xl border border-orange-100 flex flex-col items-center text-center transition-all hover:scale-[1.02] hover:shadow-md cursor-default relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/40 rounded-full blur-xl group-hover:bg-white/60 transition-colors"></div>
                                    <div className="text-4xl drop-shadow-md mb-3 transform group-hover:scale-110 transition-transform flex items-center justify-center">
                                        <FcFlashOn className="w-12 h-12" />
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-900 tracking-tight">{t('dashboard.fastLearner')}</p>
                                    <p className="text-[11px] text-slate-600 mt-1 font-medium">{t('dashboard.lessonsToday', { count: 3 })}</p>
                                </div>
                                <div className="bg-gradient-to-b from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 flex flex-col items-center text-center transition-all hover:scale-[1.02] hover:shadow-md cursor-default relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/40 rounded-full blur-xl group-hover:bg-white/60 transition-colors"></div>
                                    <div className="text-4xl drop-shadow-md mb-3 transform group-hover:scale-110 transition-transform flex items-center justify-center">
                                        <FcSportsMode className="w-12 h-12" />
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-900 tracking-tight">{t('dashboard.perfectScore')}</p>
                                    <p className="text-[11px] text-slate-600 mt-1 font-medium">{t('dashboard.accuracyBadge')}</p>
                                </div>
                            </div>
                        </section>

                        {/* Activity Feed */}
                        <section className="px-2">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">{t('dashboard.activityHistory')}</h3>
                            <div className="relative border-l border-slate-200 ml-2.5 space-y-8">
                                {sessionHistory.length > 0 ? sessionHistory.map((h, i) => (
                                    <div key={h.session_id} className="relative pl-6">
                                        <div className={`absolute w-2 h-2 bg-white border-2 ${i === 0 ? 'border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.1)]' : 'border-slate-300'} rounded-full -left-[4.5px] top-1.5`}></div>
                                        <p className="text-sm font-semibold text-slate-900">{t('dashboard.learningSession')}</p>
                                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                                            {t('dashboard.accQs', { acc: Math.round(h.accuracy * 100), count: h.total_answered })}
                                        </p>
                                    </div>
                                )) : (
                                    <>
                                        <div className="relative pl-6">
                                            <div className="absolute w-2 h-2 bg-white border-2 border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.1)] rounded-full -left-[4.5px] top-1.5"></div>
                                            <p className="text-sm font-semibold text-slate-900">{t('dashboard.masteredReactState')}</p>
                                            <p className="text-xs text-slate-500 mt-1.5 font-medium">{t('dashboard.hoursAgo', { count: 2 })}</p>
                                        </div>
                                        <div className="relative pl-6">
                                            <div className="absolute w-2 h-2 bg-white border-2 border-slate-300 rounded-full -left-[4.5px] top-1.5"></div>
                                            <p className="text-sm font-medium text-slate-500">{t('dashboard.completedDailyGoal')}</p>
                                            <p className="text-xs text-slate-400 mt-1.5 font-medium">{t('dashboard.yesterday')}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Bottom Spacer */}
                <div className="pb-12 md:pb-20"></div>
            </div>

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={!!itemToDelete}
                title={t('dashboard.deleteDocumentTitle')}
                message={
                    <span className="text-slate-500 text-sm">
                        {t('dashboard.deleteConfirmDescription')}
                    </span>
                }
                confirmText={t('dashboard.deleteMaterial')}
                cancelText={t('common.cancel')}
                confirmVariant="destructive"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                isLoading={!!deletingJobId}
            />
        </div>
    );
}
