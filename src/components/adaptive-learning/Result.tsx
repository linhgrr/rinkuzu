'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    HiCheck,
    HiOutlineX,
    HiArrowRight,
    HiOutlineHome,
    HiOutlineSparkles,
    HiOutlineRefresh,
    HiOutlineChatAlt
} from '@/components/icons';
import { mockExercises } from './mock-data';
import AdaptiveLearningChatbot from './Chatbot';

interface ResultProps {
    exerciseId: string;
}

export default function AdaptiveLearningResult({ exerciseId }: ResultProps) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const exercise = mockExercises.find(e => e.id === exerciseId) || mockExercises[0];
    const [isChatOpen, setIsChatOpen] = useState(false);
    const isCorrect = true;

    const handleNext = () => {
        // Determine next route (mock logic)
        const nextId = 'ex-02';
        if (exercise.id === 'ex-04') {
            router.push('/adaptive-learning');
        } else {
            const idx = mockExercises.findIndex(e => e.id === exerciseId);
            const next = mockExercises[idx + 1];
            router.push(next ? `/adaptive-learning/exercise/${next.id}` : '/adaptive-learning');
        }
    };

    return (
        <div className="max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center items-center py-8">

            <div className="w-full text-center mb-8">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 shadow-xl ring-8 ring-white ${isCorrect ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-red-400 to-red-600'
                    }`}>
                    {isCorrect ? <HiCheck className="w-12 h-12 text-white" /> : <HiOutlineX className="w-12 h-12 text-white" />}
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    {isCorrect ? t('result.correctTitle') : t('result.incorrectTitle')}
                </h1>
                <p className="text-gray-500 text-lg">
                    {isCorrect ? t('result.correctDescription') : t('result.incorrectDescription')}
                </p>
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Explanation Card */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-0 shadow-lg overflow-hidden bg-white">
                        <div className={`h-2 ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-gray-900">{t('result.explanationTitle')}</h3>
                        </CardHeader>
                        <CardContent className="p-8">
                            <p className="text-gray-700 text-lg leading-relaxed mb-6">
                                {exercise.explanation}
                            </p>
                            {exercise.correctAnswer && (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                                    <HiCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="block text-sm font-bold text-green-800 uppercase tracking-wide mb-1">{t('result.correctAnswerLabel')}</span>
                                        <span className="text-green-900 font-medium font-mono text-lg">{exercise.correctAnswer}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Button
                            variant="ghost"
                            className="flex-1 h-14 text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200"
                            onClick={() => router.push('/adaptive-learning')}
                        >
                            <HiOutlineHome className="w-5 h-5 mr-2" />
                            {t('result.dashboard')}
                        </Button>
                        <Button
                            className="flex-[2] h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl text-lg font-semibold"
                            onClick={handleNext}
                        >
                            {t('result.continueJourney')}
                            <HiArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </div>
                </div>

                {/* AI Assistant Side Panel */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-3xl p-6 shadow-xl text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-4 text-2xl">
                            🤖
                        </div>
                        <h3 className="font-bold text-xl mb-2">{t('result.stillConfused')}</h3>
                        <p className="text-indigo-200 text-sm mb-6">
                            {t('result.aiTutorDescription')}
                        </p>
                        <Button
                            className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-4 rounded-xl"
                            onClick={() => setIsChatOpen(true)}
                        >
                            <HiOutlineChatAlt className="w-5 h-5 mr-2" />
                            {t('result.chatWithTutor')}
                        </Button>
                    </div>

                    {/* Quick Stats */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">{t('result.sessionStats')}</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('result.timeTaken')}</span>
                                <span className="font-mono font-medium">{t('result.timeTakenValue', { minutes: 1, seconds: 30 })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('result.xpEarned')}</span>
                                <span className="font-bold text-yellow-600">{t('result.xpEarnedValue', { xp: 15 })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">{t('result.streak')}</span>
                                <span className="font-bold text-orange-500">{t('result.streakValue', { count: 5 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AdaptiveLearningChatbot
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                context={`Exercise: ${exercise.title}. Question: ${exercise.question}`}
            />
        </div>
    );
}
