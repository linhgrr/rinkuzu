/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../../messages/en/guestDraft.json';
import viGuest from '../../../../../../messages/vi/guestDraft.json';

const { GuestPdfUploadPage } = vi.hoisted(() => ({ GuestPdfUploadPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) =>
      `${locale}:${namespace}.${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestPdfUploadPage', () => ({ GuestPdfUploadPage }));
vi.mock('@/features/guest-draft/components/GuestSlidesSeoContent', () => ({
  GuestSlidesSeoContent: () => null,
}));

import TrySlidesPage, { generateMetadata } from './page';

describe('/try/slides page (RIN-1788)', () => {
  it.each(['vi', 'en'])('is indexable in %s with a self canonical and hreflang', async (locale) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe(`${locale}:guestDraft.slidesMeta.title`);
    expect(metadata.description).toBe(`${locale}:guestDraft.slidesMeta.description`);
    expect(String(metadata.alternates?.canonical)).toMatch(new RegExp(`/${locale}/try/slides$`));
    expect(metadata.referrer).toBe('no-referrer');
    expect(metadata.alternates?.languages).toEqual({
      vi: expect.stringMatching(/\/vi\/try\/slides$/),
      en: expect.stringMatching(/\/en\/try\/slides$/),
      'x-default': expect.stringMatching(/\/vi\/try\/slides$/),
    });
  });

  it.each([
    ['vi', viGuest, /tạo câu hỏi trắc nghiệm từ slide powerpoint/i],
    ['en', enGuest, /multiple-choice quiz from powerpoint slides/i],
  ] as const)('builds the %s title, description and h1 around the keyword', (_l, messages, kw) => {
    expect(messages.slidesMeta.title).toMatch(kw);
    expect(messages.slidesMeta.description).toMatch(kw);
    expect(messages.upload.slidesTitle).toMatch(kw);
  });

  it('mounts the guest uploader on the try_slides surface with the SEO copy under it', async () => {
    const page = await TrySlidesPage({ params: Promise.resolve({ locale: 'en' }) });
    expect(page.type).toBe(GuestPdfUploadPage);
    expect(page.props.surface).toBe('try_slides');
    expect(page.props.children.props).toEqual({ locale: 'en' });
  });

  it('takes no entry prop: the browser reads ?entry= so the page stays static (RIN-1645)', async () => {
    const page = await TrySlidesPage({ params: Promise.resolve({ locale: 'vi' }) });
    expect(page.props).not.toHaveProperty('entry');
  });
});
