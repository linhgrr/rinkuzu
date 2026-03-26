'use client';

import { useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const navLinks = [
  { label: 'AI Quiz Generator', href: '/adaptive-learning' },
  { label: 'Knowledge Graph Learning', href: '/adaptive-learning' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
];

const mobileNavLinks = [
  { label: 'AI Quiz Generator', href: '/adaptive-learning' },
  { label: 'Knowledge Graph Learning', href: '/adaptive-learning' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Login', href: '/login' },
];

const Navbar = ({ isAuthenticated = false }: { isAuthenticated?: boolean }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="relative z-10 font-sans">
      {/* Desktop nav */}
      <div className="hidden md:flex items-center justify-between px-6 md:px-[120px] py-[20px]">
        {/* Left side */}
        <div className="flex items-center gap-[30px]">
          <Image
            src="/images/navbar_logo.webp"
            alt="RinKuzu Logo"
            width={120}
            height={32}
            priority
            sizes="120px"
            className="h-[32px] w-auto object-contain"
          />
          <div className="flex items-center gap-[30px]">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                prefetch={false}
                className="flex items-center gap-[14px] text-[14px] font-medium text-white hover:opacity-80 transition-opacity"
              >
                {link.label}
                <ChevronDown size={14} className="text-white" />
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <Link href="/login" className="text-white text-[14px] font-medium hover:underline">Login</Link>
          ) : null}
          <GlowPillButton
            label={isAuthenticated ? 'Upload PDF' : 'Get Started'}
            variant="dark"
            href={isAuthenticated ? '/adaptive-learning/upload' : '/register'}
          />
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex md:hidden items-center justify-between px-6 py-[20px]">
        <Image
          src="/images/navbar_logo.webp"
          alt="RinKuzu Logo"
          width={100}
          height={28}
          priority
          sizes="100px"
          className="h-[28px] w-auto object-contain"
        />
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-white text-[14px] font-medium">Login</Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? (
              <X size={22} className="text-white" />
            ) : (
              <Menu size={22} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10 animate-fadeIn">
          <div className="px-6 py-4 space-y-1">
            {mobileNavLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                prefetch={false}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-3 px-2 text-[15px] font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3">
              <GlowPillButton
                label="Get Started"
                variant="dark"
                href="/register"
              />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export const GlowPillButton = ({
  label,
  variant = "dark",
  href = "#"
}: {
  label: string;
  variant?: "dark" | "light";
  href?: string;
}) => {
  const isDark = variant === "dark";
  return (
    <Link 
      href={href}
      className="relative rounded-full inline-block cursor-pointer transition-opacity hover:opacity-90" 
      style={{ border: "0.6px solid rgba(255,255,255,0.8)" }}
    >
      {/* Top glow streak */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] rounded-full"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
          filter: "blur(1px)",
        }}
      />
      <div
        className={`rounded-full px-[29px] py-[11px] text-[14px] font-medium ${
          isDark ? "bg-black text-white" : "bg-white text-black"
        }`}
      >
        {label}
      </div>
    </Link>
  );
};

export default Navbar;
