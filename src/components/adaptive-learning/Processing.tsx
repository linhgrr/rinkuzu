'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { HiCheck, HiOutlineSparkles, HiOutlineChip } from '@/components/icons';

const STEPS = [
    { id: 1, label: 'Reading PDF content' },
    { id: 2, label: 'Extracting key concepts' },
    { id: 3, label: 'Building Knowledge Graph' },
    { id: 4, label: 'Generating learning path' },
    { id: 5, label: 'Preparing first exercise' },
];

export default function AdaptiveLearningProcessing() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const totalDuration = 5000;
        const interval = 50;
        const increment = (100 / (totalDuration / interval));

        let currentProgress = 0;
        const timer = setInterval(() => {
            currentProgress += increment;
            if (currentProgress > 100) currentProgress = 100;

            setProgress(currentProgress);

            // Map progress to steps (approximate)
            const step = Math.min(Math.ceil((currentProgress / 100) * STEPS.length), STEPS.length);
            setCurrentStep(step);

            if (currentProgress >= 100) {
                clearInterval(timer);
                setTimeout(() => {
                    router.push('/adaptive-learning/exercise/ex-01');
                }, 800);
            }
        }, interval);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-lg">
                {/* Main Card */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden relative border border-gray-100">
                    {/* Top Gradient */}
                    <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                    <div className="p-8 text-center">
                        <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                            <HiOutlineChip className="w-10 h-10 text-indigo-600" />
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Material</h2>
                        <p className="text-gray-500 mb-8">Please wait while our AI builds your personalized curriculum.</p>

                        {/* Steps List */}
                        <div className="space-y-4 text-left max-w-sm mx-auto mb-8">
                            {STEPS.map((step) => {
                                const isCompleted = step.id < currentStep;
                                const isActive = step.id === currentStep;

                                return (
                                    <div key={step.id} className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${isCompleted ? 'bg-green-500 border-green-500 text-white' :
                                                isActive ? 'border-indigo-600 bg-white' :
                                                    'border-gray-200 bg-gray-50'
                                            }`}>
                                            {isCompleted && <HiCheck className="w-3 h-3" />}
                                            {isActive && <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />}
                                        </div>
                                        <span className={`text-sm font-medium transition-colors ${isCompleted ? 'text-gray-900' :
                                                isActive ? 'text-indigo-600' :
                                                    'text-gray-400'
                                            }`}>
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress Bar */}
                        <div className="relative pt-4">
                            <div className="flex justify-between text-xs font-semibold text-gray-400 mb-2">
                                <span>PROGRESS</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-100 ease-linear shadow-sm"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tip */}
                <div className="mt-8 flex items-start gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-600 max-w-md mx-auto">
                    <HiOutlineSparkles className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    <p>
                        <strong>Did you know?</strong> Adaptive learning adjusts the difficulty of questions in real-time based on your performance.
                    </p>
                </div>
            </div>
        </div>
    );
}
