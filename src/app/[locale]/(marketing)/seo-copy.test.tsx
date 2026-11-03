import { render } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enPremium from '../../../../messages/en/premium.json';
import viPremium from '../../../../messages/vi/premium.json';
import viPricing from '../../../../messages/vi/pricing.json';
import { generateMetadata as faqMetadata } from './faq/page';
import { generateMetadata as pricingMetadata } from './pricing/page';
import { generateMetadata as premiumMetadata } from '../(app)/premium-quizzes/layout';
import { PremiumQuizzesPageClient } from '@/features/quiz/components/PremiumQuizzesPageClient';

// RIN-504 AC4 (RIN-506): exact SERP title/description per locale, and a crawlable
// premium-catalog intro of at least 80 words above the grid.

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: 'pricing' }) =>
    createTranslator({ locale, messages: { pricing: viPricing }, namespace }),
}));
vi.mock('@/lib/plan-catalog-factory', () => ({
  createPlanCatalogService: () => ({ listActive: async () => [] }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/premium-quizzes',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('swr', () => ({
  default: () => ({ data: undefined, error: undefined, isLoading: true, mutate: vi.fn() }),
}));

const params = (locale: string) => ({ params: Promise.resolve({ locale }) });

describe('SEO metadata copy (RIN-504 AC4)', () => {
  it('vi pricing uses the exact title and description', async () => {
    const meta = await pricingMetadata(params('vi'));
    expect(meta.title).toBe('Bảng giá RinKuzu – Tạo quiz từ PDF miễn phí bằng AI');
    expect(meta.description).toBe(
      'Bắt đầu miễn phí: tải PDF bài giảng, AI tạo quiz và luyện tập thích ứng ngay. Nâng cấp Premium để mở kho Quiz Premium tuyển chọn và hạn mức cao hơn.',
    );
  });

  it('vi faq uses the exact title and description', async () => {
    const meta = await faqMetadata(params('vi'));
    expect(meta.title).toBe('Hỏi đáp RinKuzu – Cách tạo quiz từ PDF bằng AI');
    expect(meta.description).toBe(
      'Giải đáp nhanh: tạo quiz từ PDF trong vài phút, có miễn phí không, AI chấm và giải thích thế nào, dùng cho sinh viên và giáo viên ra sao.',
    );
  });

  it('en premium-quizzes uses the exact description', async () => {
    const meta = await premiumMetadata({ ...params('en'), children: null });
    expect(meta.description).toBe(
      'Practice with curated, quality-reviewed quizzes by subject. Free learners can preview; Premium unlocks the full RinKuzu Quiz Premium catalog.',
    );
  });

  it('keeps titles within 60 characters and descriptions within 155', async () => {
    for (const meta of [
      await pricingMetadata(params('vi')),
      await faqMetadata(params('vi')),
      await premiumMetadata({ ...params('en'), children: null }),
    ]) {
      expect(String(meta.title).length).toBeLessThanOrEqual(60);
      expect(String(meta.description).length).toBeLessThanOrEqual(155);
    }
  });
});

describe.each([
  ['en', enPremium],
  ['vi', viPremium],
] as const)('premium catalog intro on /%s', (locale, messages) => {
  it('renders at least 80 words above the catalog, outside the suspending grid', () => {
    const { getByTestId, container } = render(
      <NextIntlClientProvider locale={locale} messages={{ premium: messages }}>
        <PremiumQuizzesPageClient />
      </NextIntlClientProvider>,
    );
    const intro = getByTestId('premium-catalog-intro');
    const words = (intro.textContent ?? '').trim().split(/\s+/);
    expect(words.length).toBeGreaterThanOrEqual(80);
    expect(intro.textContent).toBe(messages.catalogIntro);
    const searchBox = container.querySelector('input');
    if (!searchBox) throw new Error('catalog search box not rendered');
    // The intro precedes the search box and the grid in document order.
    expect(
      intro.compareDocumentPosition(searchBox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
