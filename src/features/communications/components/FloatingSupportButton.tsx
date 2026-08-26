'use client';

import { MessageCircleQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function FloatingSupportButton() {
  const t = useTranslations('communications.floatingSupport');
  return (
    <Link
      href="/support"
      aria-label={t('label')}
      title={t('title')}
      className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:bottom-6 lg:right-6"
    >
      <MessageCircleQuestion className="size-6" aria-hidden="true" />
    </Link>
  );
}
