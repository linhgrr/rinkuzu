'use client';

import Link from 'next/link';
import { useTranslation, type TranslationKey } from '@/lib/i18n';

interface NavLink {
  href: string;
  label: TranslationKey;
  isAdmin?: boolean;
}

const LINKS: NavLink[] = [
  { href: '/', label: 'nav.home' },
  { href: '/create', label: 'nav.create' },
  { href: '/profile', label: 'nav.profile' },
  { href: '/categories', label: 'nav.categories' },
  { href: '/explore', label: 'nav.explore' },
];

interface NavLinksProps {
  isAdmin?: boolean;
}

/**
 * Static navigation links - can be used in Server Components
 * Admin link is conditionally rendered based on isAdmin prop
 */
export function NavLinks({ isAdmin = false }: NavLinksProps) {
  const { t } = useTranslation();
  return (
    <>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="px-4 py-2 text-sm font-medium text-[#1d1d1f] hover:text-[#0071e3] rounded-full transition-colors"
        >
          {t(link.label)}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin/queue"
          className="px-4 py-2 text-sm font-medium text-[#af52de] hover:text-[#8944ab] rounded-full transition-colors"
        >
          {t('nav.admin')}
        </Link>
      )}
    </>
  );
}
