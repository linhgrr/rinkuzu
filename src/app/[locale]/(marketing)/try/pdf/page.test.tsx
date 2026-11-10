/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';

const { GuestPdfUploadPage } = vi.hoisted(() => ({ GuestPdfUploadPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `t:${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestPdfUploadPage', () => ({ GuestPdfUploadPage }));

import TryPdfPage, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'vi' });

describe('/try/pdf page (RIN-1448)', () => {
  it('is noindex and sends no referrer', async () => {
    const metadata = await generateMetadata({ params, searchParams: Promise.resolve({}) });
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.referrer).toBe('no-referrer');
    expect(metadata.alternates?.languages).toBeUndefined();
  });

  it('passes a known entry through and falls back to landing', async () => {
    const page = await TryPdfPage({ params, searchParams: Promise.resolve({ entry: 'create' }) });
    expect(page.props).toEqual({ entry: 'create' });
    const fallback = await TryPdfPage({ params, searchParams: Promise.resolve({ entry: 'x' }) });
    expect(fallback.props).toEqual({ entry: 'landing' });
  });
});
