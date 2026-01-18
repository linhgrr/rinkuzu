'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';

/**
 * Guest navigation links - static component for non-authenticated users
 */
export function GuestLinks() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          {t('auth.signIn')}
        </Button>
      </Link>
      <Link href="/register">
        <Button variant="primary" size="sm">
          {t('auth.getStarted')}
        </Button>
      </Link>
    </div>
  );
}
