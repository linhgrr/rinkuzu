'use client';

import Image from 'next/image';
import { getSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import type { MarketingHeaderPosition } from '@/lib/routing/pathname';
import { LandingCtaLink } from '@/features/landing/components/home/LandingCtaLink';

const NAV_LINKS = [
  { key: 'explore', href: '/explore', current: null },
  { key: 'blog', href: '/blog', current: 'blog_header' },
  { key: 'pricing', href: '/pricing', current: 'pricing_header' },
] as const;

const NAV_LINK_CLASS =
  'inline-flex h-11 items-center border-b-2 text-sm font-medium transition-colors hover:text-ink';

/**
 * Whether a signed-in session exists, read once after mount. The marketing
 * layout has no SessionProvider and its pages are static (blog posts are ISR),
 * so the server HTML is always the signed-out header and this swaps the
 * actions in place (RIN-1519). One GET, no broadcast (see SingleSessionGuard).
 */
function useSignedInAfterMount(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    getSession({ broadcast: false }).then(
      (session) => {
        if (active && session?.user) setSignedIn(true);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);

  return signedIn;
}

/** Calls `onOutside` for a pointer press outside `ref` while `active` (RIN-1519 design review). */
function useOutsidePointerDown(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
): void {
  const onOutsideEvent = useEffectEvent(onOutside);

  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      onOutsideEvent();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [active, ref]);
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

/**
 * Light, sticky site header of the marketing content pages: blog, pricing,
 * about, FAQ, contact and the legal pages (RIN-1519). Logo, Explore / Blog /
 * Pricing, and Sign in + Sign up, or Dashboard once signed in. Below 1024 px
 * the primary action stays in the bar and the rest moves into a menu.
 * Action clicks report `landing_cta_clicked` with the page's header position.
 */
export function MarketingHeader({ position }: { position: MarketingHeaderPosition }) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const signedIn = useSignedInAfterMount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const menuId = useId();

  const closeMenu = () => setMenuOpen(false);
  useOutsidePointerDown(headerRef, menuOpen, closeMenu);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !menuOpen) return;
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  const primaryAction = signedIn ? (
    <LandingCtaLink
      href="/dashboard"
      cta="dashboard"
      position={position}
      locale={locale}
      className="btn btn-primary min-w-36 px-3 sm:px-4"
    >
      {t('dashboard')}
    </LandingCtaLink>
  ) : (
    <LandingCtaLink
      href="/register"
      cta="register"
      position={position}
      locale={locale}
      className="btn btn-primary min-w-36 px-3 sm:px-4"
    >
      {t('register')}
    </LandingCtaLink>
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-surface px-4 py-3 font-home font-semibold text-ink shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {t('skipToContent')}
      </a>
      <header
        ref={headerRef}
        className="marketing-header sticky top-0 z-40 border-b border-line bg-surface"
        onKeyDown={onKeyDown}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
          <Link href="/" aria-label={t('home')} className="flex shrink-0 items-center">
            <Image
              src="/images/auth_logo.webp"
              alt="RinKuzu"
              width={130}
              height={40}
              loading="eager"
              sizes="120px"
              className="h-7 w-auto object-contain lg:h-8"
            />
          </Link>
          <nav aria-label={t('mainNavigation')} className="hidden lg:block">
            <ul className="flex items-center gap-4 xl:gap-6">
              {NAV_LINKS.map((link) => {
                const isCurrent = link.current === position;
                return (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`${NAV_LINK_CLASS} ${
                        isCurrent ? 'border-accent text-ink' : 'border-transparent text-ink-muted'
                      }`}
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? null : (
              <LandingCtaLink
                href="/login"
                cta="signin"
                position={position}
                locale={locale}
                className="btn btn-ghost hidden lg:inline-flex"
              >
                {t('signIn')}
              </LandingCtaLink>
            )}
            {primaryAction}
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon open={menuOpen} />
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <div
            id={menuId}
            data-testid="marketing-header-menu"
            className="border-t border-line bg-surface lg:hidden"
          >
            <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6">
              {NAV_LINKS.map((link) => {
                const isCurrent = link.current === position;
                return (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={closeMenu}
                      className={`flex h-11 items-center border-l-2 pl-3 text-base text-ink ${
                        isCurrent ? 'border-accent font-semibold' : 'border-transparent font-medium'
                      }`}
                    >
                      {t(link.key)}
                    </Link>
                  </li>
                );
              })}
              {signedIn ? null : (
                <li className="border-t border-line">
                  <LandingCtaLink
                    href="/login"
                    cta="signin"
                    position={position}
                    locale={locale}
                    onNavigate={closeMenu}
                    className="flex h-11 items-center pl-3.5 text-base font-medium text-ink"
                  >
                    {t('signIn')}
                  </LandingCtaLink>
                </li>
              )}
            </ul>
          </div>
        ) : null}
      </header>
    </>
  );
}
