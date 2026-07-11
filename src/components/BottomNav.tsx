'use client';

import { Link, usePathname } from '@/i18n/navigation';
import Image from 'next/image';
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
  HiSearch,
  HiOutlineAcademicCap,
  HiOutlineUpload,
  HiOutlineChartBar,
} from 'react-icons/hi';
import {
  getProductScope,
  isAdaptiveExerciseModePath,
  matchesPrefix,
  stripLocaleFromPath,
} from '@/lib/routing/pathname';
import { AUTH_REQUIRED_PATH_PREFIXES, MOBILE_TABS_BY_SCOPE } from '@/shared/constants/nav';

type IconRender = (isActive: boolean) => React.ReactNode;

interface NavTab {
  href: string;
  labelKey: string;
  /** Used to highlight a tab when the active path is one of its sub-routes. */
  matchPrefix?: string;
  /** Render the centered floating button instead of an inline icon. */
  isCenter?: boolean;
  icon: IconRender;
}

function isTabActive(pathWithoutLocale: string, tab: NavTab): boolean {
  if (tab.matchPrefix) return matchesPrefix(pathWithoutLocale, tab.matchPrefix);
  return pathWithoutLocale === tab.href;
}

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const t = useTranslations('nav');
  const pathWithoutLocale = stripLocaleFromPath(pathname || '/');
  const isProtectedRoute = AUTH_REQUIRED_PATH_PREFIXES.some((prefix) =>
    matchesPrefix(pathWithoutLocale, prefix),
  );
  const isQuizPlayRoute = matchesPrefix(pathWithoutLocale, '/quiz');

  // Hide bottom navigation in exercise mode and quiz-taking screens
  if (isAdaptiveExerciseModePath(pathname || '/') || isQuizPlayRoute) {
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
                <div className="size-6 rounded-full skeleton-shimmer" />
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

  const profileTab: NavTab = {
    href: '/profile',
    labelKey: 'profile',
    icon: (isActive) =>
      session.user?.avatar ? (
        <Image
          src={session.user.avatar}
          alt=""
          width={24}
          height={24}
          className={`w-6 h-6 rounded-full object-cover border-2 ${isActive ? 'border-brand-trust' : 'border-neutral-400'}`}
          unoptimized
        />
      ) : (
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-brand-trust' : 'border-neutral-400'}`}
        >
          <span
            className={`text-xs font-bold ${isActive ? 'text-brand-trust' : 'text-neutral-500'}`}
          >
            {(session.user?.displayName || session.user?.email || 'U').charAt(0).toUpperCase()}
          </span>
        </div>
      ),
  };

  const homeTab: NavTab = {
    href: '/dashboard',
    labelKey: 'tabHome',
    icon: (isActive) =>
      isActive ? (
        <HiHome className="size-6 text-brand-trust" />
      ) : (
        <HiOutlineHome className="size-6 text-neutral-500" />
      ),
  };

  const exploreTab: NavTab = {
    href: '/explore',
    labelKey: 'tabExplore',
    icon: (isActive) =>
      isActive ? (
        <HiSearch className="size-6 text-brand-trust" />
      ) : (
        <HiOutlineSearch className="size-6 text-neutral-500" />
      ),
  };

  const reviewTab: NavTab = {
    href: '/review',
    labelKey: 'review',
    icon: (isActive) =>
      isActive ? (
        <HiInbox className="size-6 text-brand-trust" />
      ) : (
        <HiOutlineInbox className="size-6 text-neutral-500" />
      ),
  };

  const createTab: NavTab = {
    href: '/create',
    labelKey: 'createQuizShort',
    matchPrefix: '/create',
    isCenter: true,
    icon: (isActive) => (
      <div
        className={`w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-[0_8px_16px_rgb(0,0,0,0.12)] border-[3px] border-white transition-transform duration-300 ${isActive ? 'bg-brand-action-hover scale-105' : 'bg-brand-action hover:scale-105'}`}
        aria-label={t('createQuizAria')}
      >
        {isActive ? (
          <HiPlus className="size-6 text-white" aria-hidden="true" />
        ) : (
          <HiOutlinePlus className="size-6 text-white" aria-hidden="true" />
        )}
      </div>
    ),
  };

  const adaptiveLibraryTab: NavTab = {
    href: '/adaptive',
    labelKey: 'tabLibrary',
    icon: (isActive) => (
      <HiOutlineAcademicCap
        className={`size-6 ${isActive ? 'text-brand-trust' : 'text-neutral-500'}`}
      />
    ),
  };

  const adaptiveUploadTab: NavTab = {
    href: '/adaptive/upload',
    labelKey: 'tabUpload',
    isCenter: true,
    icon: (isActive) => (
      <div
        className={`w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-[0_8px_16px_rgb(0,0,0,0.12)] border-[3px] border-white transition-transform duration-300 ${isActive ? 'bg-brand-trust scale-105' : 'bg-brand-trust hover:scale-105'}`}
        aria-label={t('uploadSubjectAria')}
      >
        <HiOutlineUpload className="size-6 text-white" aria-hidden="true" />
      </div>
    ),
  };

  const adaptiveProgressTab: NavTab = {
    href: '/dashboard',
    labelKey: 'tabProgress',
    icon: (isActive) => (
      <HiOutlineChartBar
        className={`size-6 ${isActive ? 'text-brand-trust' : 'text-neutral-500'}`}
      />
    ),
  };

  const scope = getProductScope(pathname || '/');
  const iconById: Record<string, NavTab['icon']> = {
    home: homeTab.icon,
    explore: exploreTab.icon,
    review: reviewTab.icon,
    create: createTab.icon,
    profile: profileTab.icon,
    adaptiveLibrary: adaptiveLibraryTab.icon,
    adaptiveUpload: adaptiveUploadTab.icon,
    adaptiveProgress: adaptiveProgressTab.icon,
  };
  const tabs: NavTab[] = MOBILE_TABS_BY_SCOPE[scope].map((def) => ({
    href: def.href,
    labelKey: def.labelKey,
    matchPrefix: def.matchPrefix,
    isCenter: def.isCenter,
    icon: iconById[def.id],
  }));

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-neutral-200/60 shadow-[0_-4px_20px_rgb(0,0,0,0.04)] px-2 pt-2 z-50 safe-area-bottom">
      <div className="flex justify-around items-end">
        {tabs.map((tab) => {
          const isActive = isTabActive(pathWithoutLocale, tab);

          return (
            <Link
              key={tab.href + tab.labelKey}
              href={tab.href}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-3 py-1 rounded-xl transition-colors active:bg-neutral-100 ${tab.isCenter ? '' : 'gap-0.5'}`}
            >
              {tab.icon(isActive)}
              {!tab.isCenter && (
                <span
                  className={`text-[10px] font-medium ${isActive ? 'text-brand-trust' : 'text-neutral-500'}`}
                >
                  {t(tab.labelKey)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,8px)]"></div>
    </div>
  );
}
