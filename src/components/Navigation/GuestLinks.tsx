'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/**
 * Guest navigation links - component for non-authenticated users with i18n support
 */
export function GuestLinks() {
  const t = useTranslations('nav');

  return (
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          {t('signIn')}
        </Button>
      </Link>
      <Link href="/register">
        <Button variant="primary" size="sm">
          {t('getStarted')}
        </Button>
      </Link>
    </div>
  );
}
