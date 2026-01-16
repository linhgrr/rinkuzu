'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navigation from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/shared/constants';
import ReviewCard from '@/components/ReviewCard';
import { Card } from '@/components/ui/Card';
import {
    HiOutlineEmojiHappy,
    HiOutlineCheckCircle,
    HiOutlineHome,
    HiOutlineRefresh
} from 'react-icons/hi';

interface Question {
    _id: string; // QuestionProgress ID if needed, or we use questionId
    questionId: string;
    quizSlug: string;
    questionRef: {
        text: string;
        options: string[];
        correctIndexes: number[];
    };
    srsLevel: number;
}

export default function ReviewPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [completed, setCompleted] = useState(false);
    const [stats, setStats] = useState({ xpGained: 0, reviewedCount: 0 });

    useEffect(() => {
        if (status === 'authenticated') {
            fetchDueReviews();
        } else if (status === 'unauthenticated') {
            router.push(ROUTES.LOGIN);
        }
    }, [status, router]);

    const fetchDueReviews = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/review/due');
            const data = await res.json();
            if (data.data) {
                setQuestions(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch reviews', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReviewSubmit = async (rating: 'fail' | 'hard' | 'good' | 'easy') => {
        const currentQ = questions[currentIndex];

        try {
            const res = await fetch('/api/review/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: currentQ.questionId,
                    quizSlug: currentQ.quizSlug,
                    rating,
                    questionRef: currentQ.questionRef
                })
            });

            const data = await res.json();

            setStats(prev => ({
                xpGained: prev.xpGained + (data.data?.userProgress?.xpGained || 0),
                reviewedCount: prev.reviewedCount + 1
            }));

            if (currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setCompleted(true);
            }
        } catch (error) {
            console.error('Error submitting review', error);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl mb-4"></div>
                    <div className="h-4 bg-gray-200 w-32 rounded"></div>
                </div>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen bg-[#f5f5f7]">
                <Navigation />
                <div className="max-w-2xl mx-auto px-4 py-12">
                    <Card className="p-8 text-center animate-fadeInUp">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <HiOutlineEmojiHappy className="text-4xl text-green-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-[#1d1d1f] mb-4">Session Complete!</h1>
                        <p className="text-xl text-[#86868b] mb-8">
                            You reviewed {stats.reviewedCount} questions and earned {stats.xpGained} XP.
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Button onClick={() => router.push('/')} variant="default" size="lg" className="flex items-center gap-2">
                                <HiOutlineHome className="w-5 h-5" /> Back to Dashboard
                            </Button>
                            <Button onClick={() => window.location.reload()} variant="outline" size="lg" className="flex items-center gap-2">
                                <HiOutlineRefresh className="w-5 h-5" /> Review More
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen bg-[#f5f5f7]">
                <Navigation />
                <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                    <Card className="p-12">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HiOutlineCheckCircle className="w-8 h-8 text-[#0071e3]" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2">All Caught Up!</h2>
                        <p className="text-[#86868b] mb-6">No questions specific reviews due right now.</p>
                        <Button onClick={() => router.push('/')}>Go Home</Button>
                    </Card>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col">
            <Navigation />

            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-2xl mb-4 flex justify-between items-center text-sm font-medium text-[#86868b]">
                    <span>Question {currentIndex + 1} of {questions.length}</span>
                    <span>XP: {stats.xpGained}</span>
                </div>

                <ReviewCard
                    key={currentQuestion._id}
                    question={currentQuestion.questionRef}
                    onResult={handleReviewSubmit}
                />
            </div>
        </div>
    );
}
