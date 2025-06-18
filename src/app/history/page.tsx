'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';

interface AttemptHistory {
  _id: string;
  score: number;
  takenAt: string;
  quiz: {
    title: string;
    slug: string;
    description?: string;
    totalQuestions: number;
  };
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [attempts, setAttempts] = useState<AttemptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    
    if (session?.user) {
      fetchAttempts();
    }
  }, [session, status, router]);

  const fetchAttempts = async () => {
    try {
      const response = await fetch('/api/user/attempts');
      const data = await response.json();

      if (data.success) {
        setAttempts(data.data);
      } else {
        setError(data.error || 'Failed to fetch quiz history');
      }
    } catch (error) {
      setError('Failed to load quiz history');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return { text: 'Excellent', emoji: '🏆' };
    if (score >= 80) return { text: 'Great', emoji: '🎯' };
    if (score >= 70) return { text: 'Good', emoji: '👍' };
    if (score >= 60) return { text: 'Pass', emoji: '📚' };
    return { text: 'Needs Work', emoji: '💪' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quiz history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                RinKuzu
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/create">
                <Button variant="outline">Create Quiz</Button>
              </Link>
              <Link href="/pending">
                <Button variant="outline">My Quizzes</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Quiz History</h1>
          <p className="mt-2 text-gray-600">
            Your completed quiz attempts and scores
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {attempts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Quiz History Yet
              </h3>
              <p className="text-gray-600 mb-6">
                You haven't taken any quizzes yet. Start your learning journey!
              </p>
              <Link href="/">
                <Button>Browse Quizzes</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="text-center py-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {attempts.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Attempts</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-6">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)}%
                  </div>
                  <div className="text-sm text-gray-600">Average Score</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-6">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.max(...attempts.map(a => a.score))}%
                  </div>
                  <div className="text-sm text-gray-600">Best Score</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-6">
                  <div className="text-2xl font-bold text-orange-600">
                    {attempts.filter(a => a.score >= 80).length}
                  </div>
                  <div className="text-sm text-gray-600">High Scores (80%+)</div>
                </CardContent>
              </Card>
            </div>

            {/* Attempts List */}
            <div className="space-y-4">
              {attempts.map((attempt) => {
                const badge = getPerformanceBadge(attempt.score);
                return (
                  <Card key={attempt._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {attempt.quiz.title}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(attempt.score)}`}>
                              {badge.emoji} {badge.text}
                            </span>
                          </div>
                          
                          {attempt.quiz.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {attempt.quiz.description}
                            </p>
                          )}
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>📝 {attempt.quiz.totalQuestions} questions</span>
                            <span>🕒 {formatDate(new Date(attempt.takenAt))}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className={`text-3xl font-bold ${getScoreColor(attempt.score).split(' ')[0]}`}>
                              {attempt.score}%
                            </div>
                          </div>
                          
                          <Link href={`/quiz/${attempt.quiz.slug}`}>
                            <Button variant="outline" size="sm">
                              Retake
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 