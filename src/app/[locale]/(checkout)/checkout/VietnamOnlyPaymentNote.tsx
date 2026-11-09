'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

/**
 * PayOS takes VND from Vietnamese banking apps only, so /en learners are told
 * before they pay and pointed to support if they are abroad (RIN-1277).
 * Renders nothing on /vi.
 */
export function VietnamOnlyPaymentNote() {
  const t = useTranslations('checkout');
  const locale = useLocale();
  if (locale !== 'en') return null;

  return (
    <p className="mt-3 text-sm leading-6 text-ink-muted">
      {t.rich('paymentMethod.vietnamOnlyNote', {
        support: (chunks) => (
          <Link href={ROUTES.SUPPORT} className="font-medium text-ink underline underline-offset-2">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
