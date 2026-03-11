'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HiCheck, HiOutlineX, HiArrowRight, HiOutlineHome, HiOutlineChatAlt2 } from '@/components/icons';
import Image from 'next/image';
import type { Exercise, SubmitResult } from './types';
import { DynamicMarkdownRenderer } from '@/components/ui/DynamicMarkdownRenderer';
import AdaptiveLearningChatbot from './Chatbot';

interface ResultProps {
    sessionId: string;
}

export default function AdaptiveLearningResult({ sessionId }: ResultProps) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const [result, setResult] = useState<SubmitResult | null>(null);
    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        try {
            const savedResult = localStorage.getItem('al_last_result');
            const savedExercise = localStorage.getItem('al_last_exercise');
            if (savedResult) {
                setResult(JSON.parse(savedResult));
            }
            if (savedExercise) {
                setExercise(JSON.parse(savedExercise));
            }
        } catch {
            setResult(null);
            setExercise(null);
        }
    }, []);

    const isCorrect = result?.is_correct ?? false;
    const masteryPercent = useMemo(() => Math.round((result?.mastery_after ?? 0) * 100), [result]);
    const avgMasteryPercent = useMemo(() => Math.round((result?.avg_mastery ?? 0) * 100), [result]);
    const questionOptions = useMemo(() => {
        if (!exercise) return [];
        return Object.entries(exercise.options)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => value);
    }, [exercise]);
    const chatContext = useMemo(() => {
        if (!exercise || !result) return '';
        return `${t('chatbot.contextConcept')}: ${result.concept_name}\n${t('chatbot.contextQuestion')}: ${exercise.question}`;
    }, [exercise, result, t]);

    const handleNext = () => {
        if (!result) {
            return;
        }
        if (result.session_completed) {
            router.push('/adaptive-learning');
            return;
        }
        router.push(`/adaptive-learning/exercise/${sessionId}`);
    };

    if (!result || !exercise) {
        return (
            <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
                <div className="space-y-4 text-center">
                    <p className="text-sm font-medium text-slate-500">{t('result.noResultDataFound')}</p>
                    <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => router.push('/adaptive-learning')}>{t('exercise.backToDashboard')}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center py-8">
            {/* Navigation and Layout styling is now handled by layout.tsx and BottomNav.tsx respectively */}

            <div className="mb-6 flex w-full flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0 ${isCorrect ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                >
                    {isCorrect ? <HiCheck className="h-6 w-6" /> : <HiOutlineX className="h-6 w-6" />}
                </div>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        {isCorrect ? t('result.correctTitle') : t('result.incorrectTitle')}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {isCorrect ? t('result.correctDescription') : t('result.incorrectDescription')}
                    </p>
                </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card className="overflow-hidden border border-slate-200 rounded-[20px] bg-white shadow-sm">
                        <div className={`h-1.5 w-full ${isCorrect ? 'bg-slate-900' : 'bg-slate-300'}`} />
                        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3 px-6">
                            <h3 className="font-medium tracking-tight text-slate-900">{t('result.explanationTitle')}</h3>
                        </CardHeader>
                        <CardContent className="p-6">
                            <p className="mb-4 text-sm leading-relaxed text-slate-700">
                                <DynamicMarkdownRenderer content={result.explanation} />
                            </p>
                            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                                <HiCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-900" />
                                <div>
                                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        {t('result.correctAnswerLabel')}
                                    </span>
                                    <span className="text-sm font-medium text-slate-900">
                                        <DynamicMarkdownRenderer content={result.correct_option} />
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <Button
                                    className="flex items-center justify-center w-full h-11 gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 hover:shadow-sm"
                                    onClick={() => setIsChatOpen(true)}
                                >
                                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
                                        <Image
                                            src="/images/chatbot_icon.png"
                                            alt="Rin-chan avatar"
                                            width={28}
                                            height={28}
                                            className="rounded-full object-cover"
                                        />
                                    </span>
                                    <span>{t('result.chatWithTutor')}</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden border border-slate-200 rounded-[20px] bg-white shadow-sm">
                        <CardContent className="p-6">
                            <h3 className="mb-4 font-medium tracking-tight text-slate-900">{t('result.masteryUpdate')}</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                        {result.concept_name} <span className="text-slate-400">/</span> {t('bloomLevel', { level: result.bloom_level })}
                                    </span>
                                    <span className="font-mono text-slate-900 text-sm font-medium">{masteryPercent}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                                    <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${masteryPercent}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>{t('result.averageMastery', { value: avgMasteryPercent })}</span>
                                    <span className="font-mono">{t('result.stepLabel', { step: result.step })}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4 pb-6">
                        <Button
                            variant="ghost"
                            className="h-12 flex-1 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors font-semibold"
                            onClick={() => router.push('/adaptive-learning')}
                        >
                            <HiOutlineHome className="mr-2 h-5 w-5" />
                            {t('result.dashboard')}
                        </Button>
                        <Button
                            className="h-12 flex-[2] rounded-xl bg-teal-600 hover:bg-teal-700 focus:ring-teal-500 text-white shadow-md active:scale-[0.98] font-semibold transition-all"
                            onClick={handleNext}
                        >
                            {result.session_completed ? t('result.sessionCompleteCta') : t('result.nextExercise')}
                            <HiArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('result.sessionStats')}</h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <span className="text-xs font-medium text-slate-700">{t('result.statsCorrect')}</span>
                                <span className="font-mono text-sm text-slate-900">{result.stats.total_correct}</span>
                            </div>
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <span className="text-xs font-medium text-slate-700">{t('result.statsTotal')}</span>
                                <span className="font-mono text-sm text-slate-900">{result.stats.total_answered}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-700">{t('result.statsAccuracy')}</span>
                                <span className="font-mono text-sm text-slate-900">{Math.round(result.stats.accuracy * 100)}%</span>
                            </div>
                        </div>
                    </div>

                    {result.session_completed ? (
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-6 text-center text-slate-900 shadow-sm">
                            <div className="mb-3 flex justify-center">
                                <div className="rounded-full bg-slate-200 p-2 text-slate-900 border border-slate-300">
                                    <HiCheck className="h-5 w-5" />
                                </div>
                            </div>
                            <h3 className="mb-1 text-base font-medium">{t('result.sessionCompleteTitle')}</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {t('result.sessionCompleteDescription', { count: result.step })}
                            </p>
                        </div>
                    ) : null}
                </div>
            </div>

            <AdaptiveLearningChatbot
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                context={chatContext}
                question={exercise.question}
                options={questionOptions}
            />
        </div>
    );
}
