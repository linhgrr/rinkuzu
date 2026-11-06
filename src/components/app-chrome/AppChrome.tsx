'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import useSWR from 'swr';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { fetchCreditWallet } from '@/features/profile/api/credit-wallet-api';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import { toBrowserPath } from '@/lib/routing/pathname';
import { DESKTOP_BOTTOM_NAV, DESKTOP_PRIMARY_NAV } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { useDropdownOutside } from '@/components/ui/hooks/use-dropdown-outside';
import { resetAnalyticsIdentity } from '@/lib/analytics/client';
import { FloatingSupportButton } from '@/features/communications/components/FloatingSupportButton';
import { MarketingPreferencePrompt } from '@/features/communications/components/MarketingPreferencePrompt';
import styles from './AppChromeLayout.module.css';

const ICON = {
  home: 'material-symbols:home-outline-rounded',
  quiz: 'material-symbols:quiz-rounded',
  ai: 'mingcute:head-ai-line',
  explore: 'mingcute:world-2-line',
  setting: 'uil:setting',
  help: 'material-symbols:help-outline-rounded',
  arrow: 'solar:alt-arrow-right-line-duotone',
  bell: 'solar:bell-linear',
  lang: 'lets-icons:world-2-light',
  sidebar: 'mynaui:sidebar',
  admin: 'material-symbols:shield-outline-rounded',
  premium: 'solar:medal-ribbons-star-bold-duotone',
  user: 'solar:user-circle-linear',
  logout: 'solar:logout-2-linear',
  login: 'solar:login-2-linear',
  search: 'iconoir:search',
} as const;

// Single source of truth: sub-item row height. The sliding active indicator
// strides by this value, so both must stay in sync.
const SUB_ITEM_HEIGHT_PX = 40;

interface NavSubItem {
  href: string;
  labelKey: string;
  matchPrefix?: string;
}

interface NavEntry {
  id: string;
  labelKey: string;
  icon: string;
  href?: string;
  matchPrefix?: string;
  items?: NavSubItem[];
  requiredRole?: 'admin';
}

type NavTranslate = (key: string) => string;
type AppLocale = 'en' | 'vi';

interface ShellIconProps {
  name: string;
}

interface SidebarSubItemProps {
  href: string;
  label: string;
  active: boolean;
}

interface SidebarItemProps {
  href?: string;
  icon: string;
  label: string;
  active: boolean;
  trailing?: boolean;
  collapsed: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

interface NavSectionProps {
  entry: NavEntry;
  collapsed: boolean;
  pathname: string;
  t: NavTranslate;
  expandedGroups: string[];
  toggleGroup: (id: string) => void;
}

interface AppSidebarProps {
  collapsed: boolean;
  pathname: string;
  visibleNav: NavEntry[];
  t: NavTranslate;
  expandedGroups: string[];
  toggleGroup: (id: string) => void;
}

interface LanguageDropdownProps {
  currentLocale: string;
  onSelect: (locale: AppLocale) => void;
}

interface UserMenuDropdownProps {
  avatar?: string | null;
  avatarInitial: string;
  displayName?: string | null;
  email?: string | null;
  t: NavTranslate;
}
interface LogoutButtonProps {
  className: string;
  t: NavTranslate;
}

/**
 * Who the chrome is drawing for. `unknown` while the session loads, so neither
 * the account menu nor Sign in flashes before it is known (RIN-958).
 */
type AccountState = 'signed-in' | 'guest' | 'unknown';

interface GuestAuthLinksProps {
  /** Locale-unprefixed page that sign-in and sign-up return to. */
  callbackPath: string;
  t: NavTranslate;
}

interface AppTopbarProps extends UserMenuDropdownProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  currentLocale: string;
  onSelectLocale: (locale: AppLocale) => void;
  creditBalance?: number;
  creditLoading: boolean;
  account: AccountState;
  authCallbackPath: string;
}

interface CreditBalanceBadgeProps {
  balance?: number;
  loading: boolean;
  t: NavTranslate;
}

interface MobileMenuItemProps {
  href: string;
  icon?: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
}

