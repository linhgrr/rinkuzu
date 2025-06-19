'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className={`bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 ${className}`}>
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
                      {(session.user as any)?.role === 'admin' && (
                        <>
                          <Link href="/admin/users" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            Manage Users
                          </Link>
                          <Link href="/admin/categories" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            Manage Categories
                          </Link>
                        </>
                      )}
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
                  <Link href="/" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
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
                    <>
                      <Link href="/admin/queue" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                        Admin Panel
                      </Link>
                      <Link href="/admin/users" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                        Manage Users
                      </Link>
                      <Link href="/admin/categories" className="block px-4 py-2 text-gray-600 hover:text-gray-900">
                        Manage Categories
                      </Link>
                    </>
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
  );
} 