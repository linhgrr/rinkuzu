/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

const { GuestTextInputPage } = vi.hoisted(() => ({ GuestTextInputPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) =>
      `${locale}:${namespace}.${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestTextInputPage', () => ({ GuestTextInputPage }));

import TryTextPage, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'vi' });

describe('/try/text page (RIN-1539)', () => {
  it.each(['vi', 'en'])('is indexable in %s with a self canonical and hreflang', async (locale) => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({}),
    });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe(`${locale}:guestDraft.textMeta.title`);
    expect(String(metadata.alternates?.canonical)).toMatch(new RegExp(`/${locale}/try/text$`));
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('passes a known entry through and reports try_text otherwise', async () => {
    const hub = await TryTextPage({ params, searchParams: Promise.resolve({ entry: 'create' }) });
    expect(hub.props.entry).toBe('create');
    const direct = await TryTextPage({ params, searchParams: Promise.resolve({}) });
    expect(direct.props.entry).toBe('try_text');
    const unknown = await TryTextPage({ params, searchParams: Promise.resolve({ entry: 'x' }) });
    expect(unknown.props.entry).toBe('try_text');
  });
});
