/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../../messages/en/guestDraft.json';
import viGuest from '../../../../../../messages/vi/guestDraft.json';

const { GuestPhotoPage } = vi.hoisted(() => ({ GuestPhotoPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) =>
      `${locale}:${namespace}.${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestPhotoPage', () => ({ GuestPhotoPage }));
vi.mock('@/features/guest-draft/components/GuestPhotoSeoContent', () => ({
  GuestPhotoSeoContent: () => null,
}));

import TryPhotoPage, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'vi' });

describe('/try/photo page (RIN-1793, RIN-1795)', () => {
  it.each(['vi', 'en'])('is indexable in %s with a self canonical and hreflang', async (locale) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe(`${locale}:guestDraft.photoMeta.title`);
    expect(String(metadata.alternates?.canonical)).toMatch(new RegExp(`/${locale}/try/photo$`));
    expect(metadata.referrer).toBe('no-referrer');
    const languages = metadata.alternates?.languages as Record<string, string>;
    expect(languages['vi']).toMatch(/\/vi\/try\/photo$/);
    expect(languages['en']).toMatch(/\/en\/try\/photo$/);
    expect(languages['x-default']).toMatch(/\/vi\/try\/photo$/);
  });

  // The keyword in each locale's title and description; vi also in the h1 (the query is Vietnamese-first).
  it.each([
    ['vi', viGuest, /tạo câu hỏi trắc nghiệm từ ảnh/i],
    ['en', enGuest, /quiz from photos/i],
  ] as const)('builds the %s title and description around the keyword', (_l, messages, kw) => {
    expect(messages.photoMeta.title).toMatch(kw);
    expect(messages.photoMeta.description).toMatch(kw);
  });

  it('puts the Vietnamese keyword in the h1', () => {
    expect(viGuest.photo.title).toMatch(/tạo câu hỏi trắc nghiệm từ ảnh/i);
  });

  it('renders the SEO section under the widget', async () => {
    const page = await TryPhotoPage({ params });
    expect(page.type).toBe(GuestPhotoPage);
    expect(page.props.children.props.locale).toBe('vi');
  });

  it('takes no entry prop: the browser reads ?entry= so the page stays static (RIN-1645)', async () => {
    const page = await TryPhotoPage({ params });
    expect(page.props).not.toHaveProperty('entry');
  });
});
