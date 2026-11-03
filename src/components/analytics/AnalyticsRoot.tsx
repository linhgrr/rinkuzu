'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import {
  denyAnalyticsConsent,
  getAnalyticsConsent,
  grantAnalyticsConsent,
  initializeAnalytics,
  subscribeToAnalyticsConsent,
  trackAnalyticsPageView,
} from '@/lib/analytics/client';

export function AnalyticsRoot() {
  const pathname = usePathname();
  const locale = useLocale();
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsent,
    () => null,
  );

  useEffect(() => {
    if (consent === 'granted') void initializeAnalytics();
  }, [consent]);

  useEffect(() => {
    if (consent !== 'granted') return;
    trackAnalyticsPageView(window.location.href, document.title);
  }, [consent, pathname]);

  if (consent !== null) return null;

  const isVietnamese = locale === 'vi';
  // Kept to one short sentence: on a 375 px phone the old three-line copy made
  // the card about 185 px tall and it was the LCP element on signed-out pages.
  const copy = isVietnamese
    ? {
        body: 'RinKuzu dùng analytics tùy chọn để cải thiện sản phẩm, không gửi PDF, mật khẩu hay câu trả lời của bạn.',
        accept: 'Đồng ý',
        decline: 'Từ chối',
        privacy: 'Chính sách bảo mật',
      }
    : {
        body: 'RinKuzu uses optional analytics to improve the product. We never send your PDFs, password or answers.',
        accept: 'Allow',
        decline: 'Decline',
        privacy: 'Privacy policy',
      };
  const localePrefix = isVietnamese ? 'vi' : 'en';
  // Both choices share one style apart from colour, so neither is easier to
  // reach. The 20 px bold size is what lets white on `action-strong` count as
  // large text (3:1); the decline button matches it.
  const choiceClass = 'min-h-11 rounded-full px-4 py-2 text-xl font-bold leading-6 sm:min-w-28';

  return (
    <aside
      // Below md the app's bottom nav (`data-bottom-nav`) is fixed to the
      // bottom edge, so the card sits above it (and its raised centre button)
      // instead of covering its tap targets.
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-3 font-system shadow-xl sm:inset-x-4 sm:bottom-4 sm:flex sm:items-center sm:gap-5 sm:p-4 max-md:[html:has([data-bottom-nav])_&]:bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
      aria-label={isVietnamese ? 'Lựa chọn analytics' : 'Analytics preference'}
    >
      <p className="flex-1 text-sm leading-5 text-neutral-700 sm:leading-6">
        {copy.body}{' '}
        <a
          href={`/${localePrefix}/privacy`}
          className="inline-flex min-h-6 items-center font-semibold text-ink underline underline-offset-2 hover:text-accent"
        >
          {copy.privacy}
        </a>
      </p>
      <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 sm:mt-0 sm:flex">
        <button
          type="button"
          className={`${choiceClass} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50`}
          onClick={() => {
            denyAnalyticsConsent();
          }}
        >
          {copy.decline}
        </button>
        <button
          type="button"
          // Not `bg-brand-action`. White on that token is 2.57:1 against a 3:1
          // floor for text this size, and its dark-theme value is lighter
          // still, so the banner failed the accessibility budget over both the
          // landing and login pages. `action-strong` is the same colour in
          // both themes for exactly that reason.
          className={`${choiceClass} border border-transparent bg-brand-action-strong text-white hover:bg-brand-action-hover`}
          onClick={() => {
            grantAnalyticsConsent();
          }}
        >
          {copy.accept}
        </button>
      </div>
    </aside>
  );
}
