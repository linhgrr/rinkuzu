/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

const { GuestPhotoPage } = vi.hoisted(() => ({ GuestPhotoPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) =>
      `${locale}:${namespace}.${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestPhotoPage', () => ({ GuestPhotoPage }));

import TryPhotoPage, { generateMetadata } from './page';

describe('/try/photo page (RIN-1793)', () => {
  it.each(['vi', 'en'])(
    'is noindex in %s until the SEO content ships (RIN-1795)',
    async (locale) => {
      const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.title).toBe(`${locale}:guestDraft.photoMeta.title`);
      expect(String(metadata.alternates?.canonical)).toMatch(new RegExp(`/${locale}/try/photo$`));
      expect(metadata.referrer).toBe('no-referrer');
    },
  );

  it('renders the guest photo page', async () => {
    const element = await TryPhotoPage({ params: Promise.resolve({ locale: 'en' }) });
    expect(element.type).toBe(GuestPhotoPage);
  });
});
