'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import {
    HiCheck,
    HiOutlineSparkles,
    HiOutlineExclamationCircle,
    HiOutlineArrowLeft
} from '@/components/icons';
import { createSessionFromPipeline, getPipelineJobStatus } from './api-client';
import type { PipelineStatus, PipelineJobStatus } from './types';
import { ADAPTIVE_ROUTES } from './routes';
import { saveSessionJobMapping } from './session-storage';

const ProcessingGraphPanel = dynamic(() => import('./ProcessingGraphPanel'), {
    loading: () => (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            </div>
        </div>
    ),
    ssr: false,
});

const STATUS_TO_STEP: Record<PipelineStatus, number> = {
    pending: 0,
    loading: 1,
    chunking: 1,
    extracting: 2,
    embedding: 3,
    merging: 3,
    ranking: 4,
    verifying: 4,
    building_graph: 5,
    optimizing: 5,
    completed: 6,
    failed: -1,
};

const STATUS_LABEL_KEYS: Record<PipelineStatus, string> = {
    pending: 'waitingToStart',
    loading: 'readingDocument',
    chunking: 'splittingChunks',
    extracting: 'extractingConceptsWithAI',
    embedding: 'computingEmbeddings',
    merging: 'mergingDuplicateConcepts',
    ranking: 'rankingPrerequisites',
    verifying: 'verifyingRelationsWithAI',
    building_graph: 'buildingKnowledgeGraph',
    optimizing: 'optimizingDAG',
    completed: 'completed',
    failed: 'failed',
};

type ProcessingStats = {
    concepts_extracted: number;
    concepts_after_merge: number;
    relations_verified: number;
};

