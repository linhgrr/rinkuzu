'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
              {session ? (
                <>
                  <span className="text-sm text-gray-600">
                    Welcome, {session.user?.email}
                  </span>
                  {(session.user as any)?.role === 'admin' && (
                    <Link href="/admin/queue">
                      <Button variant="outline" size="sm">
                        Admin Queue
                      </Button>
                    </Link>
                  )}
                  <Link href="/quizzes">
                    <Button variant="outline">All Quizzes</Button>
                  </Link>
                  <Link href="/create">
                    <Button>Create Quiz</Button>
                  </Link>
                  <Link href="/pending">
                    <Button variant="outline">My Quizzes</Button>
                  </Link>
                  <Link href="/history">
                    <Button variant="outline">Quiz History</Button>
                  </Link>
                  <Link href="/api/auth/signout">
                    <Button variant="ghost">Sign Out</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline">Sign In</Button>
                  </Link>
                  <Link href="/register">
                    <Button>Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Create Interactive Quizzes
            <span className="text-blue-600"> from PDFs</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Upload your PDF documents and let AI extract questions automatically. 
            Perfect for teachers, trainers, and educators who want to create engaging quizzes quickly.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            {session ? (
              <Link href="/create">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started - Create Your First Quiz
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started - Sign Up Free
                </Button>
              </Link>
            )}
          </div>
          
        </div>

        {/* Features */}
        <div className="mt-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Simply upload your PDF documents and our AI will extract questions automatically. 
                  Supports files up to 20MB.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Powered
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Powered by Google Gemini AI for intelligent question extraction and 
                  multiple-choice option generation.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <svg className="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Admin Approval
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Quality control with admin approval workflow ensures all quizzes 
                  meet your standards before publication.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload PDF</h3>
              <p className="text-gray-600">Upload your educational content in PDF format</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Processing</h3>
              <p className="text-gray-600">Our AI extracts and generates quiz questions</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Review</h3>
              <p className="text-gray-600">Quiz goes through quality approval process</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Share & Use</h3>
              <p className="text-gray-600">Share quiz links with your students</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 