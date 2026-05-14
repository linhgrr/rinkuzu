'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isAdaptiveExerciseModePath } from '@/lib/routing/pathname';
import { Button } from '@/components/ui/Button';
import {
  HiOutlineClock,
  HiOutlineBookmark,
  HiOutlineSparkles,
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineTag,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineCog,
} from '@/components/icons';
import { NavLogo } from './NavLogo';
import { NavLinks } from './NavLinks';
import { GuestLinks } from './GuestLinks';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface UserMenuProps {
  session: any;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

const UserMenu = memo(function UserMenu({
  session,
  isOpen,
  onToggle,
  onClose,
  menuRef,
}: UserMenuProps) {
  const t = useTranslations('nav');

  const handleSignOut = useCallback(() => {
    onClose();
    signOut();
  }, [onClose]);

  return (
    <div className="relative ml-2" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="flex items-center gap-2 rounded-full"
        aria-label="Toggle user menu"
      >
        {(session.user as any)?.avatar ? (
          <Image
            src={(session.user as any).avatar}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="size-7 bg-brand-trust rounded-full flex items-center justify-center text-white text-sm font-medium">
            {((session.user as any)?.displayName || session.user?.email || 'U')
              .charAt(0)
              .toUpperCase()}
          </div>
        )}
      </Button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            onClick={onClose}
            aria-label={t('closeMenu')}
          />

          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-[var(--shadow-lg)] border border-neutral-100 overflow-hidden z-20 animate-scaleIn origin-top-right">
            {/* User Header */}
            <div className="px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                {(session.user as any)?.avatar ? (
                  <Image
                    src={(session.user as any).avatar}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="size-11 bg-brand-trust rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    {((session.user as any)?.displayName || session.user?.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate">
                    {(session.user as any)?.displayName || session.user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{session.user?.email}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <Link
                href="/my-quizzes"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineDocumentText className="size-5 text-neutral-500" />
                {t('myQuizzes')}
              </Link>

              <Link
                href="/history"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineClock className="size-5 text-neutral-500" />
                {t('history')}
              </Link>

              <Link
                href="/bookmarks"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineBookmark className="size-5 text-neutral-500" />
                {t('bookmarks')}
              </Link>

              <Link
                href="/subscription"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineSparkles className="size-5 text-neutral-500" />
                {t('premium')}
              </Link>

              <div className="h-px bg-neutral-100 my-1" />

              <Link
                href="/profile"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-neutral-900 hover:bg-neutral-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineCog className="size-5 text-neutral-500" />
                {t('settings')}
              </Link>

              {(session.user as any)?.role === 'admin' && (
                <>
                  <div className="h-px bg-neutral-100 my-2" />
                  <Link
                    href="/admin/queue"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm text-brand-trust hover:bg-green-50 transition-colors cursor-pointer"
                    onClick={onClose}
                  >
                    <HiOutlineDocumentText className="size-5" />
                    {t('reviewQueue')}
                  </Link>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm text-brand-trust hover:bg-green-50 transition-colors cursor-pointer"
                    onClick={onClose}
                  >
                    <HiOutlineUsers className="size-5" />
                    {t('users')}
                  </Link>
                  <Link
                    href="/admin/categories"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm text-brand-trust hover:bg-green-50 transition-colors cursor-pointer"
                    onClick={onClose}
                  >
                    <HiOutlineTag className="size-5" />
                    {t('categories')}
                  </Link>
                </>
              )}
            </div>

            {/* Sign Out */}
            <div className="border-t border-neutral-100 p-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignOut}
                className="h-10 w-full justify-start rounded-xl px-4 text-sm text-red-500 hover:bg-red-50"
              >
                <HiOutlineLogout className="size-5" />
                {t('signOut')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

interface MobileMenuProps {
  session: any;
  isOpen: boolean;
  onClose: () => void;
  isAuthLoading?: boolean;
}

const MobileMenu = memo(function MobileMenu({
  session,
  isOpen,
  onClose,
  isAuthLoading = false,
}: MobileMenuProps) {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');

  const handleSignOut = useCallback(() => {
    onClose();
    signOut();
  }, [onClose]);

  if (!isOpen) return null;

  if (isAuthLoading) {
    return (
      <div className="md:hidden border-t border-neutral-100 bg-white py-4 animate-fadeIn">
        <div className="px-4 py-2">
          <div className="h-4 w-28 rounded skeleton-shimmer mb-3" />
          <div className="h-4 w-20 rounded skeleton-shimmer mb-3" />
          <div className="h-4 w-24 rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden border-t border-neutral-100 bg-white py-4 animate-fadeIn">
      <div className="space-y-1">
        {session ? (
          <>
            {/* User Info */}
            <div className="flex items-center gap-3 px-3 py-3 mb-3 bg-neutral-50 rounded-2xl">
              <div className="size-10 bg-brand-trust rounded-full flex items-center justify-center text-white font-medium">
                {((session.user as any)?.displayName || session.user?.email || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {(session.user as any)?.displayName || session.user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-neutral-500">
                  {(session.user as any)?.role === 'admin' ? tAuth('administrator') : tAuth('user')}
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('home')}
            </Link>
            <Link
              href="/create"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('createQuiz')}
            </Link>
            <Link
              href="/explore"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('explore')}
            </Link>
            <Link
              href="/my-quizzes"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('myQuizzes')}
            </Link>
            <Link
              href="/history"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('history')}
            </Link>
            <Link
              href="/bookmarks"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('bookmarks')}
            </Link>
            <Link
              href="/profile"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('settings')}
            </Link>

            {(session.user as any)?.role === 'admin' && (
              <>
                <div className="h-px bg-neutral-200 my-3" />
                <Link
                  href="/admin/queue"
                  className="block px-4 py-3 text-sm font-medium text-brand-trust hover:bg-green-50 rounded-xl transition-colors"
                  onClick={onClose}
                >
                  {t('adminPanel')}
                </Link>
              </>
            )}

            <div className="h-px bg-neutral-200 my-3" />

            {/* Language Switcher in Mobile */}
            <div className="px-4 py-2">
              <LanguageSwitcher />
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={handleSignOut}
              className="h-10 w-full justify-start rounded-xl px-4 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              {t('signOut')}
            </Button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="block px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('signIn')}
            </Link>
            <Link
              href="/register"
              className="block px-4 py-3 text-sm font-medium text-brand-action hover:bg-orange-50 rounded-xl transition-colors"
              onClick={onClose}
            >
              {t('getStarted')}
            </Link>
            <div className="h-px bg-neutral-200 my-3" />
            <div className="px-4 py-2">
              <LanguageSwitcher />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

interface NavigationClientProps {
  className?: string;
  transparent?: boolean;
  initialSession?: any;
}

/**
 * Client-side Navigation component with interactive features
 * Composes static components (NavLogo, NavLinks, GuestLinks) with
 * interactive client components (UserMenu, MobileMenu)
 */
export default function NavigationClient({
  className = '',
  transparent = false,
  initialSession,
}: NavigationClientProps) {
  const { data: sessionFromHook, status } = useSession();
  const isAuthLoading = !initialSession && status === 'loading';
  const session = sessionFromHook ?? initialSession;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Hide Top Navigation in exercise mode (including theory screens) to maximize screen space on mobile
  const isExerciseMode = isAdaptiveExerciseModePath(pathname || '/');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    if (transparent) {
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
      return () => window.removeEventListener('scroll', handleScroll);
    }

    return undefined;
  }, [transparent]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isUserMenuOpen]);

  const handleUserMenuToggle = useCallback(() => {
    setIsUserMenuOpen((prev) => !prev);
  }, []);

  const handleUserMenuClose = useCallback(() => {
    setIsUserMenuOpen(false);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const isAdmin = (session?.user as any)?.role === 'admin';

  const navClasses = transparent
    ? isScrolled
      ? 'nav-blur'
      : 'bg-transparent border-transparent'
    : 'nav-blur';

  const positionClass = transparent ? 'fixed' : 'sticky';

  if (isExerciseMode) {
    return null;
  }

  return (
    <nav
      className={`${positionClass} top-0 left-0 right-0 z-50 transition-colors duration-300 ${navClasses} ${className}`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-7 lg:px-10">
        <div className="flex justify-between items-center h-16 sm:h-[70px]">
          {/* Logo - Static Component */}
          <NavLogo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {isAuthLoading ? (
              <div className="flex items-center gap-2" aria-hidden="true">
                <div className="h-8 w-24 rounded-full skeleton-shimmer" />
                <div className="h-8 w-20 rounded-full skeleton-shimmer" />
                <div className="size-8 rounded-full skeleton-shimmer" />
              </div>
            ) : session ? (
              <>
                {/* Static Links */}
                <NavLinks isAdmin={isAdmin} />

                {/* Language Switcher */}
                <LanguageSwitcher />

                {/* Interactive User Menu */}
                <UserMenu
                  session={session}
                  isOpen={isUserMenuOpen}
                  onToggle={handleUserMenuToggle}
                  onClose={handleUserMenuClose}
                  menuRef={userMenuRef}
                />
              </>
            ) : (
              <>
                {/* Language Switcher for guests */}
                <LanguageSwitcher />
                {/* Static Guest Links */}
                <GuestLinks />
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleMobileMenuToggle}
              className="rounded-full"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? (
                <HiOutlineX className="size-5 text-neutral-900" />
              ) : (
                <HiOutlineMenu className="size-5 text-neutral-900" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <MobileMenu
          session={session}
          isOpen={isMenuOpen}
          onClose={handleMobileMenuClose}
          isAuthLoading={isAuthLoading}
        />
      </div>
    </nav>
  );
}
