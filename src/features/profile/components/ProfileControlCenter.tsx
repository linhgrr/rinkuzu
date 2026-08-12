'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TabBar } from '@/components/ui/TabBar';
import type { ProfileSettingsViewModel } from '@/features/profile/types/profile-settings-view-model';
import {
  HiOutlineBookmark,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineChevronRight,
  HiOutlineClock,
  HiOutlineCog,
  HiOutlineCollection,
  HiOutlineHome,
  HiOutlineLockClosed,
  HiOutlinePencilAlt,
  HiOutlineShieldCheck,
  HiOutlineUser,
} from 'react-icons/hi';

export type ProfileTab = 'overview' | 'personal' | 'plan' | 'security';

type ProfileTranslate = (key: string) => string;

interface ProfileHeroProps {
  initials: string;
  onEditProfile: () => void;
  profile: ProfileSettingsViewModel;
  t: ProfileTranslate;
}

interface ProfileTabNavigationProps {
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  t: ProfileTranslate;
}

interface QuickAccessCardProps {
  t: ProfileTranslate;
}

const PROFILE_TABS = [
  { id: 'overview', labelKey: 'overviewTab', icon: HiOutlineHome },
  { id: 'personal', labelKey: 'personalTab', icon: HiOutlineUser },
  { id: 'plan', labelKey: 'planQuotaTab', icon: HiOutlineChartBar },
  { id: 'security', labelKey: 'securityTab', icon: HiOutlineLockClosed },
] as const;

const QUICK_LINKS = [
  {
    href: '/bookmarks',
    labelKey: 'bookmarks',
    descriptionKey: 'bookmarksShortcutDescription',
    icon: HiOutlineBookmark,
  },
  {
    href: '/history',
    labelKey: 'history',
    descriptionKey: 'historyShortcutDescription',
    icon: HiOutlineClock,
  },
  {
    href: '/my-quizzes',
    labelKey: 'myQuizzes',
    descriptionKey: 'quizzesShortcutDescription',
    icon: HiOutlineCollection,
  },
] as const;

export function ProfileHero({ initials, onEditProfile, profile, t }: ProfileHeroProps) {
  const displayName = profile.displayName?.trim() || profile.email.split('@')[0];
  const isPremium = profile.subscription?.isActive === true;

  return (
    <Card className="overflow-hidden border-line bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          {profile.avatar ? (
            <Image
              src={profile.avatar}
              alt={t('profilePhotoAlt')}
              width={88}
              height={88}
              className="size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm sm:size-[88px]"
              unoptimized
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-brand-trust text-2xl font-semibold text-white shadow-sm sm:size-[88px]">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                {displayName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isPremium ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {isPremium ? t('premiumPlan') : t('freePlan')}
              </span>
            </div>
            <p className="truncate text-sm text-neutral-500">{profile.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <HiOutlineCalendar className="size-4" aria-hidden="true" />
                {t('memberSince')} {profile.createdAtLabel}
              </span>
              <span className="flex items-center gap-1.5 capitalize">
                <HiOutlineShieldCheck className="size-4" aria-hidden="true" />
                {profile.role}
              </span>
            </div>
            {profile.bio ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{profile.bio}</p>
            ) : null}
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onEditProfile}>
          <HiOutlinePencilAlt className="size-4" aria-hidden="true" />
          {t('editProfile')}
        </Button>
      </div>
    </Card>
  );
}

export function ProfileTabNavigation({ activeTab, onChange, t }: ProfileTabNavigationProps) {
  return (
    <TabBar
      ariaLabel={t('profileNavigation')}
      value={activeTab}
      onChange={onChange}
      options={PROFILE_TABS.map((tab) => {
        const Icon = tab.icon;
        return {
          value: tab.id,
          label: t(tab.labelKey),
          icon: <Icon className="size-4" aria-hidden="true" />,
          tabId: `profile-tab-${tab.id}`,
          controlsId: `profile-panel-${tab.id}`,
        };
      })}
    />
  );
}

export function QuickAccessCard({ t }: QuickAccessCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line/50 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <HiOutlineCog className="size-5 text-brand-trust" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{t('quickAccess')}</h2>
            <p className="text-xs text-neutral-500">{t('quickAccessDescription')}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-neutral-100">
        {QUICK_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-16 items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:px-6"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-trust/10 text-brand-trust">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">
                  {t(item.labelKey)}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {t(item.descriptionKey)}
                </span>
              </span>
              <HiOutlineChevronRight
                className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
