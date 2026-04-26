'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import {
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineBookmark,
  HiOutlineSearch,
  HiOutlineCollection,
  HiOutlineUser,
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
  HiOutlineAcademicCap
} from '@/components/icons';
import CategorySearch from '@/components/ui/CategorySearch';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentPath?: string;
}

interface Category {
  _id: string;
  name: string;
  description: string;
  color: string;
  quizCount: number;
}

export default function Sidebar({ isOpen, onToggle, currentPath }: SidebarProps) {
  const { data: session } = useSession();
  const t = useTranslations('nav');
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories/stats');
        const data = await response.json();

        if (data.success) {
          setCategories(data.data.allCategories.slice(0, 6)); // Show top 6 categories
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    if (session) {
      fetchCategories();
    }
  }, [session]);

  const getCategorySlug = (categoryName: string) => {
    return categoryName.toLowerCase().replace(/\s+/g, '-');
  };

  if (!session) return null;

  const menuItems = [
    {
      href: '/profile?tab=quizzes',
      labelKey: 'profile',
      icon: <HiOutlineUser className="w-full h-full" />
    },
    {
      href: '/adaptive-learning',
      labelKey: 'adaptiveLearning',
      icon: <HiOutlineAcademicCap className="w-full h-full" />
    },
    {
      href: '/explore',
      labelKey: 'exploreQuizzes',
      icon: <HiOutlineSearch className="w-full h-full" />
    }
  ];

  const adminMenuItems = [
    {
      href: '/admin/queue',
      labelKey: 'quizQueue',
      icon: <HiOutlineCollection className="w-full h-full" />
    },
    {
      href: '/admin/users',
      labelKey: 'userManagement',
      icon: <HiOutlineUsers className="w-full h-full" />
    },
    {
      href: '/admin/categories',
      labelKey: 'categories',
      icon: <HiOutlineTag className="w-full h-full" />
    },
    {
      href: '/admin/subscriptions',
      labelKey: 'subscriptions',
      icon: <HiOutlineCreditCard className="w-full h-full" />
    },
    {
      href: '/admin/plans',
      labelKey: 'pricingPlans',
      icon: <HiOutlineCurrencyDollar className="w-full h-full" />
    },
    {
      href: '/admin/stats',
      labelKey: 'statistics',
      icon: <HiOutlineChartBar className="w-full h-full" />
    }
  ];

  return (
    <div className={`fixed left-0 top-16 h-full bg-white border-r border-neutral-200 transition-all duration-300 z-40 ${isOpen ? 'w-64' : 'w-16'
      }`}>
      <div className="p-4">
        {/* Toggle Button */}
        <div className="mb-4">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center px-3 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            title={isOpen ? t('collapseSidebar') : t('expandSidebar')}
            aria-label={isOpen ? t('collapseSidebar') : t('expandSidebar')}
          >
            {isOpen ? (
              <HiChevronDoubleLeft className="w-5 h-5" />
            ) : (
              <HiChevronDoubleRight className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="space-y-2">
          {/* Regular menu items */}
          {menuItems.map((item) => {
            const isExactActive = currentPath === item.href;
            const isPathActive = item.href.includes('?')
              ? currentPath?.startsWith(item.href.split('?')[0])
              : currentPath === item.href;

            const isActive = isExactActive || (item.labelKey === 'profile' && isPathActive);

            return (
              <Link
                key={item.href}
                href={item.labelKey === 'profile' && currentPath?.startsWith('/profile') ? currentPath : item.href}
                className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${!isOpen ? 'justify-center' : ''
                  } ${isActive
                    ? 'bg-green-50 text-brand-trust border-r-2 border-brand-trust'
                    : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                title={!isOpen ? t(item.labelKey) : ''}
              >
                <div className={`${isOpen ? 'w-5 h-5 mr-3' : 'w-6 h-6'}`}>
                  {item.icon}
                </div>
                {isOpen && <span>{t(item.labelKey)}</span>}
              </Link>
            );
          })}

          {/* Admin menu section */}
          {(session.user as any)?.role === 'admin' && (
            <div className="pt-4 border-t border-neutral-200">
              {/* Admin section header */}
              {isOpen ? (
                <div className="mb-2">
                  <button
                    onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <span>{t('adminPanel')}</span>
                    <HiChevronRight className={`w-4 h-4 transition-transform ${adminMenuOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              ) : (
                <div className="mb-2 flex justify-center">
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <HiOutlineCog className="w-4 h-4 text-neutral-600" />
                  </div>
                </div>
              )}

              {/* Admin menu items */}
              {(adminMenuOpen || !isOpen) && (
                <div className={`space-y-1 ${isOpen ? 'ml-3' : ''}`}>
                  {[...adminMenuItems, {
                    href: '/admin/reports',
                    labelKey: 'quizReports',
                    icon: <HiOutlineExclamationCircle className="w-full h-full" />
                  }].map((item) => {
                    const isActive = currentPath === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${!isOpen ? 'justify-center' : ''
                          } ${isActive
                            ? 'bg-green-50 text-brand-trust border-r-2 border-brand-trust'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                          }`}
                        title={!isOpen ? t(item.labelKey) : ''}
                      >
                        <div className={`${isOpen ? 'w-4 h-4 mr-3' : 'w-5 h-5'}`}>
                          {item.icon}
                        </div>
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