interface MobileMenuGroupProps {
  entry: NavEntry;
  pathname: string;
  t: NavTranslate;
  onNavigate: () => void;
}

interface MobileAppMenuProps {
  open: boolean;
  pathname: string;
  visibleNav: NavEntry[];
  account: AccountState;
  t: NavTranslate;
  onClose: () => void;
}

interface AppChromeProps {
  children: React.ReactNode;
}

const NAV_ICON_BY_ID: Record<string, string> = {
  home: ICON.home,
  quiz: ICON.quiz,
  adaptive: ICON.ai,
  admin: ICON.admin,
  premium: ICON.premium,
  explore: ICON.explore,
  account: ICON.setting,
  help: ICON.help,
};

function mapDesktopNav(defs: typeof DESKTOP_PRIMARY_NAV): NavEntry[] {
  return defs.map((def) => ({
    id: def.id,
    labelKey: def.labelKey,
    icon: NAV_ICON_BY_ID[def.id] ?? ICON.home,
    ...(def.href !== undefined ? { href: def.href } : {}),
    ...(def.matchPrefix !== undefined ? { matchPrefix: def.matchPrefix } : {}),
    ...(def.requiredRole !== undefined ? { requiredRole: def.requiredRole } : {}),
    ...(def.items !== undefined ? { items: def.items } : {}),
  }));
}

const PRIMARY_NAV: NavEntry[] = mapDesktopNav(DESKTOP_PRIMARY_NAV);
const BOTTOM_NAV: NavEntry[] = mapDesktopNav(DESKTOP_BOTTOM_NAV);

function isHrefActive(pathname: string, href?: string, matchPrefix?: string) {
  if (!href) return false;
  if (matchPrefix) return pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
  return pathname === href;
}

function entryHasActiveChild(pathname: string, entry: NavEntry) {
  return (entry.items ?? []).some((item) => isHrefActive(pathname, item.href, item.matchPrefix));
}

function ShellIcon({ name }: ShellIconProps) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Icon icon={name} className="size-6" aria-hidden="true" />
    </span>
  );
}

