'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import Sidebar from '@/components/Sidebar';


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
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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



  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - giống như trang chính */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">RinKuzu</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {session ? (
                <>
                  <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                    All Quizzes
                  </Link>
                  
                  {/* User Menu */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1">
                        <button 
                          onClick={() => signOut()}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/login">
                    <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden border-t border-gray-100 py-4">
              <div className="space-y-2">
                {session ? (
                  <>
                    <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      All Quizzes
                    </Link>
                    <button 
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Sign In
                    </Link>
                    <Link href="/register" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        currentPath={pathname}
      />

      {/* Main Content */}
      <main className={`py-8 transition-all duration-300 ${
        session && isSidebarOpen ? 'ml-64' : session ? 'ml-16' : ''
      } max-w-none px-4 sm:px-6 lg:px-8`}>
        {status === 'loading' ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : !session ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Redirecting to login...</div>
          </div>
        ) : (
        <>
        <div className="max-w-6xl mx-auto">
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
                          
                          <div className="flex flex-col space-y-2">
                            <Link href={`/history/${attempt._id}`}>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700 w-full"
                              >
                                📊 Xem Chi Tiết
                              </Button>
                            </Link>
                            <Link href={`/quiz/${attempt.quiz.slug}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                🔄 Làm Lại
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        </div>
        </>
        )}
      </main>


    </div>
  );
} 