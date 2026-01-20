'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Card';
import {
    HiOutlineLightBulb,
    HiArrowRight,
    HiOutlineX,
    HiOutlineClock,
    HiOutlineFlag,
    HiCheck
} from '@/components/icons';
import { mockExercises } from './mock-data';

interface ExerciseProps {
    exerciseId: string;
}

export default function AdaptiveLearningExercise({ exerciseId }: ExerciseProps) {
    const router = useRouter();
    const t = useTranslations('adaptiveLearning');
    const exercise = mockExercises.find(e => e.id === exerciseId) || mockExercises[0];
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [answerInput, setAnswerInput] = useState('');
    const [showHint, setShowHint] = useState(false);

    // Mock progress
    const currentQuestionIndex = mockExercises.findIndex(e => e.id === exercise.id);
    const totalQuestions = mockExercises.length;
    const progressPercent = ((currentQuestionIndex) / totalQuestions) * 100;

    const handleSubmit = () => {
        router.push(`/adaptive-learning/result/${exerciseId}`);
    };

    const bloomKey = exercise.bloomLevel.toLowerCase();
    const bloomLabel = t(`bloom.${bloomKey}`);

    const getBloomColor = (level: string) => {
        switch (level) {
            case 'Remember': return 'bg-blue-100 text-blue-700';
            case 'Understand': return 'bg-green-100 text-green-700';
            case 'Apply': return 'bg-yellow-100 text-yellow-700';
            case 'Analyze': return 'bg-purple-100 text-purple-700';
            case 'Evaluate': return 'bg-red-100 text-red-700';
            case 'Create': return 'bg-indigo-100 text-indigo-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="max-w-5xl mx-auto min-h-[80vh] flex flex-col">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/adaptive-learning')} className="text-gray-500 hover:text-gray-900 font-medium">
                        <HiOutlineX className="w-5 h-5 mr-2" />
                        {t('quit')}
                    </Button>
                    <div className="h-6 w-px bg-gray-200" />
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('courseProgress')}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 text-gray-600 font-medium text-sm">
                    <HiOutlineClock className="w-4 h-4 text-indigo-500" />
                    <span>{t('timerValue', { time: '05:00' })}</span>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Question Area */}
                <div className="lg:col-span-8 flex flex-col">
                    <Card className="flex-1 border-gray-100 shadow-lg rounded-3xl overflow-hidden">
                        <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100 flex justify-between items-center">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${getBloomColor(exercise.bloomLevel)}`}>
                                {bloomLabel}
                            </span>
                            <span className="text-sm font-medium text-gray-400">{t('questionCount', { current: currentQuestionIndex + 1, total: totalQuestions })}</span>
                        </div>

                        <CardContent className="p-8 md:p-10">
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-8">
                                {exercise.question}
                            </h2>

                            {/* Hint Toggle */}
                            {exercise.hint && !showHint && (
                                <button
                                    onClick={() => setShowHint(true)}
                                    className="flex items-center gap-2 text-indigo-600 text-sm font-medium hover:underline mb-8"
                                >
                                    <HiOutlineLightBulb className="w-5 h-5" />
                                    {t('needHint')}
                                </button>
                            )}

                            {showHint && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-8 text-amber-900 text-sm animate-fadeIn">
                                    <span className="font-bold block mb-1">💡 {t('hintLabel')}</span>
                                    {exercise.hint}
                                </div>
                            )}

                            <div className="space-y-4">
                                {exercise.type === 'MCQ' && exercise.options && (
                                    <div className="grid gap-3">
                                        {exercise.options.map((option, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedOption(option)}
                                                className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center gap-4 ${selectedOption === option
                                                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
                                                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedOption === option ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 group-hover:border-indigo-400'
                                                    }`}>
                                                    {selectedOption === option ? <HiCheck className="w-5 h-5" /> : <span className="text-sm font-bold text-gray-400">{String.fromCharCode(65 + idx)}</span>}
                                                </div>
                                                <span className={`text-lg transition-colors ${selectedOption === option ? 'font-semibold text-indigo-900' : 'text-gray-700'}`}>
                                                    {option}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {exercise.type === 'FillBlank' && (
                                    <input
                                        type="text"
                                        value={answerInput}
                                        onChange={(e) => setAnswerInput(e.target.value)}
                                        placeholder={t('typeAnswerPlaceholder')}
                                        className="w-full text-xl p-4 border-b-2 border-gray-300 focus:border-indigo-600 bg-transparent outline-none transition-colors placeholder:text-gray-300"
                                        autoFocus
                                    />
                                )}

                                {exercise.type === 'ProblemSolving' && (
                                    <div className="space-y-4">
                                        <textarea
                                            value={answerInput}
                                            onChange={(e) => setAnswerInput(e.target.value)}
                                            placeholder={t('showWorkPlaceholder')}
                                            rows={8}
                                            className="w-full p-4 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 outline-none transition-all resize-none bg-gray-50 focus:bg-white"
                                        />
                                        <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <span className="font-medium text-gray-700">{t('finalAnswerLabel')}</span>
                                            <div className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 flex items-center">
                                                <input type="text" className="flex-1 outline-none text-gray-900 font-mono" placeholder={t('finalAnswerPlaceholder')} />
                                                <span className="text-gray-400 text-sm ml-2">{t('unitsLabel')}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {exercise.type === 'Essay' && (
                                    <textarea
                                        value={answerInput}
                                        onChange={(e) => setAnswerInput(e.target.value)}
                                        placeholder={t('analysisPlaceholder')}
                                        rows={12}
                                        className="w-full p-6 text-lg leading-relaxed border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-0 outline-none transition-all resize-none bg-white shadow-inner"
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar / Action Area */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-indigo-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">{t('focusModeTitle')}</h3>
                            <p className="text-indigo-200 text-sm mb-6">
                                {t('focusModeDescription', { level: bloomLabel.toLowerCase() })}
                            </p>
                            <Button
                                className="w-full bg-white text-indigo-900 hover:bg-indigo-50 border-0 font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all"
                                onClick={handleSubmit}
                                disabled={!selectedOption && !answerInput && exercise.type !== 'Essay'}
                            >
                                {t('checkAnswer')}
                                <HiArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                    </div>

                    <div className="text-center">
                        <button className="text-gray-400 text-sm hover:text-gray-600 flex items-center justify-center gap-2 mx-auto transition-colors">
                            <HiOutlineFlag className="w-4 h-4" />
                            {t('reportIssue')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
