'use client';

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { label: "AI Quiz Generator", href: "/adaptive-learning" },
  { label: "Knowledge Graph Learning", href: "/adaptive-learning" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" }
];

const Navbar = ({ isAuthenticated = false }: { isAuthenticated?: boolean }) => {
  return (
    <nav className="relative z-10 flex items-center justify-between px-6 md:px-[120px] py-[20px] font-sans">
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
        <div className="hidden md:flex items-center gap-[30px]">
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

      {/* Right side - Upload PDF button */}
      <div className="flex items-center gap-4">
        {!isAuthenticated ? (
          <Link href="/login" className="text-white text-[14px] font-medium hover:underline">Login</Link>
        ) : null}
        <GlowPillButton 
          label={isAuthenticated ? "Upload PDF" : "Get Started"} 
          variant="dark" 
          href={isAuthenticated ? "/adaptive-learning/upload" : "/register"} 
        />
      </div>
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
