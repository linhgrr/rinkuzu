'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import {
    HiArrowRight,
    HiOutlineArrowLeft,
    HiOutlineBookOpen,
    HiOutlineChartBar,
    HiOutlineCollection,
    HiOutlineClipboardList,
    HiOutlineLightningBolt,
    HiOutlineCheckCircle,
    HiOutlineAcademicCap,
    HiOutlineTrendingUp,
} from '@/components/icons';
import { createSessionFromPipeline, getSessionStatus, getSessionHistoryDetail, isSessionNotFoundError, prefetchStartLearningData } from './api-client';
import type { SessionStatus, SessionHistoryDetail } from './types';
import { ADAPTIVE_ROUTES } from './routes';
import { getJobIdForSession, saveSessionJobMapping } from './session-storage';

function SectionSkeleton() {
    return (
        <div className="flex h-[400px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
        </div>
    );
}

const KnowledgeGraph = dynamic(() => import('./KnowledgeGraph'), {
    loading: SectionSkeleton,
});

const MasteryMatrix = dynamic(() => import('./MasteryMatrix'), {
    loading: SectionSkeleton,
});

const ExerciseHistoryTable = dynamic(
    () => import('./SessionHistory').then(module => ({ default: module.ExerciseHistoryTable })),
    {
        loading: () => (
            <div className="flex items-center gap-2 py-10 justify-center text-slate-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
        ),
        ssr: false,
    }
);

const TAB_CONFIG = [
    { key: 'graph' as const, icon: HiOutlineCollection, labelKey: 'knowledgeGraph.title' },
    { key: 'mastery' as const, icon: HiOutlineChartBar, labelKey: 'masteryMatrix.title' },
    { key: 'history' as const, icon: HiOutlineClipboardList, labelKey: 'history.title' },
] as const;