function SidebarSubItem({ href, label, active }: SidebarSubItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-10 items-center gap-2.5 pl-6 pr-2.5 font-home text-body transition-colors ${
        active ? 'font-semibold text-accent' : 'font-normal text-ink hover:text-accent'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <span className="h-10 w-px border-l border-dashed border-line-blue/70" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function SidebarItem({
  href,
  icon,
  label,
  active,
  trailing,
  collapsed,
  expanded,
  onToggle,
}: SidebarItemProps) {
  const base = `flex h-12 w-full items-center rounded-control font-home text-body font-semibold transition-colors ${
    collapsed ? 'justify-center px-0' : 'px-3'
  } ${active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-accent-soft/60'}`;

  const inner = (
    <>
      <span className={`flex min-w-0 items-center gap-2.5 ${collapsed ? '' : 'flex-1'}`}>
        <ShellIcon name={icon} />
        {collapsed ? null : <span className="truncate">{label}</span>}
      </span>
      {trailing && !collapsed ? (
        <Icon
          icon={ICON.arrow}
          className={`size-5 transition-transform ${expanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`${base} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        title={collapsed ? label : undefined}
      >
        {inner}
      </Link>
    );
  }

  return (
    <ButtonBase
      type="button"
      onClick={onToggle}
      className={base}
      title={collapsed ? label : undefined}
    >
      {inner}
    </ButtonBase>
  );
}

function NavSection({
  entry,
  collapsed,
  pathname,
  t,
  expandedGroups,
  toggleGroup,
}: NavSectionProps) {
  const hasChildren = !!entry.items?.length;
  const childActive = entryHasActiveChild(pathname, entry);
  const selfActive = isHrefActive(pathname, entry.href, entry.matchPrefix);
  const active = selfActive || childActive;
  const expanded = expandedGroups.includes(entry.id) || childActive;

  if (!hasChildren) {
    return (
      <SidebarItem
        {...(entry.href !== undefined ? { href: entry.href } : {})}
        icon={entry.icon}
        label={t(entry.labelKey)}
        active={active}
        collapsed={collapsed}
      />
    );
  }

  const showItems = !collapsed && expanded;
  const activeIndex = (entry.items ?? []).findIndex((item) =>
    isHrefActive(pathname, item.href, item.matchPrefix),
  );

  return (
    <div className="flex flex-col">
      <SidebarItem
        icon={entry.icon}
        label={t(entry.labelKey)}
        active={active}
        trailing
        collapsed={collapsed}
        expanded={expanded}
        onToggle={() => toggleGroup(entry.id)}
      />
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          showItems ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="relative overflow-hidden pt-3" aria-hidden={!showItems}>
          {activeIndex >= 0 ? (
            <span
              className="absolute left-6 top-3 h-10 w-0.5 rounded-full bg-accent transition-transform duration-300 ease-out"
              style={{ transform: `translateY(${activeIndex * SUB_ITEM_HEIGHT_PX}px)` }}
              aria-hidden="true"
            />
          ) : null}
          {(entry.items ?? []).map((item) => (
            <SidebarSubItem
              key={item.href}
              href={item.href}
              label={t(item.labelKey)}
              active={isHrefActive(pathname, item.href, item.matchPrefix)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AppSidebar({
  collapsed,
  pathname,
  visibleNav,
  t,
  expandedGroups,
  toggleGroup,
}: AppSidebarProps) {
  return (
    <aside
      // Read by the consent banner so it centres on the content area, not on
      // the viewport behind this fixed column (RIN-719).
      data-app-sidebar={collapsed ? 'collapsed' : 'expanded'}
      className={`${styles['sidebar']} fixed left-0 z-40 hidden flex-col justify-between overflow-y-auto border-r border-line bg-surface py-6 transition-[width] duration-300 ease-out [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden ${
        collapsed ? `${styles['sidebarCollapsed']} px-3` : `${styles['sidebarExpanded']} px-5`
      }`}
    >
      <nav className="flex w-full flex-col gap-4">
        {visibleNav.map((entry) => (
          <NavSection
            key={entry.id}
            entry={entry}
            collapsed={collapsed}
            pathname={pathname}
            t={t}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
          />
        ))}
      </nav>

      <div className="flex w-full flex-col gap-4">
        <div className={`h-px bg-line ${collapsed ? 'w-full' : styles['sidebarDivider']}`} />
        {BOTTOM_NAV.map((entry) => (
          <NavSection
            key={entry.id}
            entry={entry}
            collapsed={collapsed}
            pathname={pathname}
            t={t}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
          />
        ))}
      </div>
    </aside>
  );
}

const LANG_OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
];

function LanguageDropdown({ currentLocale, onSelect }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const currentLabel = currentLocale === 'vi' ? 'Tiếng Việt' : 'English';

  return (
    <div className="relative">
      <ButtonBase
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 items-center gap-1.5 rounded-control px-2 font-home text-body text-ink hover:bg-accent-soft/60"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change language"
      >
        <Icon icon={ICON.lang} className="size-6" aria-hidden="true" />
        <span>{currentLabel}</span>
        <Icon
          icon={ICON.arrow}
          className={`size-5 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`}
          aria-hidden="true"
        />
      </ButtonBase>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className={`${styles['toolbarPopover']} absolute right-0 z-50 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg`}
          >
            {LANG_OPTIONS.map((option) => {
              const active = option.value === currentLocale;
              return (
                <ButtonBase
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!active) onSelect(option.value);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left font-home text-body transition-colors ${
                    active ? 'font-semibold text-accent' : 'text-ink hover:bg-accent-soft/60'
                  }`}
                >
                  <span>{option.label}</span>
                  {active ? (
                    <Icon
                      icon="material-symbols:check-rounded"
                      className="size-5"
                      aria-hidden="true"
                    />
                  ) : null}
                </ButtonBase>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function UserMenuDropdown({ avatar, avatarInitial, displayName, email, t }: UserMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useDropdownOutside(containerRef, open, closeMenu);

  return (
    <div className="relative" ref={containerRef}>
      <ButtonBase
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('toggleUserMenu')}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-warm font-home text-base font-semibold text-ink">
            {avatarInitial}
          </span>
        )}
      </ButtonBase>
      {open ? (
        <div
          className={`${styles['toolbarPopover']} absolute right-0 z-50 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg`}
        >
          {displayName || email ? (
            <>
              <div className="flex flex-col gap-0.5 px-4 py-3">
                {displayName ? (
                  <span className="truncate font-home text-body font-semibold text-ink">
                    {displayName}
                  </span>
                ) : null}
                {email ? (
                  <span className="truncate font-home text-sub text-ink-muted">{email}</span>
                ) : null}
              </div>
              <div className="h-px bg-line" />
            </>
          ) : null}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-home text-body text-ink transition-colors hover:bg-accent-soft/60"
          >
            <Icon icon={ICON.user} className="size-5" aria-hidden="true" />
            <span>{t('profile')}</span>
          </Link>
          <LogoutButton
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-home text-body text-ink transition-colors hover:bg-accent-soft/60"
            t={t}
          />
        </div>
      ) : null}
    </div>
  );
}

function LogoutButton({ className, t }: LogoutButtonProps) {
  const locale = useLocale();

  return (
    <form action="/api/session/logout" method="post" onSubmit={resetAnalyticsIdentity}>
      <input type="hidden" name="locale" value={locale} />
      <ButtonBase type="submit" className={className}>
        <Icon icon={ICON.logout} className="size-5" aria-hidden="true" />
        <span>{t('logout')}</span>
      </ButtonBase>
    </form>
  );
}

/** What a guest gets in place of the account menu (RIN-958). */
function GuestAuthLinks({ callbackPath, t }: GuestAuthLinksProps) {
  return (
    <>
      <Link href={withAuthCallback(ROUTES.LOGIN, callbackPath)} className="btn btn-secondary">
        {t('signIn')}
      </Link>
      <Link href={withAuthCallback(ROUTES.REGISTER, callbackPath)} className="btn btn-primary">
        {t('register')}
      </Link>
    </>
  );
}

function CreditBalanceBadge({ balance, loading, t }: CreditBalanceBadgeProps) {
  const formattedBalance = balance?.toLocaleString();
  const label = loading
    ? t('creditBalanceLoading')
    : balance === undefined
      ? t('creditBalanceUnavailable')
      : `${formattedBalance} ${t('credits')}`;

  return (
    <Link
      href={ROUTES.PREMIUM_QUIZZES}
      aria-label={label}
      title={label}
      className="flex h-11 min-w-[76px] items-center justify-center gap-1.5 rounded-control border border-accent/25 bg-accent-soft/45 px-2.5 font-home text-sm font-bold tabular-nums text-ink transition-[background-color,border-color,transform] hover:border-accent/50 hover:bg-accent-soft/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Image
        src="/images/premium-credit-coin.png"
        alt=""
        width={32}
        height={32}
        sizes="32px"
        className="size-8 shrink-0 object-contain"
        aria-hidden="true"
      />
      <span>{loading ? '…' : (formattedBalance ?? '—')}</span>
    </Link>
  );
}

function AppTopbar({
  collapsed,
  onToggleSidebar,
  mobileMenuOpen,
  onToggleMobileMenu,
  currentLocale,
  onSelectLocale,
  creditBalance,
  creditLoading,
  account,
  authCallbackPath,
  avatar,
  avatarInitial,
  displayName,
  email,
  t,
}: AppTopbarProps) {
  return (
    <header
      className={`${styles['topbar']} fixed inset-x-0 top-0 z-50 flex border-b border-line bg-surface`}
    >
      <div
        className={`relative hidden h-full items-center border-r border-line transition-[width] duration-300 ease-out lg:flex ${
          collapsed
            ? `${styles['topbarSidebarCollapsed']} justify-center px-3`
            : `${styles['topbarSidebarExpanded']} justify-between px-5 lg:pl-8`
        }`}
      >
        {collapsed ? (
          <div className="group relative size-[44px] shrink-0">
            <Link
              href={ROUTES.DASHBOARD}
              className="relative flex size-[44px] items-center justify-center overflow-hidden rounded-lg transition-[opacity,transform] duration-200 ease-out group-hover:scale-90 group-hover:opacity-0"
              aria-label="RinKuzu"
            >
              <Image
                src="/images/auth_logo.webp"
                alt="RinKuzu"
                width={130}
                height={40}
                className="pointer-events-none absolute -translate-x-2 object-contain opacity-0 transition-[opacity,transform] duration-200 ease-out"
                priority
              />
              <Image
                src="/images/rinku88-icon.png"
                alt=""
                width={48}
                height={48}
                className="size-[44px] object-contain transition-[opacity,transform] duration-200 ease-out"
                aria-hidden="true"
              />
            </Link>
            <ButtonBase
              type="button"
              onClick={onToggleSidebar}
              className="pointer-events-none absolute inset-0 flex scale-90 items-center justify-center rounded-lg text-ink opacity-0 transition-[opacity,transform,background-color] duration-200 ease-out hover:bg-accent-soft/60 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100"
              aria-label="Open sidebar"
              title="Open sidebar"
              tabIndex={-1}
            >
              <Icon icon={ICON.sidebar} className="size-6" aria-hidden="true" />
            </ButtonBase>
          </div>
        ) : (
          <>
            <Link
              href={ROUTES.DASHBOARD}
              className="relative flex h-10 items-center overflow-hidden"
              aria-label="RinKuzu"
            >
              <Image
                src="/images/auth_logo.webp"
                alt="RinKuzu"
                width={130}
                height={40}
                className="object-contain opacity-100 transition-[opacity,transform] duration-200 ease-out"
                priority
              />
              <Image
                src="/images/rinku88-icon.png"
                alt=""
                width={48}
                height={48}
                className="pointer-events-none absolute size-12 translate-x-2 object-contain opacity-0 transition-[opacity,transform] duration-200 ease-out"
                aria-hidden="true"
              />
            </Link>
            <ButtonBase
              type="button"
              onClick={onToggleSidebar}
              className="flex size-10 items-center justify-center rounded-control text-ink hover:bg-accent-soft/60"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <Icon icon={ICON.sidebar} className="size-6" aria-hidden="true" />
            </ButtonBase>
          </>
        )}
      </div>

      <div className="flex h-full w-full items-center justify-between px-4 lg:hidden">
        <Link
          href={ROUTES.DASHBOARD}
          className="relative flex h-10 items-center overflow-hidden"
          aria-label="RinKuzu"
        >
          <Image
            src="/images/auth_logo.webp"
            alt="RinKuzu"
            width={130}
            height={40}
            className="object-contain"
            priority
          />
        </Link>

        <div className="flex items-center gap-2">
          {account === 'signed-in' ? (
            <CreditBalanceBadge balance={creditBalance} loading={creditLoading} t={t} />
          ) : null}
          {account === 'guest' ? (
            <Link
              href={withAuthCallback(ROUTES.LOGIN, authCallbackPath)}
              className="btn btn-primary"
            >
              {t('signIn')}
            </Link>
          ) : null}
          <ButtonBase
            type="button"
            onClick={onToggleMobileMenu}
            className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface-warm text-ink transition-colors hover:bg-accent-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-app-menu"
          >
            <span className="relative flex size-6 items-center justify-center" aria-hidden="true">
              <span
                className={`absolute h-0.5 w-6 rounded-full bg-current transition-transform duration-200 ${
                  mobileMenuOpen ? 'translate-y-0 rotate-45' : '-translate-y-2'
                }`}
              />
              <span
                className={`absolute h-0.5 w-6 rounded-full bg-current transition-opacity duration-200 ${
                  mobileMenuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`absolute h-0.5 w-6 rounded-full bg-current transition-transform duration-200 ${
                  mobileMenuOpen ? 'translate-y-0 -rotate-45' : 'translate-y-2'
                }`}
              />
            </span>
          </ButtonBase>
        </div>
      </div>

      <div className="hidden flex-1 lg:flex">
        <div
          className={`${styles['shellContent']} mx-auto flex w-full items-center justify-between gap-6 px-8`}
        >
          <form
            className={`${styles['searchForm']} w-full`}
            action={toBrowserPath(ROUTES.QUIZZES, currentLocale)}
            method="get"
            role="search"
          >
            <label className="relative block">
              <span className="sr-only">{t('lessonSearch')}</span>
              <Icon
                icon={ICON.search}
                className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-ink"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                placeholder={t('lessonSearch')}
                className={`${styles['searchInput']} h-11 w-full rounded-lg border border-line bg-surface-warm pr-4 font-home text-body text-ink outline-none placeholder:text-ink-muted focus:border-accent`}
              />
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-3">
            {account === 'signed-in' ? (
              <CreditBalanceBadge balance={creditBalance} loading={creditLoading} t={t} />
            ) : null}

            <ButtonBase
              type="button"
              className="flex h-11 w-12 items-center justify-center rounded-control text-ink hover:bg-accent-soft/60"
              aria-label="Notifications"
            >
              <Icon icon={ICON.bell} className="size-6" aria-hidden="true" />
            </ButtonBase>

            <LanguageDropdown currentLocale={currentLocale} onSelect={onSelectLocale} />

            {account === 'signed-in' ? (
              <UserMenuDropdown
                {...(avatar !== undefined ? { avatar } : {})}
                avatarInitial={avatarInitial}
                {...(displayName !== undefined ? { displayName } : {})}
                {...(email !== undefined ? { email } : {})}
                t={t}
              />
            ) : null}
            {account === 'guest' ? <GuestAuthLinks callbackPath={authCallbackPath} t={t} /> : null}
            {account === 'unknown' ? <span className="size-11" aria-hidden="true" /> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

const MOBILE_ACCOUNT_ROW =
  'flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left font-home text-body font-semibold text-ink transition-colors hover:bg-accent-soft/60';

function MobileMenuItem({ href, icon, label, active, onNavigate }: MobileMenuItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex h-12 items-center gap-3 rounded-lg px-3 font-home text-body font-semibold transition-colors ${
        active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-accent-soft/60'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      {icon ? <ShellIcon name={icon} /> : <span className="ml-9" aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileMenuGroup({ entry, pathname, t, onNavigate }: MobileMenuGroupProps) {
  const childActive = entryHasActiveChild(pathname, entry);
  const selfActive = isHrefActive(pathname, entry.href, entry.matchPrefix);
  const active = selfActive || childActive;

  return (
    <div className="flex flex-col gap-1">
      {entry.href ? (
        <MobileMenuItem
          href={entry.href}
          icon={entry.icon}
          label={t(entry.labelKey)}
          active={active}
          onNavigate={onNavigate}
        />
      ) : (
        <div
          className={`flex h-12 items-center gap-3 rounded-lg px-3 font-home text-body font-semibold ${
            active ? 'bg-accent-soft text-accent' : 'text-ink'
          }`}
        >
          <ShellIcon name={entry.icon} />
          <span className="truncate">{t(entry.labelKey)}</span>
        </div>
      )}

      {entry.items?.length ? (
        <div className="ml-9 flex flex-col gap-1 border-l border-dashed border-line-blue/70 pl-3">
          {entry.items.map((item) => (
            <MobileMenuItem
              key={item.href}
              href={item.href}
              label={t(item.labelKey)}
              active={isHrefActive(pathname, item.href, item.matchPrefix)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileAppMenu({ open, pathname, visibleNav, account, t, onClose }: MobileAppMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-[60] lg:hidden">
      <ButtonBase
        type="button"
        className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]"
        aria-label={t('dismissMenu')}
        onClick={onClose}
      />
      <nav
        id="mobile-app-menu"
        className={`${styles['mobileMenu']} absolute left-3 right-3 top-3 overflow-y-auto border border-line bg-surface p-3`}
        aria-label={t('mainNavigation')}
      >
        <div className="flex flex-col gap-2">
          {visibleNav.map((entry) => (
            <MobileMenuGroup
              key={entry.id}
              entry={entry}
              pathname={pathname}
              t={t}
              onNavigate={onClose}
            />
          ))}
        </div>
        <div className="my-3 h-px bg-line" />
        <div className="flex flex-col gap-2">
          {BOTTOM_NAV.map((entry) => (
            <MobileMenuGroup
              key={entry.id}
              entry={entry}
              pathname={pathname}
              t={t}
              onNavigate={onClose}
            />
          ))}
        </div>
        {account === 'signed-in' ? (
          <>
            <div className="my-3 h-px bg-line" />
            <LogoutButton className={MOBILE_ACCOUNT_ROW} t={t} />
          </>
        ) : null}
        {account === 'guest' ? (
          <>
            <div className="my-3 h-px bg-line" />
            <div className="flex flex-col gap-2">
              <Link
                href={withAuthCallback(ROUTES.LOGIN, pathname)}
                onClick={onClose}
                className={MOBILE_ACCOUNT_ROW}
              >
                <Icon icon={ICON.login} className="size-5" aria-hidden="true" />
                <span>{t('signIn')}</span>
              </Link>
              <Link
                href={withAuthCallback(ROUTES.REGISTER, pathname)}
                onClick={onClose}
                className={MOBILE_ACCOUNT_ROW}
              >
                <Icon icon={ICON.user} className="size-5" aria-hidden="true" />
                <span>{t('register')}</span>
              </Link>
            </div>
          </>
        ) : null}
      </nav>
    </div>
  );
}

export function AppChrome({ children }: AppChromeProps) {
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const { data: creditData, isLoading: creditLoading } = useSWR(
    session?.user ? '/api/credits' : null,
    fetchCreditWallet,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    },
  );

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuState, setMobileMenuState] = useState({ pathname, open: false });
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['quiz', 'adaptive', 'account']);
  const mobileMenuOpen = mobileMenuState.pathname === pathname ? mobileMenuState.open : false;

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const account: AccountState =
    sessionStatus === 'authenticated' && session?.user
      ? 'signed-in'
      : sessionStatus === 'unauthenticated'
        ? 'guest'
        : 'unknown';

  const visibleNav = PRIMARY_NAV.filter(
    (entry) => !entry.requiredRole || entry.requiredRole === userRole,
  );

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const currentLocale = useLocale();
  const selectLocale = (locale: AppLocale) => router.replace(pathname, { locale });

  const avatar = session?.user?.avatar;
  const avatarInitial = (session?.user?.displayName || session?.user?.email || 'U')
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <a
        href="#app-main-content"
        className="sr-only z-[100] rounded-md bg-surface px-4 py-3 font-home font-semibold text-ink shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {t('skipToContent')}
      </a>
      <AppTopbar
        collapsed={collapsed}
        onToggleSidebar={() => setCollapsed((prev) => !prev)}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() =>
          setMobileMenuState((prev) => ({
            pathname,
            open: prev.pathname === pathname ? !prev.open : true,
          }))
        }
        currentLocale={currentLocale}
        onSelectLocale={selectLocale}
        creditBalance={creditData?.wallet.balance}
        creditLoading={creditLoading}
        account={account}
        authCallbackPath={pathname}
        {...(avatar !== undefined ? { avatar } : {})}
        avatarInitial={avatarInitial}
        {...(session?.user?.displayName !== undefined
          ? { displayName: session.user.displayName }
          : {})}
        {...(session?.user?.email !== undefined ? { email: session.user.email } : {})}
        t={t}
      />
      <MobileAppMenu
        open={mobileMenuOpen}
        pathname={pathname}
        visibleNav={visibleNav}
        account={account}
        t={t}
        onClose={() => setMobileMenuState({ pathname, open: false })}
      />
      <AppSidebar
        collapsed={collapsed}
        pathname={pathname}
        visibleNav={visibleNav}
        t={t}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
      />
      <div
        id="app-main-content"
        tabIndex={-1}
        className={`${styles['mainContent']} transition-[padding] duration-300 ease-out ${
          collapsed ? styles['mainContentCollapsed'] : styles['mainContentExpanded']
        }`}
      >
        {children}
      </div>
      {sessionStatus === 'authenticated' && userRole !== 'admin' ? (
        <>
          <FloatingSupportButton />
          <MarketingPreferencePrompt />
        </>
      ) : null}
    </>
  );
}
