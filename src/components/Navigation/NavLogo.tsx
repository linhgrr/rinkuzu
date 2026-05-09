import Link from 'next/link';
import Image from 'next/image';

/**
 * Static logo component - can be used in Server Components
 * No 'use client' directive needed as it's purely presentational
 */
export function NavLogo() {
  return (
    <Link href="/" className="flex items-center group">
      <div className="h-11 flex items-center justify-center transition-transform group-hover:scale-105">
        <Image
          src="/images/auth_logo.webp"
          alt="RinKuzu Logo"
          width={165}
          height={44}
          sizes="165px"
          className="h-11 w-auto object-contain"
          style={{ width: 'auto' }}
        />
      </div>
    </Link>
  );
}
