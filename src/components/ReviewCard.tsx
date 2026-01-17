'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface ReviewCardProps {
    question: {
        text: string;
        options: string[];
        correctIndexes: number[];
    };
    onResult: (rating: 'fail' | 'hard' | 'good' | 'easy') => void;
}

import { HiCheck } from '@/components/icons';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function ReviewCard({ question, onResult }: ReviewCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    useKeyboardShortcuts({
        ' ': (e) => {
            e.preventDefault();
            setIsFlipped(prev => !prev);
        },
        '1': () => isFlipped && onResult('fail'),
        '2': () => isFlipped && onResult('hard'),
        '3': () => isFlipped && onResult('good'),
        '4': () => isFlipped && onResult('easy'),
    });


    return (
        <div className="relative w-full max-w-2xl perspective-1000">
            <div
                className={`relative w-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''
                    }`}
                style={{ minHeight: 'min(400px, 70vh)' }}
            >
                {/* Front Face */}
                {!isFlipped && (
                    <Card
                        className="absolute inset-0 w-full h-full backface-hidden flex flex-col items-center justify-center p-6 md:p-8 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setIsFlipped(true)}
                    >
                        <div className="text-center">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-4">
                                Question
                            </span>
                            <h3 className="text-xl md:text-2xl font-medium text-[#1d1d1f] mb-8 leading-relaxed">
                                {question.text}
                            </h3>
                            <p className="text-[#86868b] text-sm animate-pulse">
                                Tap to see answer
                            </p>
                        </div>
                    </Card>
                )}

                {/* Back Face (Answer) */}
                {isFlipped && (
                    <Card className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 flex flex-col p-4 md:p-8">
                        <div className="flex-1 overflow-y-auto">
                            {/* Question Text Repeated Small */}
                            <p className="text-xs md:text-sm text-[#86868b] mb-4 md:mb-6 pb-3 md:pb-4 border-b">
                                {question.text}
                            </p>

                            {/* Options / Answer */}
                            <div className="space-y-2 md:space-y-3">
                                {question.options.map((opt, idx) => {
                                    const isCorrect = question.correctIndexes.includes(idx);
                                    return (
                                        <div
                                            key={idx}
                                            className={`p-3 md:p-4 rounded-xl border ${isCorrect
                                                ? 'bg-green-50 border-green-200 text-green-800'
                                                : 'bg-gray-50 border-gray-100 text-gray-500'
                                                }`}
                                        >
                                            <div className="flex items-start">
                                                <div className={`w-5 h-5 mt-0.5 rounded-full border flex items-center justify-center mr-3 flex-shrink-0 ${isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                                                    }`}>
                                                    {isCorrect && <HiCheck className="w-3 h-3" strokeWidth={3} />}
                                                </div>
                                                <span className={`text-sm md:text-base ${isCorrect ? 'font-medium' : ''}`}>{opt}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Rating Buttons */}
                        <div className="mt-4 md:mt-8 grid grid-cols-4 gap-2 md:gap-3 pt-4 border-t">
                            <button
                                className="flex flex-col items-center p-2 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors group min-h-[68px]"
                                onClick={() => onResult('fail')}
                            >
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                    <span className="font-bold text-sm md:text-base">1</span>
                                </div>
                                <span className="text-[10px] md:text-xs font-medium text-red-600">Again</span>
                            </button>

                            <button
                                className="flex flex-col items-center p-2 rounded-lg hover:bg-orange-50 active:bg-orange-100 transition-colors group min-h-[68px]"
                                onClick={() => onResult('hard')}
                            >
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                    <span className="font-bold text-sm md:text-base">2</span>
                                </div>
                                <span className="text-[10px] md:text-xs font-medium text-orange-600">Hard</span>
                            </button>

                            <button
                                className="flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors group min-h-[68px]"
                                onClick={() => onResult('good')}
                            >
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                    <span className="font-bold text-sm md:text-base">3</span>
                                </div>
                                <span className="text-[10px] md:text-xs font-medium text-blue-600">Good</span>
                            </button>

                            <button
                                className="flex flex-col items-center p-2 rounded-lg hover:bg-green-50 active:bg-green-100 transition-colors group min-h-[68px]"
                                onClick={() => onResult('easy')}
                            >
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-1 md:mb-2 group-hover:scale-110 transition-transform">
                                    <span className="font-bold text-sm md:text-base">4</span>
                                </div>
                                <span className="text-[10px] md:text-xs font-medium text-green-600">Easy</span>
                            </button>
                        </div>
                    </Card>
                )}

                <style jsx global>{`
          .perspective-1000 {
            perspective: 1000px;
          }
          .transform-style-3d {
            transform-style: preserve-3d;
          }
          .backface-hidden {
            backface-visibility: hidden;
          }
          .rotate-y-180 {
            transform: rotateY(180deg);
          }
        `}</style>
            </div>
        </div>
    );
}
