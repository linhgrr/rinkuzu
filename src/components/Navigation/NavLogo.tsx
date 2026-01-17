import Link from 'next/link';
import Image from 'next/image';

/**
 * Static logo component - can be used in Server Components
 * No 'use client' directive needed as it's purely presentational
 */
export function NavLogo() {
  return (
    <Link href="/" className="flex items-center group">
      <div className="h-10 flex items-center justify-center transition-transform group-hover:scale-105">
        <Image
          src="https://i.ibb.co/WWGXBZXm/image-removebg-preview.png"
          alt="RinKuzu Logo"
          width={150}
          height={40}
          className="h-10 w-auto object-contain"
        />
      </div>
    </Link>
  );
}
