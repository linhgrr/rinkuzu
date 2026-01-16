import Link from 'next/link';
import { HiOutlineLightBulb } from 'react-icons/hi';

/**
 * Static logo component - can be used in Server Components
 * No 'use client' directive needed as it's purely presentational
 */
export function NavLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <div className="w-8 h-8 bg-[#0071e3] rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
        <HiOutlineLightBulb className="w-5 h-5 text-white" />
      </div>
      <span className="text-lg font-semibold text-[#1d1d1f] hidden sm:block">
        RinKuzu
      </span>
    </Link>
  );
}
