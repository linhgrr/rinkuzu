'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiArrowRight, HiOutlineX, HiCheck, HiBookOpen, HiLightBulb } from '@/components/icons';
import { createSessionFromPipeline, getNextConcept, getTheory, getExercise, submitAnswer, isSessionNotFoundError } from './api-client';
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import { TextShimmer } from '@/components/ui/text-shimmer';
import type { BloomLevel, Exercise, NextConcept, TheoryData } from './types';
import { getJobIdForSession, saveSessionExerciseOutcome, saveSessionJobMapping } from './session-storage';
import { ADAPTIVE_ROUTES } from './routes';

interface ExerciseProps {
    sessionId: string;
}

const BLOOM_LEVEL_COLORS: Record<string, string> = {
    Remember: 'bg-slate-100 text-slate-700',
    Understand: 'bg-teal-100 text-teal-700',
    Apply: 'bg-emerald-100 text-emerald-700',
    Analyze: 'bg-amber-100 text-amber-700',
    Evaluate: 'bg-orange-100 text-orange-700',
    Create: 'bg-rose-100 text-rose-700',
};

const BLOOM_TRANSLATION_KEYS: Record<BloomLevel, string> = {
    Remember: 'remember',
    Understand: 'understand',
    Apply: 'apply',
    Analyze: 'analyze',
    Evaluate: 'evaluate',
    Create: 'create',
};