export default function AdaptiveLearningProcessing() {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [currentStep, setCurrentStep] = useState(0);
    const [progress, setProgress] = useState(0);
    const [statusLabel, setStatusLabel] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<ProcessingStats | null>(null);
    const [partialGraph, setPartialGraph] = useState<PipelineJobStatus['partial_graph']>(null);
    const [creatingSession, setCreatingSession] = useState(false);
    const [filename, setFilename] = useState('');
    const [showGraphPanel, setShowGraphPanel] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollInFlightRef = useRef(false);
    const creatingSessionRef = useRef(false);

    const steps = useMemo(
        () => [
            { id: 1, label: t('processing.steps.readingPdf') },
            { id: 2, label: t('processing.steps.extractingConcepts') },
            { id: 3, label: t('processing.steps.buildingGraph') },
            { id: 4, label: t('processing.steps.generatingPath') },
            { id: 5, label: t('processing.steps.preparingExercise') },
        ],
        [t]
    );

    const getStatusLabel = useCallback(
        (status: PipelineStatus) => t(`processing.status.${STATUS_LABEL_KEYS[status]}`),
        [t]
    );

    const clearPolling = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        pollInFlightRef.current = false;
    }, []);

    const runFallbackProgress = useCallback(() => {
        const totalDuration = 5000;
        const interval = 50;
        const increment = 100 / (totalDuration / interval);
        let currentProgress = 0;

        clearPolling();
        setStatusLabel(t('processing.status.processing'));
        pollingRef.current = setInterval(() => {
            currentProgress += increment;
            if (currentProgress > 100) {
                currentProgress = 100;
            }

            setProgress(currentProgress);
            const step = Math.min(Math.ceil((currentProgress / 100) * steps.length), steps.length);
            setCurrentStep(step);

            if (currentProgress >= 100) {
                clearPolling();
                const sessionId = localStorage.getItem('al_session_id');
                timeoutRef.current = setTimeout(() => {
                    if (sessionId) {
                        router.push(ADAPTIVE_ROUTES.subject(sessionId));
                        return;
                    }

                    router.push(ADAPTIVE_ROUTES.upload);
                }, 800);
            }
        }, interval);
    }, [clearPolling, router, steps.length, t]);

    useEffect(() => {
        setStatusLabel(t('processing.status.starting'));
        const storedFilename = localStorage.getItem('al_pipeline_filename');
        setFilename(storedFilename || t('processing.defaultFilename'));
    }, [t]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const applyMatch = () => setShowGraphPanel(mediaQuery.matches);

        applyMatch();
        mediaQuery.addEventListener('change', applyMatch);

        return () => {
            mediaQuery.removeEventListener('change', applyMatch);
        };
    }, []);

    useEffect(() => {
        const jobId = localStorage.getItem('al_pipeline_job_id');
        if (!jobId) {
            runFallbackProgress();
            return () => clearPolling();
        }

        const poll = async () => {
            if (pollInFlightRef.current || creatingSessionRef.current) {
                return;
            }

            pollInFlightRef.current = true;
            try {
                const job = await getPipelineJobStatus(jobId);
                const step = STATUS_TO_STEP[job.status] ?? 0;
                setCurrentStep(step);
                setProgress(job.progress * 100);
                setStatusLabel(getStatusLabel(job.status));
                if (job.partial_graph) setPartialGraph(job.partial_graph);

                if (job.concepts_extracted > 0) {
                    setStats((prev) => {
                        if (
                            prev &&
                            prev.concepts_extracted === job.concepts_extracted &&
                            prev.concepts_after_merge === job.concepts_after_merge &&
                            prev.relations_verified === job.relations_verified
                        ) {
                            return prev;
                        }

                        return {
                            concepts_extracted: job.concepts_extracted,
                            concepts_after_merge: job.concepts_after_merge,
                            relations_verified: job.relations_verified,
                        };
                    });
                }

                if (job.status === 'completed' && !creatingSessionRef.current) {
                    clearPolling();
                    creatingSessionRef.current = true;
                    setCreatingSession(true);
                    try {
                        const session = await createSessionFromPipeline(jobId, 50);
                        localStorage.setItem('al_session_id', session.session_id);
                        saveSessionJobMapping(session.session_id, jobId);
                        localStorage.removeItem('al_pipeline_job_id');
                        timeoutRef.current = setTimeout(() => {
                            router.push(ADAPTIVE_ROUTES.subject(session.session_id));
                        }, 800);
                    } catch (err) {
                        const message = err instanceof Error ? err.message : t('createSessionFailed');
                        setError(message);
                        setCreatingSession(false);
                        creatingSessionRef.current = false;
                    }
                } else if (job.status === 'failed') {
                    clearPolling();
                    setError(job.error_message || getStatusLabel('failed'));
                }
            } catch (err) {
                clearPolling();
                const message = err instanceof Error ? err.message : getStatusLabel('failed');
                setError(message);
            } finally {
                pollInFlightRef.current = false;
            }
        };

        creatingSessionRef.current = false;
        void poll();
        pollingRef.current = setInterval(() => {
            void poll();
        }, 2000);

        return () => clearPolling();
    }, [clearPolling, getStatusLabel, router, runFallbackProgress, t]);

    const handleGoBack = useCallback(() => {
        clearPolling();
        creatingSessionRef.current = false;
        localStorage.removeItem('al_pipeline_job_id');
        localStorage.removeItem('al_pipeline_filename');
        router.push(ADAPTIVE_ROUTES.upload);
    }, [clearPolling, router]);

    return (
        <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col lg:flex-row gap-8 items-stretch pt-4">
            <div className="w-full lg:w-[45%] flex-shrink-0">
                <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-8 md:p-10 shadow-sm">
                    <div className="text-center">
                        {error && (
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-red-50 text-red-500 border border-red-100">
                                <HiOutlineExclamationCircle className="h-8 w-8" />
                            </div>
                        )}

                        <h2 className="mb-2 text-2xl font-medium tracking-tight text-slate-900">
                            {error ? t('processing.failedTitle') : t('processing.title')}
                        </h2>
                        <p className="mb-6 text-sm text-slate-500">{filename}</p>

                        {!error && (
                            <div className="mb-8 inline-flex items-center rounded-md bg-slate-50 px-4 py-1.5 border border-slate-200">
                                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-900">{statusLabel}</p>
                            </div>
                        )}

                        {error ? (
                            <div className="mb-8 rounded-md border border-red-100 bg-red-50 p-4 text-left text-sm text-red-700">
                                {error}
                            </div>
                        ) : null}

                        {stats && !error ? (
                            <div className="mb-8 grid grid-cols-3 gap-3">
                                <div className="rounded-md bg-slate-50 border border-slate-100 p-3 text-center">
                                    <div className="text-xl font-mono text-slate-900">{stats?.concepts_extracted}</div>
                                    <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{t('processing.stats.extracted')}</div>
                                </div>
                                <div className="rounded-md bg-slate-50 border border-slate-100 p-3 text-center">
                                    <div className="text-xl font-mono text-slate-900">{stats?.concepts_after_merge}</div>
                                    <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{t('processing.stats.afterMerge')}</div>
                                </div>
                                <div className="rounded-md bg-slate-50 border border-slate-100 p-3 text-center">
                                    <div className="text-xl font-mono text-slate-900">{stats?.relations_verified}</div>
                                    <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{t('processing.stats.relations')}</div>
                                </div>
                            </div>
                        ) : null}

                        {!error ? (
                            <div className="mx-auto mb-8 max-w-sm space-y-4 text-left">
                                {steps.map((step) => {
                                    const isCompleted = step.id < currentStep;
                                    const isActive = step.id === currentStep;

                                    return (
                                        <div key={step.id} className="flex items-center gap-3 group">
                                            <div
                                                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${isCompleted
                                                    ? 'bg-teal-600 text-white'
                                                    : isActive
                                                        ? 'border border-slate-900 bg-white'
                                                        : 'border border-slate-200 bg-slate-50'
                                                    }`}
                                            >
                                                {isCompleted ? <HiCheck className="h-3 w-3" /> : null}
                                                {isActive ? <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-900" /> : null}
                                            </div>
                                            <span
                                                className={`text-sm transition-colors duration-200 ${isCompleted
                                                    ? 'text-slate-900 font-medium'
                                                    : isActive
                                                        ? 'text-slate-900 font-semibold'
                                                        : 'text-slate-400'
                                                    }`}
                                            >
                                                {step.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}

                        {creatingSession ? (
                            <div className="mb-6 flex flex-col items-center justify-center gap-2 font-medium text-slate-900 text-sm">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                                {t('processing.creatingSession')}
                            </div>
                        ) : null}

                        {!error ? (
                            <div className="relative pt-4">
                                <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    <span>{t('processing.progress')}</span>
                                    <span className="font-mono">{Math.round(progress)}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                                    <div
                                        className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        ) : null}

                        {error ? (
                            <div className="mt-8 flex justify-center">
                                <Button variant="outline" onClick={handleGoBack} className="rounded-md px-6 py-2.5 h-auto text-sm font-medium hover:bg-slate-50 border-slate-200 transition-colors">
                                    <HiOutlineArrowLeft className="mr-2 h-4 w-4" />
                                    {t('processing.tryAgain')}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>

                {!error ? (
                    <div className="mx-auto mt-6 flex w-full items-start gap-2 rounded-[16px] border border-slate-200 bg-white p-4 shadow-sm text-xs text-slate-600">
                        <HiOutlineSparkles className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <p>
                            <strong className="text-slate-900">{t('processing.didYouKnow')}</strong> {t('processing.didYouKnowDescription')}
                        </p>
                    </div>
                ) : null}
            </div>

            {!error && showGraphPanel ? (
                <div className="relative hidden shadow-sm lg:flex w-full lg:w-[55%] h-[600px] overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                    <div className="pointer-events-none absolute left-6 top-6 z-10">
                        <h3 className="text-sm font-medium tracking-wide text-slate-900">{t('processing.knowledgeGraph')}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{t('processing.visualizingStructures')}</p>
                    </div>
                    <ProcessingGraphPanel partialGraph={partialGraph} />
                </div>
            ) : null}
        </div >
    );
}
