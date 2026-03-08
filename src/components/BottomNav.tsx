'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
    HiOutlineHome,
    HiHome,
    HiOutlineInbox,
    HiInbox,
    HiOutlinePlus,
    HiPlus,
    HiOutlineSearch,
    HiSearch
} from '@/components/icons';

const AUTH_REQUIRED_PREFIXES = [
    '/dashboard',
    '/create',
    '/profile',
    '/review',
    '/categories',
    '/category',
    '/subscription',
    '/history',
    '/draft',
    '/edit',
    '/admin',
];

function normalizePath(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }
    return pathname;
}

function stripLocale(pathname: string): string {
    const normalized = normalizePath(pathname);
    const segments = normalized.split('/');
    const firstSegment = segments[1];

    if (firstSegment === 'vi' || firstSegment === 'en') {
        const restPath = `/${segments.slice(2).join('/')}`;
        return normalizePath(restPath === '/' ? '/' : restPath);
    }

    return normalized;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const t = useTranslations('nav');
    const pathWithoutLocale = stripLocale(pathname || '/');
    const isProtectedRoute = AUTH_REQUIRED_PREFIXES.some((prefix) =>
        matchesPrefix(pathWithoutLocale, prefix)
    );

    // Hide bottom navigation in exercise mode to prevent distractions
    if (pathWithoutLocale.startsWith('/adaptive-learning/exercise') || pathWithoutLocale.startsWith('/adaptive-learning/result')) {
        return null;
    }

    if (!session) {
        if (status === 'loading' && isProtectedRoute) {
            return (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 px-2 pt-2 z-50 safe-area-bottom">
                    <div className="flex justify-around items-end" aria-hidden="true">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div
                                key={`bottom-nav-skeleton-${index}`}
                                className="min-w-[56px] min-h-[48px] px-3 py-1 flex flex-col items-center justify-center gap-1"
                            >
                                <div className="w-6 h-6 rounded-full skeleton-shimmer" />
                                <div className="w-8 h-2 rounded skeleton-shimmer" />
                            </div>
                        ))}
                    </div>
                    <div className="h-[env(safe-area-inset-bottom,8px)]" />
                </div>
            );
        }

        return null;
    }

    const navItems = [
        {
            href: '/dashboard',
            labelKey: 'home',
            icon: (isActive: boolean) => (
                isActive ? <HiHome className="w-6 h-6 text-blue-600" /> : <HiOutlineHome className="w-6 h-6 text-gray-500" />
            )
        },
        {
            href: '/review',
            labelKey: 'history',
            icon: (isActive: boolean) => (
                isActive ? <HiInbox className="w-6 h-6 text-blue-600" /> : <HiOutlineInbox className="w-6 h-6 text-gray-500" />
            )
        },
        {
            href: '/create',
            labelKey: 'create',
            icon: (isActive: boolean) => (
                <div className={`w-10 h-10 -mt-5 rounded-full flex items-center justify-center shadow-lg ${isActive ? 'bg-blue-700' : 'bg-blue-600'}`} aria-label="Create new quiz">
                    {isActive ? <HiPlus className="w-6 h-6 text-white" aria-hidden="true" /> : <HiOutlinePlus className="w-6 h-6 text-white" aria-hidden="true" />}
                </div>
            )
        },
        {
            href: '/explore',
            labelKey: 'explore',
            icon: (isActive: boolean) => (
                isActive ? <HiSearch className="w-6 h-6 text-blue-600" /> : <HiOutlineSearch className="w-6 h-6 text-gray-500" />
            )
        },
        {
            href: '/profile',
            labelKey: 'profile',
            icon: (isActive: boolean) => (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-blue-600' : 'border-gray-400'}`}>
                    <span className="text-xs font-bold text-gray-500">{session.user?.email?.[0].toUpperCase()}</span>
                </div>
            )
        }
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/50 px-2 pt-2 z-50 safe-area-bottom">
            <div className="flex justify-around items-end">
                {navItems.map((item) => {
                    const isActive = pathWithoutLocale === item.href;
                    const isCreate = item.href === '/create';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-3 py-1 rounded-xl transition-colors active:bg-gray-100 ${isCreate ? '' : 'gap-0.5'}`}
                        >
                            {typeof item.icon === 'function' ? item.icon(isActive) : null}
                            {!isCreate && (
                                <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {t(item.labelKey)}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
            {/* Safe Area for iPhone Home Indicator */}
            <div className="h-[env(safe-area-inset-bottom,8px)]"></div>
        </div>
    );
}
