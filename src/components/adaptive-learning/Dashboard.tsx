'use client';

import React, { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
    FiAward
} from 'react-icons/fi';
import { checkApiHealth, createSessionFromPipeline, deleteSubject, getSessionHistory } from './api-client';
import type { PipelineJobHistoryItem, SessionHistoryItem } from './types';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useSubjects } from '@/hooks/useAdaptiveLearning';

// ─── Skeletons ───────────────────────────────────────────────────────────────

const SkeletonCard = memo(function SkeletonCard() {
    return (
        <div className="w-full h-24 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center p-4 gap-4 animate-pulse mb-3">
            <div className="w-12 h-12 bg-slate-100 rounded-xl shrink-0"></div>
            <div className="flex-1 space-y-2">
                <div className="h-5 bg-slate-100 rounded-md w-1/3"></div>
                <div className="h-3 bg-slate-50 rounded-md w-1/4"></div>
            </div>
            <div className="h-8 w-8 bg-slate-100 rounded-lg shrink-0"></div>
        </div>
    );
});

// ─── Subject Card ─────────────────────────────────────────────────────────────

interface SubjectCardProps {
    job: PipelineJobHistoryItem;
    onOpen: (jobId: string) => void;
    onDelete: (job: PipelineJobHistoryItem) => void;
    loading?: boolean;
    deleting?: boolean;
    index?: number;
}