export default function SubjectDetails({ sessionId }: { sessionId: string }) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [status, setStatus] = useState<SessionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [filename, setFilename] = useState(t('defaultLearningPath'));
    const [activeTab, setActiveTab] = useState<'graph' | 'mastery' | 'history'>('graph');
    const [historyDetail, setHistoryDetail] = useState<SessionHistoryDetail | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [recoveringSession, setRecoveringSession] = useState(false);
    const [didPrefetchStartLearning, setDidPrefetchStartLearning] = useState(false);

    useEffect(() => {
        let mounted = true;
        const bootstrap = async () => {
            const storedFilename = localStorage.getItem('al_pipeline_filename');
            const storedSubjectName = localStorage.getItem('al_pipeline_subject_name');
            if (mounted) {
                setFilename(storedSubjectName || storedFilename || t('defaultLearningPath'));
            }

            try {
                const sessionStatus = await getSessionStatus(sessionId);
                if (mounted) {
                    setStatus(sessionStatus);
                }
            } catch (error) {
                if (!mounted || !isSessionNotFoundError(error)) {
                    return;
                }

                const jobId = getJobIdForSession(sessionId);
                if (!jobId) {
                    return;
                }

                setRecoveringSession(true);
                try {
                    const newSession = await createSessionFromPipeline(jobId, 9999);
                    if (!mounted) {
                        return;
                    }

                    localStorage.setItem('al_session_id', newSession.session_id);
                    saveSessionJobMapping(newSession.session_id, jobId);
                    router.replace(ADAPTIVE_ROUTES.subject(newSession.session_id));
                    return;
                } catch {
                    if (!mounted) {
                        return;
                    }
                    setRecoveringSession(false);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        void bootstrap();
        return () => {
            mounted = false;
        };
    }, [router, sessionId, t]);

    useEffect(() => {
        router.prefetch(ADAPTIVE_ROUTES.dashboard);
        router.prefetch(ADAPTIVE_ROUTES.exercise(sessionId));
    }, [router, sessionId]);

    useEffect(() => {
        if (historyDetail) return;

        let mounted = true;
        const windowWithIdle = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };

        const hydrateHistory = () => {
            getSessionHistoryDetail(sessionId)
                .then((d) => {
                    if (mounted) setHistoryDetail(d);
                })
                .catch(() => {
                    // Intentionally ignore; tab-specific loader still handles retries visually.
                });
        };

        let idleId: number | undefined;
        let timeoutId: number | undefined;

        if (windowWithIdle.requestIdleCallback) {
            idleId = windowWithIdle.requestIdleCallback(hydrateHistory, { timeout: 1200 });
        } else {
            timeoutId = window.setTimeout(hydrateHistory, 300);
        }

        return () => {
            mounted = false;
            if (idleId !== undefined && windowWithIdle.cancelIdleCallback) {
                windowWithIdle.cancelIdleCallback(idleId);
            }
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [historyDetail, sessionId]);

    // Load MongoDB exercise history when tab selected
    useEffect(() => {
        if (activeTab !== 'history' || historyDetail) return;
        let mounted = true;
        setHistoryLoading(true);
        getSessionHistoryDetail(sessionId)
            .then((d) => { if (mounted) setHistoryDetail(d); })
            .catch(() => { /* silently ignore if not yet in MongoDB */ })
            .finally(() => { if (mounted) setHistoryLoading(false); });
        return () => { mounted = false; };
    }, [activeTab, sessionId, historyDetail]);

    const summary = useMemo(() => {
        if (!status) {
            return t('subjectDetails.summaryFallback');
        }
        return t('subjectDetails.summary', {
            concepts: status.total_concepts,
            accuracy: Math.round(status.accuracy * 100),
        });
    }, [status, t]);

    const handleBackToDashboard = useCallback(() => {
        router.push(ADAPTIVE_ROUTES.dashboard);
    }, [router]);

    const handleStartLearning = useCallback(() => {
        router.push(ADAPTIVE_ROUTES.exercise(sessionId));
    }, [router, sessionId]);

    const handlePrefetchStartLearning = useCallback(() => {
        if (didPrefetchStartLearning) {
            return;
        }

        setDidPrefetchStartLearning(true);
        void prefetchStartLearningData(sessionId);
    }, [didPrefetchStartLearning, sessionId]);

    if (recoveringSession) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Back button */}
            <div>
                <Button
                    variant="ghost"
                    onClick={handleBackToDashboard}
                    className="-ml-4 mb-4 text-slate-500 hover:text-slate-900 hover:bg-slate-50 gap-2 font-medium min-h-[44px] px-4"
                >
                    <HiOutlineArrowLeft className="h-5 w-5" />
                    {t('subjectDetails.backToDashboard')}
                </Button>
            </div>

            {/* ── Hero Header Card ── */}
            <div className="relative overflow-hidden rounded-[24px] bg-white border border-slate-200 p-5 sm:p-8 md:p-10 shadow-sm">
                <div className="relative flex flex-col md:flex-row justify-between gap-6 md:items-center">
                    <div className="flex items-start gap-4">
                        <div className="rounded-[14px] bg-slate-50 border border-slate-100 p-3 sm:p-3.5 shrink-0 shadow-xs">
                            <HiOutlineBookOpen className="h-6 w-6 sm:w-7 sm:h-7 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mb-1.5">
                                {filename}
                            </h1>
                            <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-2xl">{summary}</p>
                        </div>
                    </div>
                    <div className="shrink-0">
                        <Button
                            onClick={handleStartLearning}
                            onMouseEnter={handlePrefetchStartLearning}
                            onFocus={handlePrefetchStartLearning}
                            className="w-full sm:w-auto rounded-full bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500 px-6 min-h-[44px] h-11 font-medium text-sm transition-all sm:hover:scale-105 active:scale-95 shadow-sm md:w-auto gap-2"
                        >
                            <HiOutlineLightningBolt className="h-4 w-4" />
                            {t('subjectDetails.startLearning')}
                            <HiArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Quick stats row */}
                {status ? (
                    <div className="relative mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineCollection className="w-3.5 h-3.5" />
                                {t('stats.concepts')}
                            </div>
                            <div className="text-2xl font-mono text-slate-900">{status.total_concepts}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                                {t('stats.accuracyRate')}
                            </div>
                            <div className="text-2xl font-mono text-slate-900">{Math.round(status.accuracy * 100)}%</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineTrendingUp className="w-3.5 h-3.5" />
                                {t('stats.averageMastery')}
                            </div>
                            <div className="text-2xl font-mono text-slate-900">{Math.round(status.avg_mastery * 100)}%</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineAcademicCap className="w-3.5 h-3.5" />
                                {t('stats.correctTotal')}
                            </div>
                            <div className="text-2xl font-mono text-slate-900">{status.total_correct}/{status.total_answered}</div>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="relative mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-4 animate-pulse">
                                <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
                                <div className="h-8 w-16 bg-slate-200 rounded" />
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* ── Tab Switcher ── */}
            <div className="flex gap-1 bg-slate-50 p-1 rounded-lg max-w-full sm:w-fit border border-slate-200 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {TAB_CONFIG.map(({ key, icon: Icon, labelKey }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium rounded-[6px] transition-all duration-200 cursor-pointer whitespace-nowrap ${activeTab === key
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        {t(labelKey)}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="space-y-8">
                {activeTab === 'graph' && <KnowledgeGraph sessionId={sessionId} />}
                {activeTab === 'mastery' && <MasteryMatrix sessionId={sessionId} filterActiveOnly />}
                {activeTab === 'history' && (
                    historyLoading ? (
                        <div className="flex items-center gap-2 py-10 justify-center text-slate-500">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                            <span className="text-sm">{t('history.loadingFromMongoDB')}</span>
                        </div>
                    ) : historyDetail ? (
                        <ExerciseHistoryTable exercises={historyDetail.exercise_history} />
                    ) : (
                        <div className="text-center py-12 rounded-xl bg-white border border-slate-200 shadow-sm">
                            <HiOutlineClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">
                                {t('history.noMongoDBData')}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {t('history.sessionSaveHint')}
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
