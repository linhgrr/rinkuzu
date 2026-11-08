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
  // Two lines at 375 px in both locales (RIN-719): the privacy link moved to
  // the button row, so the paragraph is only the sentence below.
  const copy = isVietnamese
    ? {
        body: 'RinKuzu dùng analytics tùy chọn để cải thiện. Không bao giờ gửi PDF, mật khẩu hay câu trả lời.',
        accept: 'Đồng ý',
        decline: 'Từ chối',
        privacy: 'Chính sách bảo mật',
      }
    : {
        body: 'We use optional analytics to improve RinKuzu. We never send your PDFs, password or answers.',
        accept: 'Allow',
        decline: 'Decline',
        privacy: 'Privacy policy',
      };
  const localePrefix = isVietnamese ? 'vi' : 'en';
  // Both choices share one style apart from colour, so neither is easier to
  // reach. White on `action-strong` is 5.18:1, so normal 16 px text passes AA
  // (4.5:1); the decline button matches its size.
  const choiceClass =
    'min-h-11 rounded-full px-3 py-2 text-base font-semibold leading-6 sm:min-w-28 sm:px-4';

  return (
    <aside
      // Below md the app's bottom nav (`data-bottom-nav`) is fixed to the
      // bottom edge, so the card sits above it (and its raised centre button)
      // instead of covering its tap targets. From lg the app sidebar
      // (`data-app-sidebar`) is fixed to the left edge, so the card's left
      // inset starts after it and it centres on the content area instead.
      // While a quiz player (`data-quiz-player`) is on screen the card hides,
      // so it never covers a question, the navigator or the finish button,
      // and it comes back on the result page (RIN-987/RIN-979).
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-3 font-system shadow-xl sm:inset-x-4 sm:bottom-4 sm:flex sm:items-center sm:gap-5 sm:p-4 [html:has([data-quiz-player])_&]:hidden max-md:[html:has([data-bottom-nav])_&]:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:[html:has([data-app-sidebar=expanded])_&]:left-[calc(var(--app-sidebar-expanded-width)+1rem)] lg:[html:has([data-app-sidebar=collapsed])_&]:left-[calc(var(--app-sidebar-collapsed-width)+1rem)]"
      aria-label={isVietnamese ? 'Lựa chọn analytics' : 'Analytics preference'}
    >
      <p className="flex-1 text-sm leading-5 text-neutral-700 sm:leading-6">{copy.body}</p>
      <div className="mt-2 flex shrink-0 items-center justify-between gap-2 sm:mt-0 sm:gap-3">
        <a
          href={`/${localePrefix}/privacy`}
          className="inline-flex min-h-6 items-center whitespace-nowrap text-sm font-semibold text-ink underline underline-offset-2 hover:text-accent"
        >
          {copy.privacy}
        </a>
        <div className="grid grid-cols-2 gap-2 sm:flex">
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
            // Not `bg-brand-action`. White on that token is 2.57:1 and its
            // dark-theme value is lighter still, so the banner failed the
            // accessibility budget over both the landing and login pages.
            // `action-strong` is the same colour in both themes for exactly
            // that reason, and so is its hover.
            className={`${choiceClass} border border-transparent bg-brand-action-strong text-white hover:bg-brand-action-strong-hover`}
            onClick={() => {
              grantAnalyticsConsent();
            }}
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </aside>
  );
}
