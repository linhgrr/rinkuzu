'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { toBrowserPath } from '@/lib/routing/pathname';
import { DESKTOP_BOTTOM_NAV, DESKTOP_PRIMARY_NAV } from '@/shared/constants/nav';
import { ROUTES } from '@/shared/constants/routes';
import { useDropdownOutside } from '@/components/ui/hooks/use-dropdown-outside';

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
  user: 'solar:user-circle-linear',
  logout: 'solar:logout-2-linear',
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

interface AppTopbarProps extends UserMenuDropdownProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  currentLocale: string;
  onSelectLocale: (locale: AppLocale) => void;
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
      className={`relative flex h-10 items-center gap-2.5 pl-6 pr-2.5 font-home text-base leading-[1.4] transition-colors ${
        active ? 'font-semibold text-accent' : 'font-normal text-ink hover:text-accent'
      }`}
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
  const base = `flex h-12 w-full items-center rounded-[10px] font-home text-base font-semibold leading-[1.4] transition-colors ${
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
      <Link href={href} className={base} title={collapsed ? label : undefined}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onToggle} className={base} title={collapsed ? label : undefined}>
      {inner}
    </button>
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
      className={`fixed left-0 top-[72px] z-40 hidden h-[calc(100vh-72px)] flex-col justify-between overflow-y-auto border-r border-line bg-surface py-6 transition-[width] duration-300 ease-out [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden ${
        collapsed ? 'w-[88px] px-3' : 'w-[280px] px-5'
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
        <div className={`h-px bg-line ${collapsed ? 'w-full' : 'w-[220px]'}`} />
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
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 items-center gap-1.5 rounded-[10px] px-2 font-home text-base leading-[1.4] text-ink hover:bg-accent-soft/60"
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
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-[52px] z-50 w-44 overflow-hidden rounded-[12px] border border-line bg-surface py-1 shadow-lg">
            {LANG_OPTIONS.map((option) => {
              const active = option.value === currentLocale;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!active) onSelect(option.value);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left font-home text-base leading-[1.4] transition-colors ${
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
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function UserMenuDropdown({ avatar, avatarInitial, displayName, email, t }: UserMenuDropdownProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  useDropdownOutside(containerRef, open, closeMenu);

  return (
    <div className="relative" ref={containerRef}>
      <button
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
      </button>
      {open ? (
        <div className="absolute right-0 top-[52px] z-50 w-56 overflow-hidden rounded-[12px] border border-line bg-surface py-1 shadow-lg">
          {displayName || email ? (
            <>
              <div className="flex flex-col gap-0.5 px-4 py-3">
                {displayName ? (
                  <span className="truncate font-home text-base font-semibold leading-[1.4] text-ink">
                    {displayName}
                  </span>
                ) : null}
                {email ? (
                  <span className="truncate font-home text-sm leading-[1.4] text-ink-muted">
                    {email}
                  </span>
                ) : null}
              </div>
              <div className="h-px bg-line" />
            </>
          ) : null}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-home text-base leading-[1.4] text-ink transition-colors hover:bg-accent-soft/60"
          >
            <Icon icon={ICON.user} className="size-5" aria-hidden="true" />
            <span>{t('profile')}</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: toBrowserPath(ROUTES.HOME, locale) });
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-home text-base leading-[1.4] text-ink transition-colors hover:bg-accent-soft/60"
          >
            <Icon icon={ICON.logout} className="size-5" aria-hidden="true" />
            <span>{t('logout')}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AppTopbar({
  collapsed,
  onToggleSidebar,
  mobileMenuOpen,
  onToggleMobileMenu,
  currentLocale,
  onSelectLocale,
  avatar,
  avatarInitial,
  displayName,
  email,
  t,
}: AppTopbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 border-b border-line bg-surface lg:h-[72px]">
      <div
        className={`relative hidden h-full items-center border-r border-line transition-[width] duration-300 ease-out lg:flex ${
          collapsed
            ? 'justify-center px-3 lg:w-[88px]'
            : 'justify-between px-5 lg:w-[280px] lg:pl-8'
        }`}
      >
        {collapsed ? (
          <div className="group relative size-[44px] shrink-0">
            <Link
              href={ROUTES.DASHBOARD}
              className="relative flex size-[44px] items-center justify-center overflow-hidden rounded-[12px] transition-[opacity,transform] duration-200 ease-out group-hover:scale-90 group-hover:opacity-0"
              aria-label="RinKuzu"
            >
              <Image
                src="/images/auth_logo.webp"
                alt="RinKuzu"
                width={130}
                height={40}
                className="pointer-events-none absolute h-[40px] w-auto -translate-x-2 object-contain opacity-0 transition-[opacity,transform] duration-200 ease-out"
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
            <button
              type="button"
              onClick={onToggleSidebar}
              className="pointer-events-none absolute inset-0 flex scale-90 items-center justify-center rounded-[12px] text-ink opacity-0 transition-[opacity,transform,background-color] duration-200 ease-out hover:bg-accent-soft/60 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100"
              aria-label="Open sidebar"
              title="Open sidebar"
              tabIndex={-1}
            >
              <Icon icon={ICON.sidebar} className="size-6" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <Link
              href={ROUTES.DASHBOARD}
              className="relative flex h-[40px] items-center overflow-hidden"
              aria-label="RinKuzu"
            >
              <Image
                src="/images/auth_logo.webp"
                alt="RinKuzu"
                width={130}
                height={40}
                className="h-[40px] w-auto object-contain transition-[opacity,transform] duration-200 ease-out opacity-100"
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
            <button
              type="button"
              onClick={onToggleSidebar}
              className="flex size-10 items-center justify-center rounded-[10px] text-ink hover:bg-accent-soft/60"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <Icon icon={ICON.sidebar} className="size-6" aria-hidden="true" />
            </button>
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
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="flex size-11 items-center justify-center rounded-[12px] border border-line bg-surface-warm text-ink transition-colors hover:bg-accent-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        </button>
      </div>

      <div className="hidden flex-1 lg:flex">
        <div className="mx-auto flex w-full max-w-[1404px] items-center justify-between gap-6 px-8">
          <form
            className="w-full max-w-[486px]"
            action={toBrowserPath(ROUTES.EXPLORE, currentLocale)}
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
                className="h-11 w-full rounded-[12px] border border-line bg-surface-warm pl-[52px] pr-4 font-home text-base text-ink outline-none placeholder:text-ink-muted focus:border-accent"
              />
            </label>
          </form>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="flex h-11 w-12 items-center justify-center rounded-[10px] text-ink hover:bg-accent-soft/60"
              aria-label="Notifications"
            >
              <Icon icon={ICON.bell} className="size-6" aria-hidden="true" />
            </button>

            <LanguageDropdown currentLocale={currentLocale} onSelect={onSelectLocale} />

            <UserMenuDropdown
              {...(avatar !== undefined ? { avatar } : {})}
              avatarInitial={avatarInitial}
              {...(displayName !== undefined ? { displayName } : {})}
              {...(email !== undefined ? { email } : {})}
              t={t}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileMenuItem({ href, icon, label, active, onNavigate }: MobileMenuItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex h-12 items-center gap-3 rounded-[12px] px-3 font-home text-base font-semibold leading-[1.4] transition-colors ${
        active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-accent-soft/60'
      }`}
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
          className={`flex h-12 items-center gap-3 rounded-[12px] px-3 font-home text-base font-semibold leading-[1.4] ${
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

function MobileAppMenu({ open, pathname, visibleNav, t, onClose }: MobileAppMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]"
        aria-label={t('dismissMenu')}
        onClick={onClose}
      />
      <nav
        id="mobile-app-menu"
        className="absolute left-3 right-3 top-3 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[18px] border border-line bg-surface p-3 shadow-[0_18px_48px_rgba(42,11,0,0.18)]"
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
      </nav>
    </div>
  );
}

export function AppChrome({ children }: AppChromeProps) {
  const { data: session } = useSession();
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuState, setMobileMenuState] = useState({ pathname, open: false });
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['quiz', 'adaptive', 'account']);
  const mobileMenuOpen = mobileMenuState.pathname === pathname ? mobileMenuState.open : false;

  const userRole = (session?.user as { role?: string } | undefined)?.role;

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
        className={`pt-16 transition-[padding] duration-300 ease-out lg:pt-[72px] ${
          collapsed ? 'lg:pl-[88px]' : 'lg:pl-[280px]'
        }`}
      >
        {children}
      </div>
    </>
  );
}
