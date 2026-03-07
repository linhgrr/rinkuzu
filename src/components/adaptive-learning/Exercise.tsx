'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiArrowRight, HiOutlineX, HiCheck, HiBookOpen, HiLightBulb } from '@/components/icons';
import { getNextExercise, submitAnswer } from './api-client';
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import type { BloomLevel, Exercise } from './types';

interface ExerciseProps {
    sessionId: string;
}

const BLOOM_COLORS: Record<BloomLevel, string> = {
    Remember: 'bg-blue-500',
    Understand: 'bg-green-500',
    Apply: 'bg-yellow-500',
    Analyze: 'bg-purple-500',
    Evaluate: 'bg-red-500',
    Create: 'bg-indigo-500',
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
    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTheory, setShowTheory] = useState(false);

    const loadingRef = useRef(false);

    const loadExercise = useCallback(async () => {
        if (loadingRef.current) return;   // ← prevent duplicate concurrent calls
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        setSelectedOption(null);
        try {
            const nextExercise = await getNextExercise(sessionId);
            setExercise(nextExercise);
            if (nextExercise.theory) {
                setShowTheory(true);
            } else {
                setShowTheory(false);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : t('exercise.failedToLoadExercise');
            setError(message);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [sessionId, t]);

    useEffect(() => {
        void loadExercise();
    }, [loadExercise]);

    const handleSubmit = useCallback(async () => {
        if (!selectedOption || !exercise) {
            return;
        }
        setSubmitting(true);
        try {
            const result = await submitAnswer(sessionId, selectedOption);
            localStorage.setItem('al_last_result', JSON.stringify(result));
            localStorage.setItem('al_last_exercise', JSON.stringify(exercise));
            router.push(`/adaptive-learning/result/${sessionId}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : t('exercise.failedToSubmitAnswer');
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }, [exercise, router, selectedOption, sessionId, t]);

    const progressPercent = useMemo(() => {
        if (!exercise || exercise.max_steps <= 0) {
            return 0;
        }
        return (exercise.step / exercise.max_steps) * 100;
    }, [exercise]);

    const bloomColor = useMemo(() => {
        if (!exercise) {
            return 'bg-gray-400';
        }
        return BLOOM_COLORS[exercise.bloom_label] || 'bg-gray-400';
    }, [exercise]);

    const localizedBloomLabel = useMemo(() => {
        if (!exercise) {
            return '';
        }
        return t(`bloom.${BLOOM_TRANSLATION_KEYS[exercise.bloom_label]}`);
    }, [exercise, t]);

    const optionEntries = useMemo(() => {
        if (!exercise) {
            return [];
        }
        return Object.entries(exercise.options);
    }, [exercise]);

    if (loading) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                    <p className="text-base font-medium text-gray-900">{t('exercise.loadingTitle')}</p>
                    <p className="mt-1 text-sm text-gray-500">{t('exercise.loadingSubtitle')}</p>
                </div>
            </div>
        );
    }

    if (error || !exercise) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
                <div className="space-y-4 text-center">
                    <p className="text-lg text-red-500">{error || t('exercise.noExerciseAvailable')}</p>
                    <div className="flex justify-center gap-3">
                        <Button variant="outline" className="border-gray-200 hover:bg-gray-50 text-gray-700" onClick={() => router.push('/adaptive-learning')}>
                            {t('exercise.backToDashboard')}
                        </Button>
                        <Button className="bg-black hover:bg-gray-800 shadow-none text-white transition-colors" onClick={() => void loadExercise()}>{t('exercise.tryAgain')}</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (showTheory && exercise?.theory) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col">
                <div className="mb-8 md:mb-10 text-center px-4">
                    <div className="mx-auto mb-5 md:mb-6 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-[18px] bg-gray-50/50 border border-gray-100 text-gray-900 shadow-sm">
                        <HiBookOpen className="h-6 w-6 md:h-8 md:w-8" />
                    </div>
                    <h1 className="mb-2 text-xl font-semibold tracking-tight text-gray-900 md:text-3xl">{t('exercise.theory.reviewKnowledge')}</h1>
                    <p className="text-sm md:text-base text-gray-500">
                        {t.rich('exercise.theory.theoryReview', {
                            concept: (chunks) => <span className="font-medium text-gray-900">{exercise.concept_name}</span>
                        })}
                    </p>
                </div>

                <div className="grid gap-6 md:gap-8 pb-12 md:grid-cols-1">
                    <Card className="overflow-hidden rounded-xl border-gray-200 shadow-sm bg-white p-5 sm:p-8 md:p-10">
                        <div className="mb-8">
                            <h3 className="mb-4 flex items-center gap-2 text-lg md:text-xl font-medium text-gray-900 border-b border-gray-50 pb-4">
                                <HiBookOpen className="h-5 w-5 text-blue-500" /> {t('exercise.theory.basicTheory')}
                            </h3>
                            <div className="text-base md:text-lg leading-relaxed text-gray-700">
                                <DynamicMarkdownRenderer content={exercise.theory.content} />
                            </div>
                        </div>

                        {exercise.theory.examples && exercise.theory.examples.length > 0 && (
                            <div>
                                <h3 className="mb-5 md:mb-6 flex items-center gap-2 text-base md:text-lg font-medium text-gray-900">
                                    <HiLightBulb className="h-5 w-5 text-yellow-500" /> {t('exercise.theory.illustration')}
                                </h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {exercise.theory.examples.map((ex: string, idx: number) => (
                                        <div key={idx} className="rounded-xl bg-gray-50/80 border border-gray-100 p-5 md:p-6 transition-colors hover:border-gray-200">
                                            <div className="mb-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-yellow-400">{t('exercise.theory.example', { index: idx + 1 })}</div>
                                            <div className="text-sm md:text-base text-gray-700 leading-relaxed">
                                                <DynamicMarkdownRenderer content={ex} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    <div className="flex justify-center pt-2 md:pt-4 px-4">
                        <Button
                            onClick={() => setShowTheory(false)}
                            className="w-full md:w-auto h-12 md:h-11 min-h-[48px] md:min-w-[200px] rounded-full bg-black px-8 text-sm md:text-base font-medium text-white transition-all active:scale-[0.98] hover:bg-gray-800 shadow-md"
                        >
                            {t('exercise.theory.startExercise')}
                            <HiArrowRight className="ml-2 h-4 w-4" />
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
                        size="sm"
                        onClick={() => router.push('/adaptive-learning')}
                        className="font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md px-3 border border-transparent hover:border-gray-200"
                    >
                        <HiOutlineX className="mr-2 h-4 w-4" />
                        {t('quit')}
                    </Button>
                    <div className="h-6 w-px bg-gray-200" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t('exercise.progress')}</span>
                        <div className="flex items-center gap-3">
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-100 border border-gray-200">
                                <div className="h-full rounded-full bg-gray-900 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <span className="text-xs font-mono text-gray-600">{exercise.step}/{exercise.max_steps}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md">{exercise.concept_name}</span>
                </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="flex flex-col lg:col-span-8">
                    <Card className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 sm:px-6 py-4 bg-gray-50/50">
                            <div className="flex items-center gap-2 rounded-md bg-white border border-gray-200 px-2.5 py-1 box-border">
                                <div className={`h-2 w-2 rounded-full ${bloomColor}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-widest text-gray-700`}>
                                    {t('exercise.bloomBadge', { level: exercise.bloom_level, label: localizedBloomLabel })}
                                </span>
                            </div>
                            <span className="text-xs font-mono text-gray-500">
                                {t('exercise.stepCounter', { current: exercise.step + 1, total: exercise.max_steps })}
                            </span>
                        </div>

                        <CardContent className="p-5 sm:p-6 md:p-10">
                            <h2 className="mb-8 text-xl font-medium leading-relaxed text-gray-900 tracking-tight">
                                <DynamicMarkdownRenderer content={exercise.question} />
                            </h2>

                            <div className="grid gap-3 sm:gap-4">
                                {optionEntries.map(([key, value]) => (
                                    <div
                                        key={key}
                                        onClick={() => setSelectedOption(key)}
                                        className={`group relative flex cursor-pointer items-start gap-4 rounded-[12px] border p-4 sm:p-5 transition-all duration-200 ${selectedOption === key
                                            ? 'border-[#0071e3] bg-[#0071e3]/5 shadow-sm'
                                            : 'border-gray-200 bg-white hover:border-[#c7c7c7] active:scale-[0.99]'
                                            }`}
                                    >
                                        <div
                                            className={`flex h-6 w-6 mt-0.5 flex-shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${selectedOption === key
                                                ? 'border-[#0071e3] bg-[#0071e3] text-white'
                                                : 'border-gray-300 bg-gray-50 group-hover:border-gray-400'
                                                }`}
                                        >
                                            {selectedOption === key ? (
                                                <HiCheck className="h-4 w-4" />
                                            ) : (
                                                <span className="text-[10px] font-mono font-medium text-gray-500">{key}</span>
                                            )}
                                        </div>
                                        <span
                                            className={`text-base leading-relaxed transition-colors duration-200 ${selectedOption === key ? 'font-medium text-gray-900' : 'text-[#1d1d1f]'
                                                }`}
                                        >
                                            <DynamicMarkdownRenderer content={value} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-6 lg:col-span-4">
                    <div className="relative overflow-hidden rounded-xl bg-[#f5f5f7] border border-gray-200/50 p-5 sm:p-6 text-[#1d1d1f]">
                        <div className="relative z-10">
                            <h3 className="mb-3 text-base font-semibold tracking-tight flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#0071e3] animate-pulse" />
                                {t('focusModeTitle')}
                            </h3>
                            <p className="mb-6 text-sm text-[#86868b] leading-relaxed">
                                {t('exercise.focusModeContext', {
                                    concept: exercise.concept_name,
                                    level: localizedBloomLabel,
                                })}
                            </p>
                            <Button
                                className="w-full min-h-[48px] h-12 sm:h-11 sm:min-h-[44px] rounded-full bg-[#0071e3] py-2 text-sm md:text-base font-medium text-white transition-all active:scale-[0.98] sm:hover:scale-[1.02] hover:bg-[#0077ED] justify-center shadow-sm"
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
