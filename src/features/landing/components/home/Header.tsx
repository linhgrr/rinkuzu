'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'My Learning', href: '/adaptive' },
  { label: 'Upload PDF', href: '/adaptive/upload' },
];

interface HeaderProps {
  isAuthenticated?: boolean;
}

export default function Header({ isAuthenticated = false }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-[var(--landing-nav-surface)] shadow-[var(--landing-nav-shadow)] backdrop-blur-md">
      <a
        href="#landing-main-content"
        className="sr-only z-[60] rounded-lg bg-[var(--landing-nav-surface-mobile)] px-4 py-3 font-unbounded text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-[var(--landing-nav-accent-hover)]"
      >
        Skip to main content
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
        <nav className="hidden md:flex font-unbounded font-normal items-center justify-center gap-8 lg:gap-16 text-base lg:text-[20px] text-white">
          {NAV_LINKS.map((link) => (
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
        <div className="hidden md:flex gap-4 items-center justify-end">
          {!isAuthenticated ? (
            <>
              <Link
                href="/login"
                className="flex h-[44px] items-center justify-center rounded-[100px] border border-[var(--landing-nav-accent)] px-6 transition-colors hover:bg-[var(--landing-nav-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)] lg:h-[48px] lg:px-[32px]"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  Login
                </span>
              </Link>
              <Link
                href="/register"
                className="flex h-[44px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] px-6 transition-colors hover:bg-[var(--landing-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)] lg:h-[48px] lg:px-[32px]"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  Sign up
                </span>
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="flex h-[44px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] px-6 transition-colors hover:bg-[var(--landing-nav-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)] lg:h-[48px] lg:px-[32px]"
            >
              <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                Dashboard
              </span>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
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
          className="border-t border-white/5 bg-[var(--landing-nav-surface-mobile)] md:hidden"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
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
                    <span className="font-unbounded font-medium text-[16px] text-white">Login</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-[48px] items-center justify-center rounded-[100px] bg-[var(--landing-nav-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-nav-accent-hover)]"
                  >
                    <span className="font-unbounded font-medium text-[16px] text-white">
                      Sign up
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
                    Dashboard
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