export default function AdaptiveLearningExercise({ sessionId }: ExerciseProps) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [concept, setConcept] = useState<NextConcept | null>(null);
    const [theory, setTheory] = useState<TheoryData | null>(null);
    const [exercise, setExercise] = useState<Exercise | null>(null);

    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [loadingConcept, setLoadingConcept] = useState(true);
    const [loadingTheory, setLoadingTheory] = useState(false);
    const [loadingExercise, setLoadingExercise] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTheory, setShowTheory] = useState(false);
    const [recoveringSession, setRecoveringSession] = useState(false);

    const loadingRef = useRef(false);
    const isMountedRef = useRef(true);
    const activeRequestIdRef = useRef(0);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const loadData = useCallback(async () => {
        if (!isMountedRef.current || loadingRef.current) return;
        loadingRef.current = true;
        const requestId = activeRequestIdRef.current + 1;
        activeRequestIdRef.current = requestId;
        setLoadingConcept(true);
        setError(null);
        setSelectedOption(null);

        setConcept(null);
        setTheory(null);
        setExercise(null);
        setShowTheory(false);

        const isLatestActiveRequest = () =>
            isMountedRef.current && activeRequestIdRef.current === requestId;

        try {
            // 1. Get concept first
            const nextConcept = await getNextConcept(sessionId);
            if (!isLatestActiveRequest()) {
                return;
            }
            setConcept(nextConcept);
            setLoadingConcept(false);

            if (nextConcept.bloom_level <= 2) {
                // Bloom 1 or 2: load theory + exercise in parallel
                setShowTheory(true);
                setLoadingTheory(true);
                setLoadingExercise(true);

                const theoryPromise = getTheory(sessionId)
                    .then((theoryData) => {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        setTheory(theoryData);
                    })
                    .catch((reason) => {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        console.error('Failed to load theory:', reason);
                    })
                    .finally(() => {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        setLoadingTheory(false);
                    });

                const exercisePromise = getExercise(sessionId)
                    .then((exerciseData) => {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        setExercise(exerciseData);
                    })
                    .catch((reason) => {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        console.error('Failed to load exercise:', reason);
                        setError(
                            reason instanceof Error
                                ? reason.message
                                : t('exercise.failedToLoadExercise')
                        );
                    })
                    .finally(() => {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        setLoadingExercise(false);
                    });

                await Promise.allSettled([theoryPromise, exercisePromise]);

            } else {
                // Bloom > 2: skip theory, load exercise directly
                setLoadingExercise(true);
                const ex = await getExercise(sessionId);
                if (!isLatestActiveRequest()) {
                    return;
                }
                setExercise(ex);
                setLoadingExercise(false);
            }

        } catch (err) {
            if (!isLatestActiveRequest()) {
                return;
            }

            if (isSessionNotFoundError(err)) {
                const mappedJobId = getJobIdForSession(sessionId);
                if (mappedJobId) {
                    setRecoveringSession(true);
                    try {
                        const freshSession = await createSessionFromPipeline(mappedJobId, 50);
                        if (!isLatestActiveRequest()) {
                            return;
                        }

                        localStorage.setItem('al_session_id', freshSession.session_id);
                        saveSessionJobMapping(freshSession.session_id, mappedJobId);
                        router.replace(ADAPTIVE_ROUTES.exercise(freshSession.session_id));
                        return;
                    } catch {
                        if (!isLatestActiveRequest()) {
                            return;
                        }
                        setRecoveringSession(false);
                    }
                }
            }

            const message = err instanceof Error ? err.message : t('exercise.failedToLoadExercise');
            setError(message);
            setLoadingConcept(false);
            setLoadingTheory(false);
            setLoadingExercise(false);
        } finally {
            loadingRef.current = false;
        }
    }, [sessionId, t]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        router.prefetch(ADAPTIVE_ROUTES.dashboard);
        router.prefetch(ADAPTIVE_ROUTES.result(sessionId));
    }, [router, sessionId]);

    const handleSubmit = useCallback(async () => {
        if (!selectedOption || !exercise) {
            return;
        }
        setSubmitting(true);
        try {
            router.prefetch(ADAPTIVE_ROUTES.result(sessionId));
            const result = await submitAnswer(sessionId, selectedOption);
            if (!isMountedRef.current) {
                return;
            }
            saveSessionExerciseOutcome(sessionId, { result, exercise });
            router.push(ADAPTIVE_ROUTES.result(sessionId));
        } catch (err) {
            if (!isMountedRef.current) {
                return;
            }

            if (isSessionNotFoundError(err)) {
                const mappedJobId = getJobIdForSession(sessionId);
                if (mappedJobId) {
                    setRecoveringSession(true);
                    try {
                        const freshSession = await createSessionFromPipeline(mappedJobId, 50);
                        if (!isMountedRef.current) {
                            return;
                        }

                        localStorage.setItem('al_session_id', freshSession.session_id);
                        saveSessionJobMapping(freshSession.session_id, mappedJobId);
                        router.replace(ADAPTIVE_ROUTES.exercise(freshSession.session_id));
                        return;
                    } catch {
                        if (!isMountedRef.current) {
                            return;
                        }
                        setRecoveringSession(false);
                    }
                }
            }

            const message = err instanceof Error ? err.message : t('exercise.failedToSubmitAnswer');
            setError(message);
        } finally {
            if (!isMountedRef.current) {
                return;
            }
            setSubmitting(false);
        }
    }, [exercise, router, selectedOption, sessionId, t]);

    const progressPercent = useMemo(() => {
        const itemInfo = concept || exercise;
        if (!itemInfo || itemInfo.max_steps <= 0) {
            return 0;
        }
        return (itemInfo.step / itemInfo.max_steps) * 100;
    }, [exercise, concept]);

    const bloomColor = useMemo(() => {
        const itemInfo = concept || exercise;
        if (!itemInfo) {
            return 'bg-slate-400 text-white';
        }
        return BLOOM_LEVEL_COLORS[itemInfo.bloom_label] || 'bg-slate-400 text-white';
    }, [exercise, concept]);

    const localizedBloomLabel = useMemo(() => {
        const itemInfo = concept || exercise;
        if (!itemInfo) {
            return '';
        }
        return t(`bloom.${BLOOM_TRANSLATION_KEYS[itemInfo.bloom_label]}`);
    }, [exercise, concept, t]);

    const optionEntries = useMemo(() => {
        if (!exercise) {
            return [];
        }
        return Object.entries(exercise.options);
    }, [exercise]);

    if (loadingConcept || recoveringSession) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                    <p className="text-base font-medium text-slate-900">{t('exercise.loadingTitle')}</p>
                    <p className="mt-1 text-sm text-slate-500">{t('exercise.loadingSubtitle')}</p>
                </div>
            </div>
        );
    }

    if (error || !concept) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
                <div className="space-y-4 text-center">
                    <p className="text-lg text-red-500">{error || t('exercise.noExerciseAvailable')}</p>
                    <div className="flex justify-center gap-3">
                        <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700" onClick={() => router.push(ADAPTIVE_ROUTES.dashboard)}>
                            {t('exercise.backToDashboard')}
                        </Button>
                        <Button className="bg-teal-600 hover:bg-teal-700 shadow-none text-white transition-colors" onClick={() => void loadData()}>{t('exercise.tryAgain')}</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (showTheory) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col">
                <div className="mb-8 md:mb-10 text-center px-4">
                    <div className="mx-auto mb-5 md:mb-6 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-[18px] bg-slate-50 border border-slate-200 text-slate-900 shadow-sm">
                        <HiBookOpen className="h-6 w-6 md:h-8 md:w-8" />
                    </div>
                    <h1 className="mb-2 text-xl font-semibold tracking-tight text-slate-900 md:text-3xl">{t('exercise.theory.reviewKnowledge')}</h1>
                    <p className="text-sm md:text-base text-slate-500">
                        {t.rich('exercise.theory.theoryReview', {
                            concept: concept.concept_name,
                            highlight: (chunks) => <span className="font-medium text-slate-900">{chunks}</span>
                        })}
                    </p>
                </div>

                <div className="grid gap-6 md:gap-8 pb-12 md:grid-cols-1">
                    <Card className="overflow-hidden rounded-[20px] border-slate-200 shadow-sm bg-white p-5 sm:p-8 md:p-10 relative">
                        {loadingTheory ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center min-h-[300px]">
                                <HiLightBulb className="h-8 w-8 text-slate-400 mb-4 animate-pulse" />
                                <TextShimmer className="text-lg font-medium text-slate-400" duration={1.5}>
                                    {t('exercise.theory.generatingExplanationFor', { concept: concept.concept_name })}
                                </TextShimmer>
                            </div>
                        ) : theory ? (
                            <>
                                <div className="mb-8">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg md:text-xl font-medium text-slate-900 border-b border-slate-100 pb-4">
                                        <HiBookOpen className="h-5 w-5 text-slate-900" /> {t('exercise.theory.basicTheory')}
                                    </h3>
                                    <div className="text-base md:text-lg leading-relaxed text-slate-700">
                                        <DynamicMarkdownRenderer content={theory.content} />
                                    </div>
                                </div>

                                {theory.examples && theory.examples.length > 0 && (
                                    <div>
                                        <h3 className="mb-5 md:mb-6 flex items-center gap-2 text-base md:text-lg font-medium text-slate-900">
                                            <HiLightBulb className="h-5 w-5 text-slate-900" /> {t('exercise.theory.illustration')}
                                        </h3>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {theory.examples.map((ex: string, idx: number) => (
                                                <div key={idx} className="rounded-xl bg-slate-50 border border-slate-200 p-5 md:p-6 transition-colors hover:border-slate-300 shadow-sm">
                                                    <div className="mb-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-slate-900">{t('exercise.theory.example', { index: idx + 1 })}</div>
                                                    <div className="text-sm md:text-base text-slate-700 leading-relaxed">
                                                        <DynamicMarkdownRenderer content={ex} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-12 text-center text-slate-500">Failed to load theory</div>
                        )}
                    </Card>

                    <div className="flex justify-center pt-2 md:pt-4 px-4 flex-col items-center gap-3">
                        {loadingExercise && !loadingTheory && (
                            <TextShimmer className="text-sm font-medium text-slate-400" duration={1.2}>
                                Preparing your exercise...
                            </TextShimmer>
                        )}
                        <Button
                            onClick={() => setShowTheory(false)}
                            disabled={loadingExercise}
                            className="w-full md:w-auto h-12 md:h-11 min-h-[48px] md:min-w-[200px] rounded-full bg-teal-600 px-8 text-sm md:text-base font-medium text-white transition-all active:scale-[0.98] hover:bg-teal-700 shadow-md disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {loadingExercise ? t('exercise.loadingTitle') : t('exercise.theory.startExercise')}
                            {!loadingExercise && <HiArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.push(ADAPTIVE_ROUTES.dashboard)}
                        className="font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md px-4 min-h-[44px] border border-transparent hover:border-slate-200"
                    >
                        <HiOutlineX className="mr-2 h-4 w-4" />
                        {t('quit')}
                    </Button>
                    <div className="h-6 w-px bg-slate-200" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{t('exercise.progress')}</span>
                        <div className="flex items-center gap-3">
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                                <div className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <span className="text-xs font-mono text-slate-600">{concept.step}/{concept.max_steps}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">{concept.concept_name}</span>
                </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="flex flex-col lg:col-span-8">
                    <Card className="flex-1 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-6 py-4 bg-slate-50/50">
                            <div className={`flex items-center gap-2 rounded-md ${bloomColor} px-2.5 py-1 box-border`}>
                                <div className="h-2 w-2 rounded-full bg-white opacity-80" />
                                <span className={`text-[10px] font-bold uppercase tracking-widest text-white`}>
                                    {t('exercise.bloomBadge', { level: concept.bloom_level, label: localizedBloomLabel })}
                                </span>
                            </div>
                            <span className="text-xs font-mono text-slate-500">
                                {t('exercise.stepCounter', { current: concept.step + 1, total: concept.max_steps })}
                            </span>
                        </div>

                        {loadingExercise ? (
                            <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-center">
                                <TextShimmer className="text-lg font-medium text-slate-500 mb-6" duration={1.2}>
                                    Constructing your challenge...
                                </TextShimmer>
                                <div className="grid gap-4 w-full max-w-[400px]">
                                    <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl" />
                                    <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl delay-75" />
                                    <div className="h-14 w-full bg-slate-100 animate-pulse rounded-xl delay-150" />
                                </div>
                            </div>
                        ) : exercise ? (
                            <CardContent className="p-5 sm:p-6 md:p-10">
                                <h2 className="mb-8 text-xl font-medium leading-relaxed text-slate-900 tracking-tight">
                                    <DynamicMarkdownRenderer content={exercise.question} />
                                </h2>

                                <div className="grid gap-3 sm:gap-4">
                                    {optionEntries.map(([key, value], idx) => (
                                        <button
                                            type="button"
                                            key={key}
                                            onClick={() => setSelectedOption(key)}
                                            className={`group relative flex w-full text-left cursor-pointer items-start gap-4 rounded-[12px] border p-4 sm:p-5 transition-all duration-200 ${selectedOption === key
                                                ? 'border-teal-600 bg-teal-50 shadow-sm'
                                                : 'border-slate-200 bg-white hover:border-slate-400 active:scale-[0.99]'
                                                }`}
                                        >
                                            {selectedOption === key && <div className="absolute inset-0 bg-teal-500/10 rounded-xl" />}
                                            <div className={`
                                                w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0 transition-colors
                                                ${selectedOption === key
                                                    ? 'border-teal-600 bg-teal-600 text-white'
                                                    : 'border-slate-300 text-slate-500 group-hover:border-slate-400'}
                                            `}>
                                                {String.fromCharCode(65 + idx)}
                                            </div>
                                            <span
                                                className={`text-base leading-relaxed transition-colors duration-200 ${selectedOption === key ? 'font-medium text-slate-900' : 'text-slate-700'
                                                    }`}
                                            >
                                                <DynamicMarkdownRenderer content={value} />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        ) : (
                            <div className="py-12 text-center text-slate-500">Exercise failed to load</div>
                        )}
                    </Card>
                </div>

                <div className="flex flex-col gap-6 lg:col-span-4">
                    <div className="relative overflow-hidden rounded-[20px] bg-slate-50 border border-slate-200 p-5 sm:p-6 text-slate-900 shadow-sm">
                        <div className="relative z-10">
                            <h3 className="mb-3 text-base font-semibold tracking-tight flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
                                {t('focusModeTitle')}
                            </h3>
                            <p className="mb-6 text-sm text-slate-600 leading-relaxed">
                                {t('exercise.focusModeContext', {
                                    concept: concept.concept_name,
                                    level: localizedBloomLabel,
                                })}
                            </p>
                            <Button
                                className="w-full min-h-[48px] h-12 sm:h-11 sm:min-h-[44px] rounded-full bg-teal-600 py-2 text-sm md:text-base font-medium text-white transition-all active:scale-[0.98] sm:hover:scale-[1.02] hover:bg-teal-700 justify-center shadow-sm"
                                onClick={() => void handleSubmit()}
                                disabled={!selectedOption || submitting}
                            >
                                {submitting ? t('exercise.checking') : t('checkAnswer')}
                                {!submitting ? <HiArrowRight className="ml-2 h-4 w-4" /> : null}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
