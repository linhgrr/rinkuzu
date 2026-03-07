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
                    <p className="text-sm font-medium text-gray-500">{t('result.noResultDataFound')}</p>
                    <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => router.push('/adaptive-learning')}>{t('exercise.backToDashboard')}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col items-center justify-center py-8">
            {/* Force hide Top Navigation and Bottom Navigation when Result is mounted */}
            <style dangerouslySetInnerHTML={{
                __html: `
                nav, .md\\:hidden.fixed.bottom-0.left-0.right-0.z-50, .fixed.bottom-0.left-0.right-0.z-50 {
                    display: none !important;
                }
                main.pb-16 {
                    padding-bottom: 0 !important;
                }
            `}} />

            <div className="mb-6 flex w-full flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0 ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}
                >
                    {isCorrect ? <HiCheck className="h-6 w-6" /> : <HiOutlineX className="h-6 w-6" />}
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">
                        {isCorrect ? t('result.correctTitle') : t('result.incorrectTitle')}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {isCorrect ? t('result.correctDescription') : t('result.incorrectDescription')}
                    </p>
                </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card className="overflow-hidden border border-gray-200 rounded-lg bg-white">
                        <div className={`h-1.5 ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                        <CardHeader className="border-b border-gray-100 bg-gray-50/50 py-3">
                            <h3 className="font-medium tracking-tight text-gray-900">{t('result.explanationTitle')}</h3>
                        </CardHeader>
                        <CardContent className="p-6">
                            <p className="mb-4 text-sm leading-relaxed text-gray-700">
                                <DynamicMarkdownRenderer content={result.explanation} />
                            </p>
                            <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-4">
                                <HiCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-900" />
                                <div>
                                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                        {t('result.correctAnswerLabel')}
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">
                                        <DynamicMarkdownRenderer content={result.correct_option} />
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <Button
                                    className="flex items-center justify-center w-full h-11 gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 hover:shadow-sm"
                                    onClick={() => setIsChatOpen(true)}
                                >
                                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 border border-gray-200">
                                        <Image
                                            src="https://i.ibb.co/ZRYgc1tN/Gemini-Generated-Image-yjm06yyjm06yyjm0-removebg-preview.png"
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

                    <Card className="overflow-hidden border border-gray-200 rounded-lg bg-white">
                        <CardContent className="p-6">
                            <h3 className="mb-4 font-medium tracking-tight text-gray-900">{t('result.masteryUpdate')}</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                                        {result.concept_name} <span className="text-gray-400">/</span> {t('bloomLevel', { level: result.bloom_level })}
                                    </span>
                                    <span className="font-mono text-gray-900 text-sm font-medium">{masteryPercent}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 border border-gray-200">
                                    <div className="h-full rounded-full bg-gray-900 transition-all duration-500" style={{ width: `${masteryPercent}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{t('result.averageMastery', { value: avgMasteryPercent })}</span>
                                    <span className="font-mono">{t('result.stepLabel', { step: result.step })}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4 pb-6">
                        <Button
                            variant="ghost"
                            className="h-12 flex-1 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors font-semibold"
                            onClick={() => router.push('/adaptive-learning')}
                        >
                            <HiOutlineHome className="mr-2 h-5 w-5" />
                            {t('result.dashboard')}
                        </Button>
                        <Button
                            className="h-12 flex-[2] rounded-xl bg-[#0071e3] transition-all hover:bg-[#0077ED] text-white shadow-md hover:shadow-lg active:scale-[0.98] font-semibold"
                            onClick={handleNext}
                        >
                            {result.session_completed ? t('result.sessionCompleteCta') : t('result.nextExercise')}
                            <HiArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('result.sessionStats')}</h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <span className="text-xs font-medium text-gray-700">{t('result.statsCorrect')}</span>
                                <span className="font-mono text-sm text-gray-900">{result.stats.total_correct}</span>
                            </div>
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <span className="text-xs font-medium text-gray-700">{t('result.statsTotal')}</span>
                                <span className="font-mono text-sm text-gray-900">{result.stats.total_answered}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-700">{t('result.statsAccuracy')}</span>
                                <span className="font-mono text-sm text-gray-900">{Math.round(result.stats.accuracy * 100)}%</span>
                            </div>
                        </div>
                    </div>

                    {result.session_completed ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-900">
                            <div className="mb-3 flex justify-center">
                                <div className="rounded-full bg-gray-200 p-2 text-gray-900">
                                    <HiCheck className="h-5 w-5" />
                                </div>
                            </div>
                            <h3 className="mb-1 text-base font-medium">{t('result.sessionCompleteTitle')}</h3>
                            <p className="text-xs text-gray-500">
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
