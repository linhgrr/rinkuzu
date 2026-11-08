import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// RIN-408 / RIN-258: the homepage is force-static, so next-intl has no request headers
// to read the locale from. Without setRequestLocale it resolves defaultLocale ('vi') and
// every locale-aware Link on /en points at /vi/... . This fake mirrors that behaviour.
const requestLocale = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock('next-intl/server', () => ({
  setRequestLocale: (locale: string) => {
    requestLocale.current = locale;
  },
  getLocale: async () => requestLocale.current ?? 'vi',
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@/i18n/messages', () => ({
  getScopedMessages: async () => ({}),
}));

vi.mock('@/components/GlobalFooter', () => ({ GlobalFooter: () => null }));
vi.mock('@/components/ClientOnlyMarketingAddons', () => ({
  ClientOnlyMarketingAddons: () => null,
}));
vi.mock('@/features/landing/components/GuestLanding', () => ({ GuestLanding: () => null }));
vi.mock('@/components/analytics/AnalyticsRoot', () => ({ AnalyticsRoot: () => null }));
vi.mock('@serwist/turbopack/react', () => ({
  SerwistProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', variable: '--font' });
  return { Inter: font, Montserrat: font, Unbounded: font, Vina_Sans: font };
});

import { getLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import LocaleLayout from '../layout';
import MarketingLayout from './layout';
import HomePage, { dynamic } from './page';

function findProvider(node: ReactNode): ReactElement<{ locale?: string }> | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProvider(child);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as ReactElement<{ locale?: string; children?: ReactNode }>;
  if (element.type === NextIntlClientProvider) return element;
  return findProvider(element.props?.children);
}

describe.each(['en', 'vi'])('homepage request locale on /%s', (locale) => {
  const params = Promise.resolve({ locale });

  beforeEach(() => {
    requestLocale.current = undefined;
  });

  it('stays statically rendered', () => {
    expect(dynamic).toBe('force-static');
  });

  it('pins the request locale in the homepage route', async () => {
    await HomePage({ params });

    await expect(getLocale()).resolves.toBe(locale);
  });

  it('pins the request locale and provider locale in the marketing layout', async () => {
    const tree = await MarketingLayout({ children: null, params });

    await expect(getLocale()).resolves.toBe(locale);
    expect(findProvider(tree)?.props.locale).toBe(locale);
  });

  it('pins the request locale and provider locale in the root locale layout', async () => {
    const tree = await LocaleLayout({ children: null, params });

    await expect(getLocale()).resolves.toBe(locale);
    expect(findProvider(tree)?.props.locale).toBe(locale);
  });
});
