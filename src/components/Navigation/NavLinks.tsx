'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface NavLink {
  href: string;
  labelKey: string;
  isAdmin?: boolean;
}

const LINKS: NavLink[] = [
  { href: '/dashboard', labelKey: 'home' },
  { href: '/create', labelKey: 'create' },
  { href: '/profile', labelKey: 'profile' },
  { href: '/categories', labelKey: 'categories' },
  { href: '/explore', labelKey: 'explore' },
];

interface NavLinksProps {
  isAdmin?: boolean;
}

/**
 * Navigation links component with i18n support
 * Admin link is conditionally rendered based on isAdmin prop
 */
export function NavLinks({ isAdmin = false }: NavLinksProps) {
  const t = useTranslations('nav');

  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="px-4 py-2 text-sm font-medium text-[#1d1d1f] hover:text-[#0071e3] rounded-full transition-colors"
        >
          {t(link.labelKey)}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin/queue"
          className="px-4 py-2 text-sm font-medium text-[#af52de] hover:text-[#8944ab] rounded-full transition-colors"
        >
          {t('admin')}
        </Link>
      )}
    </>
  );
}
