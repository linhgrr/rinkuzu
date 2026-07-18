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
    <header className="fixed w-full top-0 left-0 bg-[#151419]/80 backdrop-blur-md border-b border-white/5 shadow-[0px_7px_8.8px_0px_rgba(0,0,0,0.15)] z-50">
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
              className="cursor-pointer hover:text-[#fd761a] transition-colors leading-[1.5]"
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
                className="border border-[#ff541b] flex h-[44px] lg:h-[48px] items-center justify-center px-6 lg:px-[32px] rounded-[100px] hover:bg-[#ff541b]/10 transition-colors"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  Login
                </span>
              </Link>
              <Link
                href="/register"
                className="bg-[#ff541b] flex h-[44px] lg:h-[48px] items-center justify-center px-6 lg:px-[32px] rounded-[100px] hover:bg-[#fd761a] transition-colors"
              >
                <span className="font-unbounded font-medium text-sm lg:text-[18px] text-white whitespace-nowrap leading-[1.5]">
                  Sign up
                </span>
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="bg-[#ff541b] flex h-[44px] lg:h-[48px] items-center justify-center px-6 lg:px-[32px] rounded-[100px] hover:bg-[#fd761a] transition-colors"
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
            className="text-white hover:text-[#fd761a]"
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
        <div className="md:hidden bg-[#151419]/95 border-t border-white/5">
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="font-unbounded font-normal text-white text-[16px] py-3 px-2 rounded-lg hover:bg-white/5 transition-colors"
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
                    className="border border-[#ff541b] flex h-[48px] items-center justify-center rounded-[100px]"
                  >
                    <span className="font-unbounded font-medium text-[16px] text-white">Login</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="bg-[#ff541b] flex h-[48px] items-center justify-center rounded-[100px]"
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
                  className="bg-[#ff541b] flex h-[48px] items-center justify-center rounded-[100px]"
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
