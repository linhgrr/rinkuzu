'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';

interface HeaderProps {
  isAuthenticated?: boolean;
  locale: string;
}

export default function Header({ isAuthenticated = false, locale }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isVi = locale === 'vi';
  const navLinks = [
    { label: isVi ? 'Bảng điều khiển' : 'Dashboard', href: '/dashboard' },
    { label: isVi ? 'Lộ trình của tôi' : 'My Learning', href: '/adaptive' },
    { label: isVi ? 'Tải PDF lên' : 'Upload PDF', href: '/adaptive/upload' },
  ];

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-[var(--landing-nav-surface)] shadow-[var(--landing-nav-shadow)] backdrop-blur-md">
      <a
        href="#landing-main-content"
        className="sr-only z-[60] rounded-lg bg-[var(--landing-nav-surface-mobile)] px-4 py-3 font-unbounded text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-[var(--landing-nav-accent-hover)]"
      >
        {isVi ? 'Bỏ qua đến nội dung chính' : 'Skip to main content'}
      </a>
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 md:px-12 lg:px-24 h-[80px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center" aria-label="Rinkuzu home">
          <Image
            src="/images/navbar_logo.webp"
            alt="Rinkuzu"
            width={150}
            height={40}
            priority
            sizes="150px"
            className="h-[36px] md:h-[44px] w-auto object-contain"
            style={{ width: 'auto' }}
          />
        </Link>

        {/* Navigation - Desktop */}
        <nav className="hidden items-center justify-center gap-8 whitespace-nowrap font-unbounded text-base font-normal text-white min-[1400px]:flex min-[1600px]:gap-16 min-[1600px]:text-[20px]">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="cursor-pointer leading-[1.5] transition-colors hover:text-[var(--landing-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions - Desktop */}
        <div className="hidden items-center justify-end gap-4 min-[1400px]:flex">
          {!isAuthenticated ? (
            <>
              <Link
                href="/login"
                className="flex h-[44px] items-center justify-center rounded-[100px] border border-[var(--landing-nav-accent)] px-6 transition-colors hover:bg-[var(--landing-nav-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)] lg:h-[48px] lg:px-[32px]"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  {isVi ? 'Đăng nhập' : 'Login'}
                </span>
              </Link>
              <Link
                href="/register"
                className="flex h-[44px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] px-6 transition-colors hover:bg-[var(--landing-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)] lg:h-[48px] lg:px-[32px]"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  {isVi ? 'Đăng ký' : 'Sign up'}
                </span>
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="flex h-[44px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] px-6 transition-colors hover:bg-[var(--landing-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)] lg:h-[48px] lg:px-[32px]"
            >
              <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                {isVi ? 'Bảng điều khiển' : 'Dashboard'}
              </span>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center min-[1400px]:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label={
              isMobileMenuOpen
                ? isVi
                  ? 'Đóng menu'
                  : 'Close menu'
                : isVi
                  ? 'Mở menu'
                  : 'Open menu'
            }
            aria-expanded={isMobileMenuOpen}
            aria-controls="landing-mobile-menu"
            className="flex size-11 items-center justify-center rounded-lg text-white hover:text-[var(--landing-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div
          id="landing-mobile-menu"
          className="border-t border-white/5 bg-[var(--landing-nav-surface-mobile)] min-[1400px]:hidden"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg px-2 py-3 font-unbounded text-[16px] font-normal text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
              >
                {link.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-3">
              {!isAuthenticated ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-[48px] items-center justify-center rounded-[100px] border border-[var(--landing-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
                  >
                    <span className="font-unbounded font-medium text-[16px] text-white">
                      {isVi ? 'Đăng nhập' : 'Login'}
                    </span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-[48px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
                  >
                    <span className="font-unbounded font-medium text-[16px] text-white">
                      {isVi ? 'Đăng ký' : 'Sign up'}
                    </span>
                  </Link>
                </>
              ) : (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex h-[48px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
                >
                  <span className="font-unbounded font-medium text-[16px] text-white">
                    {isVi ? 'Bảng điều khiển' : 'Dashboard'}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