const SubjectCard = memo(function SubjectCard({ job, onOpen, onDelete, loading, deleting, index = 0 }: SubjectCardProps) {
    const displayName = job.filename
        ? job.filename.replace(/\.[^.]+$/, '')
        : job.subject_id || job.job_id;

    const t = useTranslations('adaptiveLearning');
    const locale = useLocale();

    const completedAt = job.completed_at
        ? new Date(job.completed_at * 1000).toLocaleDateString(locale)
        : '—';

    return (
        <div
            className="group w-full overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-row items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-900 hover:-translate-y-1 bg-gradient-to-r from-white to-slate-50/30 mb-3"
            onClick={() => onOpen(job.job_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(job.job_id); }}
        >
            <div className="flex flex-row items-center flex-1 p-4 gap-4 relative z-10 w-full min-w-0">
                {/* Icon */}
                <div className="shrink-0">
                    <div className="inline-flex rounded-xl bg-white p-3 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 border border-slate-200/50 shadow-sm">
                        <FiBookOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                </div>

                {/* Titles */}
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <h3 className="font-bold text-slate-900 text-base md:text-lg tracking-tight leading-tight truncate group-hover:text-black transition-colors" title={job.subject_id || displayName}>
                        {job.subject_id || displayName}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 w-full opacity-70 min-w-0">
                        {job.subject_id && job.filename && (
                            <p className="text-[11px] font-medium text-slate-500 truncate" title={job.filename}>
                                {job.filename}
                            </p>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap shrink-0">
                            <FiClock className="w-3 h-3" aria-hidden="true" />
                            {completedAt}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2 pl-4 border-l border-slate-100 h-full">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(job); }}
                        disabled={loading || deleting}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        title={t('dashboard.deleteMaterial')}
                        aria-label={t('dashboard.deleteMaterial')}
                    >
                        {deleting ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                    </button>
                    <div className="hidden sm:flex text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all duration-300 mr-2">
                        <FiChevronRight className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {loading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-3">
                        <svg className="animate-spin h-6 w-6 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                </div>
            )}
        </div>
    );
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function AdaptiveLearningDashboard() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');

    const { data: subjectsData, isLoading: loading, error: subjectsError, mutate: mutateSubjects } = useSubjects();
    const subjects = subjectsData || [];
    const error = subjectsError ? String(subjectsError) : null;

    const [apiOnline, setApiOnline] = useState<boolean | null>(null);
    const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
    const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<PipelineJobHistoryItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

    // Simple state for toast notifications
    const [toastMsg, setToastMsg] = useState<{ title: string, type: 'error' | 'success' } | null>(null);

    const showToast = useCallback((title: string, type: 'error' | 'success' = 'error') => {
        setToastMsg({ title, type });
        setTimeout(() => setToastMsg(null), 5000);
    }, []);

    useEffect(() => {
        let mounted = true;
        const bootstrap = async () => {
            const online = await checkApiHealth();
            if (mounted) setApiOnline(online);
            if (online) {
                try {
                    const h = await getSessionHistory(5);
                    if (mounted) setSessionHistory(h);
                } catch (e) {
                    if (mounted) showToast('Failed to load activity history', 'error');
                }
            }
        };
        void bootstrap();
        return () => { mounted = false; };
    }, [showToast]);

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
            void mutateSubjects();

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
    }, [itemToDelete, loadingJobId, deletingJobId, mutateSubjects, showToast]);

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
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 xl:p-12 font-sans text-slate-900 selection:bg-slate-200">
            {/* Custom Toast Container for Errors */}
            {toastMsg && (
                <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl border shadow-lg flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-5 ${toastMsg.type === 'error' ? 'bg-white border-red-200 text-slate-900' : 'bg-slate-900 text-white border-transparent'}`}>
                    {toastMsg.type === 'error' ? (
                        <FiZap className="text-red-500 w-5 h-5 shrink-0" aria-hidden="true" />
                    ) : (
                        <FiCheckCircle className="text-emerald-400 w-5 h-5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="text-sm font-medium">{toastMsg.title}</span>
                </div>
            )}

            <div className="mx-auto max-w-6xl space-y-10">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Welcome back.</h1>
                        <p className="text-slate-500 mt-2 text-base max-w-xl">Pick up right where you left off and keep your learning streak alive.</p>
                        {apiOnline === false && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                API Offline
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
                        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-sm">
                            <FiZap className="text-slate-800 fill-slate-800 w-4 h-4" aria-label="Streak" />
                            <span className="font-semibold text-sm text-slate-800 tracking-tight">12 Day Streak</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-sm">
                            <FiTarget className="text-slate-500 w-4 h-4" aria-label="Goal" />
                            <span className="font-medium text-sm text-slate-700 tracking-tight">Daily Goal: 2/3</span>
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
                            <section className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="relative z-10 flex flex-col items-start gap-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">UP NEXT</span>
                                        <span className="text-slate-500 text-sm font-medium">Continue Learning</span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                                        {upNextSubject.subject_id || upNextSubject.filename.replace(/\.[^.]+$/, '')}
                                    </h2>
                                    <p className="text-slate-500 mb-6 max-w-[420px] leading-relaxed text-base">
                                        Dive back into this document to improve your mastery. Based on your previous runs, you are ready for the next level.
                                    </p>
                                    <button
                                        onClick={() => handleOpenSubject(upNextSubject.job_id)}
                                        disabled={loadingJobId === upNextSubject.job_id}
                                        className="bg-slate-900 hover:bg-black text-white font-medium py-3.5 px-8 rounded-xl flex items-center justify-center gap-2.5 transition-all w-full sm:w-auto disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900"
                                    >
                                        {loadingJobId === upNextSubject.job_id ? (
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <>
                                                <FiBookOpen className="w-5 h-5 opacity-80" aria-hidden="true" />
                                                Continue Session
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
                                <h2 className="text-2xl font-bold mb-3 text-slate-900 tracking-tight">Upload Material</h2>
                                <p className="text-slate-500 mb-8 max-w-sm mx-auto">Get started by uploading a PDF document to generate an adaptive learning experience.</p>
                                <button
                                    onClick={handleGoUpload}
                                    className="bg-slate-900 hover:bg-black text-white font-medium py-3.5 px-8 rounded-xl inline-flex items-center justify-center gap-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900 shadow-sm"
                                >
                                    <FiUploadCloud className="w-5 h-5 opacity-80" aria-hidden="true" />
                                    Upload Document
                                </button>
                            </section>
                        )}

                        {/* Library Stack Overview */}
                        <section className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200 shadow-sm overflow-hidden flex flex-col items-stretch">
                            <div className="flex flex-col sm:flex-row sm:items-start lg:items-center justify-between gap-4 mb-8">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2.5 text-slate-900 tracking-tight">
                                        <FiBookOpen className="text-slate-400 w-5 h-5" aria-hidden="true" />
                                        Your Library
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-2">All uploaded and processed study materials.</p>
                                </div>
                                <div className="flex flex-row gap-3 items-center w-full sm:w-auto">
                                    <div className="relative w-full sm:w-48">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                                        <input
                                            type="text"
                                            placeholder="Search..."
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
                                        className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800 font-medium py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                                        title="Upload new document"
                                    >
                                        <FiUploadCloud className="w-4 h-4 opacity-70" aria-hidden="true" />
                                        <span className="hidden md:inline text-sm">Upload</span>
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex flex-col pb-4 mt-2">
                                    {[1, 2, 3].map((i) => <SkeletonCard key={`skel-${i}`} />)}
                                </div>
                            ) : filteredSubjects.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed mb-4">
                                    <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                                        <FiBookOpen className="w-5 h-5 text-slate-400" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900 tracking-tight">No documents yet</h3>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">Upload a new PDF to populate your library.</p>
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
                                Daily Quests
                            </h3>
                            <ul className="space-y-5">
                                <li className="flex items-start gap-4">
                                    <div className="mt-0.5 relative">
                                        <FiCheckCircle className="text-slate-300 w-5 h-5 shrink-0 relative z-10 bg-white" aria-label="Completed" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-400 line-through">Complete 1 lesson</p>
                                        <p className="text-xs text-slate-400 mt-1 font-mono">10 / 10 XP</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4 group cursor-pointer">
                                    <div className="mt-0.5 relative">
                                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0 group-hover:border-slate-500 transition-colors relative z-10 bg-white" role="checkbox" aria-checked="false" aria-label="Not completed" tabIndex={0}></div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 group-hover:text-black transition-colors">Achieve 80% accuracy</p>
                                        <p className="text-xs text-slate-500 mt-1 font-mono">20 XP</p>
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* Achievements */}
                        <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-slate-900 tracking-tight">
                                <FiAward className="text-slate-400 w-5 h-5" aria-hidden="true" />
                                Recent Badges
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center text-center transition-colors hover:bg-slate-100">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm mb-3">
                                        <FiZap className="text-slate-800 text-lg" aria-hidden="true" />
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-900 tracking-tight">Fast Learner</p>
                                    <p className="text-[11px] text-slate-500 mt-1 font-medium">3 lessons today</p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col items-center text-center transition-colors hover:bg-slate-100">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm mb-3">
                                        <FiStar className="text-slate-800 text-lg" aria-hidden="true" />
                                    </div>
                                    <p className="text-[13px] font-bold text-slate-900 tracking-tight">Perfect Score</p>
                                    <p className="text-[11px] text-slate-500 mt-1 font-medium">100% accuracy</p>
                                </div>
                            </div>
                        </section>

                        {/* Activity Feed */}
                        <section className="px-2">
                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">History</h3>
                            <div className="relative border-l border-slate-200 ml-2.5 space-y-8">
                                {sessionHistory.length > 0 ? sessionHistory.map((h, i) => (
                                    <div key={h.session_id} className="relative pl-6">
                                        <div className={`absolute w-2 h-2 bg-white border-2 ${i === 0 ? 'border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.1)]' : 'border-slate-300'} rounded-full -left-[4.5px] top-1.5`}></div>
                                        <p className="text-sm font-semibold text-slate-900">Learning Session</p>
                                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                                            {Math.round(h.accuracy * 100)}% acc, {h.total_answered} qs
                                        </p>
                                    </div>
                                )) : (
                                    <>
                                        <div className="relative pl-6">
                                            <div className="absolute w-2 h-2 bg-white border-2 border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.1)] rounded-full -left-[4.5px] top-1.5"></div>
                                            <p className="text-sm font-semibold text-slate-900">Mastered &quot;React State&quot;</p>
                                            <p className="text-xs text-slate-500 mt-1.5 font-medium">2 hours ago</p>
                                        </div>
                                        <div className="relative pl-6">
                                            <div className="absolute w-2 h-2 bg-white border-2 border-slate-300 rounded-full -left-[4.5px] top-1.5"></div>
                                            <p className="text-sm font-medium text-slate-500">Completed daily goal</p>
                                            <p className="text-xs text-slate-400 mt-1.5 font-medium">Yesterday</p>
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
