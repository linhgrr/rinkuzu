'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  HiOutlineSearch,
  HiOutlineCollection,
  HiOutlineUsers,
  HiOutlineTag,
  HiOutlineCreditCard,
  HiOutlineCurrencyDollar,
  HiOutlineChartBar,
  HiOutlineExclamationCircle,
  HiChevronRight,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
  HiOutlineCog,
  HiOutlineAcademicCap,
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineBookmark,
  HiOutlineInbox,
} from '@/components/icons';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentPath?: string;
}

export default function Sidebar({ isOpen, onToggle, currentPath }: SidebarProps) {
  const { data: session } = useSession();
  const t = useTranslations('nav');
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);

  if (!session) return null;
  const userRole = (session.user as { role?: string } | undefined)?.role;

  const menuItems = [
    {
      href: '/my-quizzes',
      labelKey: 'myQuizzes',
      icon: <HiOutlineDocumentText className="w-full h-full" />,
    },
    {
      href: '/review',
      labelKey: 'review',
      icon: <HiOutlineInbox className="w-full h-full" />,
    },
    {
      href: '/history',
      labelKey: 'history',
      icon: <HiOutlineClock className="w-full h-full" />,
    },
    {
      href: '/bookmarks',
      labelKey: 'bookmarks',
      icon: <HiOutlineBookmark className="w-full h-full" />,
    },
    {
      href: '/adaptive-learning',
      labelKey: 'adaptiveLearning',
      icon: <HiOutlineAcademicCap className="w-full h-full" />,
    },
    {
      href: '/explore',
      labelKey: 'exploreQuizzes',
      icon: <HiOutlineSearch className="w-full h-full" />,
    },
    {
      href: '/profile',
      labelKey: 'profile',
      icon: <HiOutlineCog className="w-full h-full" />,
    },
  ];

  const adminMenuItems = [
    {
      href: '/admin/queue',
      labelKey: 'quizQueue',
      icon: <HiOutlineCollection className="w-full h-full" />,
    },
    {
      href: '/admin/users',
      labelKey: 'userManagement',
      icon: <HiOutlineUsers className="w-full h-full" />,
    },
    {
      href: '/admin/categories',
      labelKey: 'categories',
      icon: <HiOutlineTag className="w-full h-full" />,
    },
    {
      href: '/admin/subscriptions',
      labelKey: 'subscriptions',
      icon: <HiOutlineCreditCard className="w-full h-full" />,
    },
    {
      href: '/admin/plans',
      labelKey: 'pricingPlans',
      icon: <HiOutlineCurrencyDollar className="w-full h-full" />,
    },
    {
      href: '/admin/stats',
      labelKey: 'statistics',
      icon: <HiOutlineChartBar className="w-full h-full" />,
    },
  ];

  return (
    <div
      className={`fixed left-0 top-16 z-40 h-full border-r border-neutral-200 bg-white transition-[width] duration-300 ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="p-4">
        {/* Toggle Button */}
        <div className="mb-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggle}
            className="h-auto w-full justify-center rounded-lg px-3 py-2 text-neutral-600 hover:bg-neutral-100"
            title={isOpen ? t('collapseSidebar') : t('expandSidebar')}
            aria-label={isOpen ? t('collapseSidebar') : t('expandSidebar')}
          >
            {isOpen ? (
              <HiChevronDoubleLeft className="size-5" />
            ) : (
              <HiChevronDoubleRight className="size-5" />
            )}
          </Button>
        </div>

        <nav className="space-y-2">
          {/* Regular menu items */}
          {menuItems.map((item) => {
            const isActive =
              item.href === '/history'
                ? currentPath?.startsWith('/history')
                : currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  !isOpen ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-green-50 text-brand-trust border-r-2 border-brand-trust'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title={!isOpen ? t(item.labelKey) : ''}
              >
                <div className={`${isOpen ? 'w-5 h-5 mr-3' : 'w-6 h-6'}`}>{item.icon}</div>
                {isOpen && <span>{t(item.labelKey)}</span>}
              </Link>
            );
          })}

          {/* Admin menu section */}
          {userRole === 'admin' && (
            <div className="pt-4 border-t border-neutral-200">
              {/* Admin section header */}
              {isOpen ? (
                <div className="mb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                    className="h-auto w-full justify-between rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                  >
                    <span>{t('adminPanel')}</span>
                    <HiChevronRight
                      className={`w-4 h-4 transition-transform ${adminMenuOpen ? 'rotate-90' : ''}`}
                    />
                  </Button>
                </div>
              ) : (
                <div className="mb-2 flex justify-center">
                  <div className="size-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <HiOutlineCog className="size-4 text-neutral-600" />
                  </div>
                </div>
              )}

              {/* Admin menu items */}
              {(adminMenuOpen || !isOpen) && (
                <div className={`space-y-1 ${isOpen ? 'ml-3' : ''}`}>
                  {[
                    ...adminMenuItems,
                    {
                      href: '/admin/reports',
                      labelKey: 'quizReports',
                      icon: <HiOutlineExclamationCircle className="w-full h-full" />,
                    },
                  ].map((item) => {
                    const isActive = currentPath === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                          !isOpen ? 'justify-center' : ''
                        } ${
                          isActive
                            ? 'bg-green-50 text-brand-trust border-r-2 border-brand-trust'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                        title={!isOpen ? t(item.labelKey) : ''}
                      >
                        <div className={`${isOpen ? 'w-4 h-4 mr-3' : 'w-5 h-5'}`}>{item.icon}</div>
                        {isOpen && <span>{t(item.labelKey)}</span>}
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
