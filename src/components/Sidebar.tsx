'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentPath?: string;
}

export default function Sidebar({ isOpen, onToggle, currentPath }: SidebarProps) {
  const { data: session } = useSession();
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);

  if (!session) return null;

  const menuItems = [
    {
      href: '/pending',
      label: 'My Quizzes',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      )
    },
    {
      href: '/history',
      label: 'Quiz History',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      )
    }
  ];

  const adminMenuItems = [
    {
      href: '/admin/queue',
      label: 'Quiz Queue',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      )
    },
    {
      href: '/admin/users',
      label: 'User Management',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      )
    }
  ];

  return (
    <div className={`fixed left-0 top-16 h-full bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
      isOpen ? 'w-64' : 'w-16'
    }`}>
      <div className="p-4">
        {/* Toggle Button */}
        <div className="mb-4">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={isOpen ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"} 
              />
            </svg>
          </button>
        </div>

        <nav className="space-y-2">
          {/* Regular menu items */}
          {menuItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  !isOpen ? 'justify-center' : ''
                } ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={!isOpen ? item.label : ''}
              >
                <svg className={`${isOpen ? 'w-5 h-5 mr-3' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
                {isOpen && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* Admin menu section */}
          {(session.user as any)?.role === 'admin' && (
            <div className="pt-4 border-t border-gray-200">
              {/* Admin section header */}
              {isOpen ? (
                <div className="mb-2">
                  <button
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span>Admin Panel</span>
                    <svg className={`w-4 h-4 transition-transform ${adminMenuOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="mb-2 flex justify-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Admin menu items */}
              {(adminMenuOpen || !isOpen) && (
                <div className={`space-y-1 ${isOpen ? 'ml-3' : ''}`}>
                  {adminMenuItems.map((item) => {
                    const isActive = currentPath === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                          !isOpen ? 'justify-center' : ''
                        } ${
                          isActive 
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        title={!isOpen ? item.label : ''}
                      >
                        <svg className={`${isOpen ? 'w-4 h-4 mr-3' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {item.icon}
                        </svg>
                        {isOpen && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </div>
  );
} 