/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

const { GuestPdfUploadPage } = vi.hoisted(() => ({ GuestPdfUploadPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale }: { locale: string }) =>
    (key: string) =>
      `${locale}:${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestPdfUploadPage', () => ({ GuestPdfUploadPage }));
vi.mock('@/features/guest-draft/components/GuestPdfSeoContent', () => ({
  GuestPdfSeoContent: () => null,
}));

import TryPdfPage, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'vi' });

describe('/try/pdf page (RIN-1448, RIN-1497)', () => {
  it.each(['vi', 'en'])('is indexable in %s with a self canonical and hreflang', async (locale) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe(`${locale}:title`);
    expect(metadata.description).toBe(`${locale}:description`);
    expect(String(metadata.alternates?.canonical)).toMatch(new RegExp(`/${locale}/try/pdf$`));
    expect(metadata.alternates?.languages).toEqual({
      vi: expect.stringMatching(/\/vi\/try\/pdf$/),
      en: expect.stringMatching(/\/en\/try\/pdf$/),
      'x-default': expect.stringMatching(/\/vi\/try\/pdf$/),
    });
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('takes no entry prop: the browser reads ?entry= so the page stays static (RIN-1645)', async () => {
    const page = await TryPdfPage({ params });
    expect(page.props).not.toHaveProperty('entry');
  });

  it.each(['vi', 'en'])(
    'renders the SEO copy under the widget in %s (RIN-1498)',
    async (locale) => {
      const page = await TryPdfPage({ params: Promise.resolve({ locale }) });
      expect(page.props.children.props).toEqual({ locale });
    },
  );
});
