'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  return (
    <nav className={`sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L3 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.733.99A1.002 1.002 0 0118 6v2a1 1 0 11-2 0v-.277l-1.254.145a1 1 0 11-.992-1.736L14.984 6l-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.577V12a1 1 0 11-2 0v-1.423l-1.246-.71a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.423l1.246.71a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.423V12a1 1 0 011-1zm-9.618 5.504a1 1 0 011.364-.372l.254.145V16a1 1 0 112 0v.277l.254-.145a1 1 0 11.992 1.736l-1.735.992a.995.995 0 01-1.022 0l-1.735-.992a1 1 0 01-.372-1.364z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-gray-900 hidden sm:block">
                RinKuzu
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {session ? (
              <>
                <Link href="/" className="nav-item">
                  Dashboard
                </Link>
                
                <Link href="/create" className="nav-item">
                  Create Quiz
                </Link>

                <Link href="/pending" className="nav-item">
                  My Quizzes
                </Link>

                {(session.user as any)?.role === 'admin' && (
                  <Link href="/admin/queue" className="nav-item nav-item-admin">
                    Admin
                  </Link>
                )}
                
                {/* User Menu */}
                <div className="relative ml-6" ref={userMenuRef}>
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {session.user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <svg 
                      className={`w-3 h-3 text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} 
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isUserMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                      
                      <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100/50 overflow-hidden z-20 backdrop-blur-xl" style={{
                        animation: 'slideIn 0.2s ease-out'
                      }}>
                        {/* User Header */}
                        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-5 border-b border-gray-100">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                                {session.user?.email?.charAt(0).toUpperCase()}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-semibold text-gray-900 truncate">
                                {session.user?.email?.split('@')[0]}
                              </h3>
                              <p className="text-sm text-gray-500 truncate">
                                {session.user?.email}
                              </p>
                              <div className="flex items-center mt-2">
                                {(session.user as any)?.role === 'admin' ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-100">
                                    <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 01.672 0 41.059 41.059 0 018.198 5.424.75.75 0 01-.254 1.285A31.372 31.372 0 0015.204 8.2a.75.75 0 01-.566-.867 19.607 19.607 0 011.315-2.936A39.554 39.554 0 0010 2.731 39.554 39.554 0 004.047 4.397a19.607 19.607 0 011.315 2.936.75.75 0 01-.566.867 31.372 31.372 0 00-3.076.165.75.75 0 01-.254-1.285A41.059 41.059 0 019.664 1.319zM5.25 9.621V18a.75.75 0 00.75.75h8a.75.75 0 00.75-.75V9.621a.75.75 0 00-.518-.714 29.933 29.933 0 00-8.964 0 .75.75 0 00-.518.714z" clipRule="evenodd" />
                                    </svg>
                                    Administrator
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100">
                                    <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    User
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="py-2">
                          <div className="px-3 py-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
                          </div>
                          <Link href="/history" className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200" onClick={() => setIsUserMenuOpen(false)}>
                            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg mr-3 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all duration-200">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Quiz History</p>
                              <p className="text-xs text-gray-500">View your quiz attempts</p>
                            </div>
                          </Link>
                          
                          {(session.user as any)?.role === 'admin' && (
                            <>
                              <div className="px-3 py-2 mt-2">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Administration</p>
                              </div>
                              <Link href="/admin/queue" className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200" onClick={() => setIsUserMenuOpen(false)}>
                                <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg mr-3 group-hover:bg-purple-100 group-hover:text-purple-600 transition-all duration-200">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">Review Queue</p>
                                  <p className="text-xs text-gray-500">Approve pending quizzes</p>
                                </div>
                              </Link>
                              <Link href="/admin/users" className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200" onClick={() => setIsUserMenuOpen(false)}>
                                <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg mr-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all duration-200">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">Manage Users</p>
                                  <p className="text-xs text-gray-500">User accounts & permissions</p>
                                </div>
                              </Link>
                              <Link href="/admin/categories" className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200" onClick={() => setIsUserMenuOpen(false)}>
                                <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg mr-3 group-hover:bg-green-100 group-hover:text-green-600 transition-all duration-200">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">Categories</p>
                                  <p className="text-xs text-gray-500">Organize quiz topics</p>
                                </div>
                              </Link>
                              <Link href="/admin/reports" className="group flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200" onClick={() => setIsUserMenuOpen(false)}>
                                <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg mr-3 group-hover:bg-orange-100 group-hover:text-orange-600 transition-all duration-200">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">Quiz Reports</p>
                                  <p className="text-xs text-gray-500">Review user feedback</p>
                                </div>
                              </Link>
                            </>
                          )}
                        </div>
                        
                        {/* Sign Out */}
                        <div className="border-t border-gray-100 bg-gray-50/50 p-2">
                          <button 
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              signOut();
                            }}
                            className="group flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-200"
                          >
                            <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg mr-3 group-hover:bg-red-200 transition-all duration-200">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium">Sign Out</p>
                              <p className="text-xs text-red-500">End your session</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-medium">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4">
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
              className="p-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 mobile-menu-animation">
            <div className="space-y-1">
              {session ? (
                <>
                  {/* User Info */}
                  <div className="px-3 py-3 bg-gray-50 rounded-lg mx-1 mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                        {session.user?.email?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{session.user?.email}</p>
                        <p className="text-xs text-gray-500">
                          {(session.user as any)?.role === 'admin' ? 'Administrator' : 'User'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link href="/" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <Link href="/create" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
                    Create Quiz
                  </Link>
                  <Link href="/pending" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
                    My Quizzes
                  </Link>
                  <Link href="/history" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
                    Quiz History
                  </Link>
                  
                  {(session.user as any)?.role === 'admin' && (
                    <>
                      <div className="border-t border-gray-200 my-2" />
                      <Link href="/admin/queue" className="mobile-nav-item text-red-600" onClick={() => setIsMenuOpen(false)}>
                        Admin Panel
                      </Link>
                      <Link href="/admin/users" className="mobile-nav-item text-red-600" onClick={() => setIsMenuOpen(false)}>
                        Manage Users
                      </Link>
                      <Link href="/admin/categories" className="mobile-nav-item text-red-600" onClick={() => setIsMenuOpen(false)}>
                        Manage Categories
                      </Link>
                    </>
                  )}
                  
                  <div className="border-t border-gray-200 my-2" />
                  <button 
                    onClick={() => {
                      setIsMenuOpen(false);
                      signOut();
                    }}
                    className="mobile-nav-item text-red-600 w-full text-left"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
                    Sign In
                  </Link>
                  <Link href="/register" className="mobile-nav-item" onClick={() => setIsMenuOpen(false)}>
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .nav-item {
          @apply px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors;
        }
        
        .nav-item-admin {
          @apply text-red-600 hover:text-red-700 hover:bg-red-50;
        }
        
        .dropdown-item {
          @apply flex items-center space-x-3 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-lg mx-1;
        }
        
        .mobile-nav-item {
          @apply px-3 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors mx-1;
        }
        
        .dropdown-animation {
          animation: dropdownFadeIn 0.15s ease-out;
        }
        
        .mobile-menu-animation {
          animation: mobileSlideDown 0.2s ease-out;
        }
        
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes mobileSlideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </nav>
  );
} 