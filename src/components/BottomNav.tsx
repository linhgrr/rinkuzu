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
import { isAdaptiveExerciseModePath, matchesPrefix, stripLocaleFromPath } from '@/lib/routing/pathname';

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

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const t = useTranslations('nav');
    const pathWithoutLocale = stripLocaleFromPath(pathname || '/');
    const isProtectedRoute = AUTH_REQUIRED_PREFIXES.some((prefix) =>
        matchesPrefix(pathWithoutLocale, prefix)
    );

    // Hide bottom navigation in exercise mode to prevent distractions
    if (isAdaptiveExerciseModePath(pathname || '/')) {
        return null;
    }

    if (!session) {
        if (status === 'loading' && isProtectedRoute) {
            return (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-neutral-200/50 px-2 pt-2 z-50 safe-area-bottom">
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
                isActive ? <HiHome className="w-6 h-6 text-brand-trust" /> : <HiOutlineHome className="w-6 h-6 text-neutral-500" />
            )
        },
        {
            href: '/review',
            labelKey: 'history',
            icon: (isActive: boolean) => (
                isActive ? <HiInbox className="w-6 h-6 text-brand-trust" /> : <HiOutlineInbox className="w-6 h-6 text-neutral-500" />
            )
        },
        {
            href: '/create',
            labelKey: 'create',
            icon: (isActive: boolean) => (
                <div className={`w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-[0_8px_16px_rgb(0,0,0,0.12)] border-[3px] border-white transition-transform duration-300 ${isActive ? 'bg-brand-action-hover scale-105' : 'bg-brand-action hover:scale-105'}`} aria-label="Create new quiz">
                    {isActive ? <HiPlus className="w-6 h-6 text-white" aria-hidden="true" /> : <HiOutlinePlus className="w-6 h-6 text-white" aria-hidden="true" />}
                </div>
            )
        },
        {
            href: '/explore',
            labelKey: 'explore',
            icon: (isActive: boolean) => (
                isActive ? <HiSearch className="w-6 h-6 text-brand-trust" /> : <HiOutlineSearch className="w-6 h-6 text-neutral-500" />
            )
        },
        {
            href: '/profile',
            labelKey: 'profile',
            icon: (isActive: boolean) => (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-brand-trust' : 'border-neutral-400'}`}>
                    <span className={`text-xs font-bold ${isActive ? 'text-brand-trust' : 'text-neutral-500'}`}>{session.user?.email?.[0].toUpperCase()}</span>
                </div>
            )
        }
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-neutral-200/60 shadow-[0_-4px_20px_rgb(0,0,0,0.04)] px-2 pt-2 z-50 safe-area-bottom">
            <div className="flex justify-around items-end">
                {navItems.map((item) => {
                    const isActive = pathWithoutLocale === item.href;
                    const isCreate = item.href === '/create';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-3 py-1 rounded-xl transition-colors active:bg-neutral-100 ${isCreate ? '' : 'gap-0.5'}`}
                        >
                            {typeof item.icon === 'function' ? item.icon(isActive) : null}
                            {!isCreate && (
                                <span className={`text-[10px] font-medium ${isActive ? 'text-brand-trust' : 'text-neutral-500'}`}>
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
