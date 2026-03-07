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
import { getSessionStatus, getSessionHistoryDetail } from './api-client';
import type { SessionStatus, SessionHistoryDetail } from './types';
import { ExerciseHistoryTable } from './SessionHistory';

function SectionSkeleton() {
    return (
        <div className="flex h-[400px] w-full items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
        </div>
    );
}

const KnowledgeGraph = dynamic(() => import('./KnowledgeGraph'), {
    loading: SectionSkeleton,
});

const MasteryMatrix = dynamic(() => import('./MasteryMatrix'), {
    loading: SectionSkeleton,
});

const TAB_CONFIG = [
    { key: 'graph' as const, icon: HiOutlineCollection, labelKey: 'knowledgeGraph.title' },
    { key: 'mastery' as const, icon: HiOutlineChartBar, labelKey: 'masteryMatrix.title' },
    { key: 'history' as const, icon: HiOutlineClipboardList, labelKey: 'history.title' },
];

export default function SubjectDetails({ sessionId }: { sessionId: string }) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [status, setStatus] = useState<SessionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [filename, setFilename] = useState(t('defaultLearningPath'));
    const [activeTab, setActiveTab] = useState<'graph' | 'mastery' | 'history'>('graph');
    const [historyDetail, setHistoryDetail] = useState<SessionHistoryDetail | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);

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
    }, [sessionId, t]);

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
        router.push('/adaptive-learning');
    }, [router]);

    const handleStartLearning = useCallback(() => {
        router.push(`/adaptive-learning/exercise/${sessionId}`);
    }, [router, sessionId]);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
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
                    className="-ml-4 mb-4 text-gray-500 hover:text-gray-900 hover:bg-gray-50 gap-2 font-medium"
                >
                    <HiOutlineArrowLeft className="h-5 w-5" />
                    {t('subjectDetails.backToDashboard')}
                </Button>
            </div>

            {/* ── Hero Header Card ── */}
            <div className="relative overflow-hidden rounded-lg bg-white border border-gray-200 p-8 md:p-10">
                <div className="relative flex flex-col md:flex-row justify-between gap-8 md:items-center">
                    <div className="flex items-start gap-4">
                        <div className="rounded-md bg-gray-100 p-3 shrink-0">
                            <HiOutlineBookOpen className="h-6 w-6 text-gray-900" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-gray-900 mb-2">
                                {filename}
                            </h1>
                            <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">{summary}</p>
                        </div>
                    </div>
                    <div className="shrink-0">
                        <Button
                            onClick={handleStartLearning}
                            className="h-10 w-full rounded-md bg-black text-white px-6 font-medium transition-colors hover:bg-gray-800 md:w-auto gap-2"
                        >
                            <HiOutlineLightningBolt className="h-4 w-4" />
                            {t('subjectDetails.startLearning')}
                            <HiArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Quick stats row */}
                {status && (
                    <div className="relative mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-md bg-gray-50 border border-gray-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineCollection className="w-3.5 h-3.5" />
                                {t('stats.concepts')}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">{status.total_concepts}</div>
                        </div>
                        <div className="rounded-md bg-gray-50 border border-gray-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                                {t('stats.accuracyRate')}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">{Math.round(status.accuracy * 100)}%</div>
                        </div>
                        <div className="rounded-md bg-gray-50 border border-gray-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineTrendingUp className="w-3.5 h-3.5" />
                                {t('stats.averageMastery')}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">{Math.round(status.avg_mastery * 100)}%</div>
                        </div>
                        <div className="rounded-md bg-gray-50 border border-gray-100 px-5 py-4">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-1 flex items-center gap-1.5">
                                <HiOutlineAcademicCap className="w-3.5 h-3.5" />
                                {t('stats.correctTotal')}
                            </div>
                            <div className="text-2xl font-mono text-gray-900">{status.total_correct}/{status.total_answered}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Tab Switcher ── */}
            <div className="flex gap-1 bg-gray-50/80 p-1 rounded-md max-w-full sm:w-fit border border-gray-200 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {TAB_CONFIG.map(({ key, icon: Icon, labelKey }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-all duration-200 cursor-pointer whitespace-nowrap ${activeTab === key
                            ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {t(labelKey as any)}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="space-y-8">
                {activeTab === 'graph' && <KnowledgeGraph sessionId={sessionId} />}
                {activeTab === 'mastery' && <MasteryMatrix sessionId={sessionId} filterActiveOnly />}
                {activeTab === 'history' && (
                    historyLoading ? (
                        <div className="flex items-center gap-2 py-10 justify-center text-gray-500">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                            <span className="text-sm">{t('history.loadingFromMongoDB')}</span>
                        </div>
                    ) : historyDetail ? (
                        <ExerciseHistoryTable exercises={historyDetail.exercise_history} />
                    ) : (
                        <div className="text-center py-12 rounded-lg bg-white border border-gray-200 shadow-sm">
                            <HiOutlineClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">
                                {t('history.noMongoDBData')}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {t('history.sessionSaveHint')}
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
