'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  HiOutlineClock,
  HiOutlineBookmark,
  HiOutlineSparkles,
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineTag,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX
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
  menuRef: React.RefObject<HTMLDivElement>;
}

const UserMenu = memo(function UserMenu({ session, isOpen, onToggle, onClose, menuRef }: UserMenuProps) {
  const t = useTranslations('nav');

  const handleSignOut = useCallback(() => {
    onClose();
    signOut();
  }, [onClose]);

  return (
    <div className="relative ml-2" ref={menuRef}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
      >
        <div className="w-7 h-7 bg-[#0071e3] rounded-full flex items-center justify-center text-white text-sm font-medium">
          {session.user?.email?.charAt(0).toUpperCase()}
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />

          <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-apple-xl border border-gray-100 overflow-hidden z-20 animate-scaleIn origin-top-right">
            {/* User Header */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-[#0071e3] rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {session.user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                    {session.user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-[#86868b] truncate">
                    {session.user?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <Link
                href="/profile?tab=history"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-[#1d1d1f] hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineClock className="w-5 h-5 text-[#86868b]" />
                {t('history')}
              </Link>

              <Link
                href="/profile?tab=bookmarks"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-[#1d1d1f] hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineBookmark className="w-5 h-5 text-[#86868b]" />
                {t('bookmarks')}
              </Link>

              <Link
                href="/subscription"
                className="flex items-center gap-3 px-5 py-2.5 text-sm text-[#1d1d1f] hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={onClose}
              >
                <HiOutlineSparkles className="w-5 h-5 text-[#86868b]" />
                {t('premium')}
              </Link>

              {(session.user as any)?.role === 'admin' && (
                <>
                  <div className="h-px bg-gray-100 my-2" />
                  <Link
                    href="/admin/queue"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm text-[#af52de] hover:bg-purple-50 transition-colors cursor-pointer"
                    onClick={onClose}
                  >
                    <HiOutlineDocumentText className="w-5 h-5" />
                    {t('reviewQueue')}
                  </Link>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm text-[#af52de] hover:bg-purple-50 transition-colors cursor-pointer"
                    onClick={onClose}
                  >
                    <HiOutlineUsers className="w-5 h-5" />
                    {t('users')}
                  </Link>
                  <Link
                    href="/admin/categories"
                    className="flex items-center gap-3 px-5 py-2.5 text-sm text-[#af52de] hover:bg-purple-50 transition-colors cursor-pointer"
                    onClick={onClose}
                  >
                    <HiOutlineTag className="w-5 h-5" />
                    {t('categories')}
                  </Link>
                </>
              )}
            </div>

            {/* Sign Out */}
            <div className="border-t border-gray-100 p-2">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#ff3b30] hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              >
                <HiOutlineLogout className="w-5 h-5" />
                {t('signOut')}
              </button>
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
}

const MobileMenu = memo(function MobileMenu({ session, isOpen, onClose }: MobileMenuProps) {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');

  const handleSignOut = useCallback(() => {
    onClose();
    signOut();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="md:hidden border-t border-gray-100 py-4 animate-fadeIn">
      <div className="space-y-1">
        {session ? (
          <>
            {/* User Info */}
            <div className="flex items-center gap-3 px-3 py-3 mb-3 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-[#0071e3] rounded-full flex items-center justify-center text-white font-medium">
                {session.user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1d1d1f] truncate">{session.user?.email}</p>
                <p className="text-xs text-[#86868b]">
                  {(session.user as any)?.role === 'admin' ? tAuth('administrator') : tAuth('user')}
                </p>
              </div>
            </div>

            <Link href="/" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('home')}
            </Link>
            <Link href="/create" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('createQuiz')}
            </Link>
            <Link href="/explore" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('explore')}
            </Link>
            <Link href="/profile?tab=quizzes" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('profile')}
            </Link>
            <Link href="/profile?tab=history" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('history')}
            </Link>
            <Link href="/profile?tab=bookmarks" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('bookmarks')}
            </Link>

            {(session.user as any)?.role === 'admin' && (
              <>
                <div className="h-px bg-gray-200 my-3" />
                <Link href="/admin/queue" className="block px-4 py-3 text-sm font-medium text-[#af52de] hover:bg-purple-50 rounded-xl transition-colors" onClick={onClose}>
                  {t('adminPanel')}
                </Link>
              </>
            )}

            <div className="h-px bg-gray-200 my-3" />

            {/* Language Switcher in Mobile */}
            <div className="px-4 py-2">
              <LanguageSwitcher />
            </div>

            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-3 text-sm font-medium text-[#ff3b30] hover:bg-red-50 rounded-xl transition-colors"
            >
              {t('signOut')}
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="block px-4 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 rounded-xl transition-colors" onClick={onClose}>
              {t('signIn')}
            </Link>
            <Link href="/register" className="block px-4 py-3 text-sm font-medium text-[#0071e3] hover:bg-blue-50 rounded-xl transition-colors" onClick={onClose}>
              {t('getStarted')}
            </Link>
            <div className="h-px bg-gray-200 my-3" />
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
}

/**
 * Client-side Navigation component with interactive features
 * Composes static components (NavLogo, NavLinks, GuestLinks) with
 * interactive client components (UserMenu, MobileMenu)
 */
export default function NavigationClient({ className = '' }: NavigationClientProps) {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
  }, [isUserMenuOpen]);

  const handleUserMenuToggle = useCallback(() => {
    setIsUserMenuOpen(prev => !prev);
  }, []);

  const handleUserMenuClose = useCallback(() => {
    setIsUserMenuOpen(false);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const isAdmin = (session?.user as any)?.role === 'admin';

  return (
    <nav className={`sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/50 ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo - Static Component */}
          <NavLogo />

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {session ? (
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
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              {isMenuOpen ? (
                <HiOutlineX className="w-5 h-5 text-[#1d1d1f]" />
              ) : (
                <HiOutlineMenu className="w-5 h-5 text-[#1d1d1f]" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <MobileMenu
          session={session}
          isOpen={isMenuOpen}
          onClose={handleMobileMenuClose}
        />
      </div>
    </nav>
  );
}
