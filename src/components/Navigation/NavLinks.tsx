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
          className="px-4 py-2 text-base font-semibold text-neutral-600 hover:text-brand-trust rounded-full transition-colors"
        >
          {t(link.labelKey)}
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin/queue"
          className="px-4 py-2 text-base font-semibold text-brand-trust hover:text-brand-trust-hover rounded-full transition-colors"
        >
          {t('admin')}
        </Link>
      )}
    </>
  );
}
