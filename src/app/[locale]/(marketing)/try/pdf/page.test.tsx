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
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({}),
    });
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

  it('passes a known entry through and leaves an unknown one to the browser', async () => {
    const page = await TryPdfPage({ params, searchParams: Promise.resolve({ entry: 'create' }) });
    expect(page.props.entry).toBe('create');
    const blog = await TryPdfPage({ params, searchParams: Promise.resolve({ entry: 'blog' }) });
    expect(blog.props.entry).toBe('blog');
    const fallback = await TryPdfPage({ params, searchParams: Promise.resolve({ entry: 'x' }) });
    expect(fallback.props.entry).toBeUndefined();
  });

  it.each(['vi', 'en'])(
    'renders the SEO copy under the widget in %s (RIN-1498)',
    async (locale) => {
      const page = await TryPdfPage({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({}),
      });
      expect(page.props.children.props).toEqual({ locale });
    },
  );
});
