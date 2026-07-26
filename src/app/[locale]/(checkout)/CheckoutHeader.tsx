'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { HiOutlineArrowLeft, HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import { Link, usePathname, useRouter } from '@/i18n/navigation';

type CheckoutLocale = 'en' | 'vi';

export function CheckoutHeader() {
  const locale = useLocale() as CheckoutLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('checkout.shell');
  const nextLocale: CheckoutLocale = locale === 'vi' ? 'en' : 'vi';

  const switchLocale = () => {
    const search = typeof window === 'undefined' ? '' : window.location.search;
    router.replace(`${pathname}${search}`, { locale: nextLocale });
  };

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          aria-label="RinKuzu"
          className="flex h-10 items-center rounded-lg focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <Image
            src="/images/auth_logo.webp"
            alt="RinKuzu"
            width={130}
            height={40}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label={t('navigation')}>
          <Link
            href="/contact"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-warm hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <HiOutlineQuestionMarkCircle className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('support')}</span>
          </Link>
          <button
            type="button"
            onClick={switchLocale}
            aria-label={nextLocale === 'vi' ? t('switchToVietnamese') : t('switchToEnglish')}
            className="min-h-11 rounded-lg px-3 text-sm font-semibold uppercase text-ink-muted transition-colors hover:bg-surface-warm hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            {nextLocale}
          </button>
          <Link
            href="/subscription"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-warm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <HiOutlineArrowLeft className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('backToPlans')}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
