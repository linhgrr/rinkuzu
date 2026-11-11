/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../../../messages/en/guestDraft.json';
import viGuest from '../../../../../../messages/vi/guestDraft.json';

const { GuestTextInputPage } = vi.hoisted(() => ({ GuestTextInputPage: vi.fn(() => null) }));

vi.mock('next-intl/server', () => ({
  getTranslations:
    async ({ locale, namespace }: { locale: string; namespace: string }) =>
    (key: string) =>
      `${locale}:${namespace}.${key}`,
  setRequestLocale: vi.fn(),
}));
vi.mock('@/features/guest-draft/components/GuestTextInputPage', () => ({ GuestTextInputPage }));
vi.mock('@/features/guest-draft/components/GuestTextSeoContent', () => ({
  GuestTextSeoContent: () => null,
}));

import TryTextPage, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'vi' });

describe('/try/text page (RIN-1539, RIN-1540)', () => {
  it.each(['vi', 'en'])('is indexable in %s with a self canonical and hreflang', async (locale) => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({}),
    });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.title).toBe(`${locale}:guestDraft.textMeta.title`);
    expect(String(metadata.alternates?.canonical)).toMatch(new RegExp(`/${locale}/try/text$`));
    expect(metadata.referrer).toBe('no-referrer');
    const languages = metadata.alternates?.languages as Record<string, string>;
    expect(languages['vi']).toMatch(/\/vi\/try\/text$/);
    expect(languages['en']).toMatch(/\/en\/try\/text$/);
    expect(languages['x-default']).toMatch(/\/vi\/try\/text$/);
  });

  // AC7: the keyword in each locale's title, description and h1 (RIN-1540).
  it.each([
    ['vi', viGuest, /tạo câu hỏi trắc nghiệm từ văn bản/i],
    ['en', enGuest, /text to quiz/i],
  ] as const)('builds the %s title, description and h1 around the keyword', (_l, messages, kw) => {
    expect(messages.textMeta.title).toMatch(kw);
    expect(messages.textMeta.description).toMatch(kw);
    expect(messages.text.title).toMatch(kw);
  });

  it('renders the SEO section under the widget', async () => {
    const page = await TryTextPage({ params, searchParams: Promise.resolve({}) });
    expect(page.props.children.props.locale).toBe('vi');
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
