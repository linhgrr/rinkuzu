'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
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
  HiOutlineSparkles,
  HiChevronRight,
  HiChevronDoubleLeft,
  HiChevronDoubleRight,
  HiOutlineCog,
  HiOutlineAcademicCap,
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineBookmark,
  HiOutlineInbox,
  HiOutlineUpload,
  HiOutlinePlus,
} from '@/components/icons';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentPath?: string;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  /** When set, isActive matches `currentPath.startsWith(matchPrefix)` instead of strict equality. */
  matchPrefix?: string;
}

interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
  /** Visible only when user has this role. */
  requiredRole?: 'admin';
}

const STORAGE_KEY = 'rinkuzu:sidebar:open-groups';
const DEFAULT_OPEN_GROUPS = ['quiz', 'adaptive', 'account'];

function loadCollapseState(): string[] {
  if (typeof window === 'undefined') return DEFAULT_OPEN_GROUPS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OPEN_GROUPS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string')
      : DEFAULT_OPEN_GROUPS;
  } catch {
    return DEFAULT_OPEN_GROUPS;
  }
}

function saveCollapseState(openIds: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openIds));
  } catch {
    /* ignore quota errors */
  }
}

function isItemActive(item: NavItem, currentPath?: string): boolean {
  if (!currentPath) return false;
  if (item.matchPrefix) return currentPath.startsWith(item.matchPrefix);
  return currentPath === item.href;
}

export default function Sidebar({ isOpen, onToggle, currentPath }: SidebarProps) {
  const { data: session } = useSession();
  const t = useTranslations('nav');
  const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);

  useEffect(() => {
    setOpenGroups(loadCollapseState());
  }, []);

  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const groups = useMemo<NavGroup[]>(
    () => [
      {
        id: 'quiz',
        labelKey: 'groupQuizBuilder',
        items: [
          {
            href: '/create',
            labelKey: 'createQuizShort',
            icon: <HiOutlinePlus className="w-full h-full" />,
            matchPrefix: '/create',
          },
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
            matchPrefix: '/history',
          },
          {
            href: '/bookmarks',
            labelKey: 'bookmarks',
            icon: <HiOutlineBookmark className="w-full h-full" />,
          },
          {
            href: '/explore',
            labelKey: 'explore',
            icon: <HiOutlineSearch className="w-full h-full" />,
          },
        ],
      },
      {
        id: 'adaptive',
        labelKey: 'groupAdaptiveLearning',
        items: [
          {
            href: '/adaptive',
            labelKey: 'adaptiveLibrary',
            icon: <HiOutlineAcademicCap className="w-full h-full" />,
            matchPrefix: '/adaptive',
          },
          {
            href: '/adaptive/upload',
            labelKey: 'adaptiveUpload',
            icon: <HiOutlineUpload className="w-full h-full" />,
          },
        ],
      },
      {
        id: 'account',
        labelKey: 'groupAccount',
        items: [
          {
            href: '/profile',
            labelKey: 'profile',
            icon: <HiOutlineCog className="w-full h-full" />,
          },
          {
            href: '/subscription',
            labelKey: 'subscription',
            icon: <HiOutlineSparkles className="w-full h-full" />,
          },
        ],
      },
      {
        id: 'admin',
        labelKey: 'groupAdmin',
        requiredRole: 'admin',
        items: [
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
          {
            href: '/admin/reports',
            labelKey: 'quizReports',
            icon: <HiOutlineExclamationCircle className="w-full h-full" />,
          },
        ],
      },
    ],
    [],
  );

  const visibleGroups = useMemo(
    () => groups.filter((g) => !g.requiredRole || g.requiredRole === userRole),
    [groups, userRole],
  );

  const groupContainingActive = useMemo(() => {
    if (!currentPath) return null;
    return (
      visibleGroups.find((group) => group.items.some((item) => isItemActive(item, currentPath)))
        ?.id ?? null
    );
  }, [visibleGroups, currentPath]);

  const effectiveOpenGroups = useMemo(() => {
    if (groupContainingActive && !openGroups.includes(groupContainingActive)) {
      return [...openGroups, groupContainingActive];
    }
    return openGroups;
  }, [openGroups, groupContainingActive]);

  if (!session) return null;

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      saveCollapseState(next);
      return next;
    });
  };

  return (
    <div
      className={`fixed left-0 top-16 z-40 h-full border-r border-neutral-200 bg-white transition-[width] duration-300 ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
        {/* Toggle button */}
        <div className="mb-3">
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

        <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
          {visibleGroups.map((group, index) => {
            const isOpenGroup = effectiveOpenGroups.includes(group.id);
            const showHeader = isOpen;

            return (
              <div
                key={group.id}
                className={index > 0 ? 'border-t border-neutral-100 pt-4' : undefined}
              >
                {showHeader ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => toggleGroup(group.id)}
                    className="mb-2 h-auto w-full justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-expanded={isOpenGroup}
                  >
                    <span>{t(group.labelKey)}</span>
                    <HiChevronRight
                      className={`size-3.5 transition-transform ${isOpenGroup ? 'rotate-90' : ''}`}
                    />
                  </Button>
                ) : (
                  <div className="mb-2 h-px bg-neutral-100" aria-hidden="true" />
                )}

                {(isOpenGroup || !isOpen) && (
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = isItemActive(item, currentPath);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                            !isOpen ? 'justify-center' : ''
                          } ${
                            active
                              ? 'bg-green-50 text-brand-trust'
                              : 'text-neutral-700 hover:bg-neutral-100'
                          }`}
                          title={!isOpen ? t(item.labelKey) : ''}
                        >
                          <div className={isOpen ? 'mr-3 size-5' : 'size-6'}>{item.icon}</div>
                          {isOpen && <span>{t(item.labelKey)}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
