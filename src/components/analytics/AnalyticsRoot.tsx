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
  const copy = isVietnamese
    ? {
        body: 'RinKuzu dùng analytics tùy chọn để hiểu luồng học tập và cải thiện sản phẩm. Không gửi nội dung PDF, mật khẩu hoặc câu trả lời của bạn.',
        accept: 'Đồng ý',
        decline: 'Từ chối',
        privacy: 'Chính sách bảo mật',
      }
    : {
        body: 'RinKuzu uses optional analytics to understand learning flows and improve the product. We do not send your PDF content, password, or answers.',
        accept: 'Allow',
        decline: 'Decline',
        privacy: 'Privacy policy',
      };
  const localePrefix = isVietnamese ? 'vi' : 'en';

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 font-system shadow-xl sm:flex sm:items-center sm:gap-5"
      aria-label={isVietnamese ? 'Lựa chọn analytics' : 'Analytics preference'}
    >
      <p className="flex-1 text-sm leading-6 text-neutral-700">
        {copy.body}{' '}
        <a
          href={`/${localePrefix}/privacy`}
          className="font-semibold text-ink underline underline-offset-2 hover:text-accent"
        >
          {copy.privacy}
        </a>
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <button
          type="button"
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
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
          className="min-h-11 rounded-full bg-brand-action-strong px-4 py-2 text-[19px] font-bold text-white hover:bg-brand-action-hover"
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
