'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function HomePage() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
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
                  <Link href="/quizzes" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Explore
                  </Link>
                  <Link href="/create" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Create
                  </Link>
                  {(session.user as any)?.role === 'admin' && (
                    <Link href="/admin/queue" className="text-gray-600 hover:text-gray-900 transition-colors">
                      Admin
                    </Link>
                  )}
                  
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
                        <Link href="/pending" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          My Quizzes
                        </Link>
                        <Link href="/history" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          Quiz History
                        </Link>
                        <hr className="my-1" />
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
                    <Link href="/quizzes" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Explore Quizzes
                    </Link>
                    <Link href="/create" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Create Quiz
                    </Link>
                    <Link href="/pending" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      My Quizzes
                    </Link>
                    <Link href="/history" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                      Quiz History
                    </Link>
                    {(session.user as any)?.role === 'admin' && (
                      <Link href="/admin/queue" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                        Admin Panel
                      </Link>
                    )}
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

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight">
            Transform PDFs into
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Interactive Quizzes</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Upload any PDF and watch AI instantly generate engaging quizzes. Perfect for educators who want to create assessments in seconds, not hours.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {session ? (
              <>
                <Link href="/create">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 px-8 py-4 text-lg">
                    Create Your First Quiz
                  </Button>
                </Link>
                <Link href="/quizzes">
                  <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-gray-300 text-gray-700 hover:bg-gray-50">
                    Explore Quizzes
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 px-8 py-4 text-lg">
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/quizzes">
                  <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-gray-300 text-gray-700 hover:bg-gray-50">
                    View Demo
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Trust indicators */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 mb-4">Trusted by educators worldwide</p>
            <div className="flex justify-center items-center space-x-8 opacity-60">
              <div className="text-2xl font-bold text-gray-400">AI-Powered</div>
              <div className="text-2xl font-bold text-gray-400">•</div>
              <div className="text-2xl font-bold text-gray-400">Instant Results</div>
              <div className="text-2xl font-bold text-gray-400">•</div>
              <div className="text-2xl font-bold text-gray-400">Easy to Use</div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything you need to create amazing quizzes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to make quiz creation effortless and engaging
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart PDF Processing</h3>
                <p className="text-gray-600 leading-relaxed">
                  Upload any PDF document and our advanced AI will automatically extract relevant content and generate comprehensive quiz questions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI-Generated Questions</h3>
                <p className="text-gray-600 leading-relaxed">
                  Powered by AI to create intelligent, contextual questions with multiple choice options that truly test understanding.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Quality Assurance</h3>
                <p className="text-gray-600 leading-relaxed">
                  Built-in admin approval workflow ensures every quiz meets high standards before being shared with students.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How it works */}
        <div className="py-20 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 rounded-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Create quizzes in 3 simple steps
            </h2>
            <p className="text-xl text-gray-600">
              From PDF to published quiz in minutes
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <span className="text-2xl font-bold text-white">1</span>
                  </div>
                  {/* Connection line */}
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-blue-200 to-purple-200 transform -translate-y-0.5"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Upload Your PDF</h3>
                <p className="text-gray-600">
                  Drag and drop or select your educational PDF documents. We support files up to 20MB.
                </p>
              </div>

              <div className="text-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <span className="text-2xl font-bold text-white">2</span>
                  </div>
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-purple-200 to-green-200 transform -translate-y-0.5"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Generates Questions</h3>
                <p className="text-gray-600">
                  Our AI analyzes your content and creates relevant, engaging quiz questions automatically.
                </p>
              </div>

              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Share & Assess</h3>
                <p className="text-gray-600">
                  Review, approve, and share your quiz with students. Track results and performance.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to transform your teaching?
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Join thousands of educators who are creating better assessments with AI-powered quiz generation.
          </p>
          
          {!session && (
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 px-8 py-4 text-lg">
                Start Creating Quizzes Today
              </Button>
            </Link>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="text-xl font-semibold">RinKuzu</span>
          </div>
          <p className="text-gray-400 mb-6">
            Empowering educators with AI-powered quiz creation
          </p>
          <p className="text-gray-500 text-sm">
            © 2024 RinKuzu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 