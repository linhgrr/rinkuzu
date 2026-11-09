import { render, screen, within } from '@testing-library/react';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { getQuizTopicHubService } from '@/lib/quiz-topic-hub-factory';
import viExplore from '../../../../../../messages/vi/explore.json';

type HubService = ReturnType<typeof getQuizTopicHubService>;
type QuizTopicHubDto = NonNullable<Awaited<ReturnType<HubService['getTopicWithIndexableQuizzes']>>>;

// RIN-1249 (spec RIN-1241 B3–B5, B7): the hub page, its robots and its JSON-LD.
// Fake topics and quizzes only.

const { getTopicWithIndexableQuizzes, notFoundError } = vi.hoisted(() => ({
  getTopicWithIndexableQuizzes: vi.fn<(slug: string) => Promise<QuizTopicHubDto | null>>(),
  notFoundError: new Error('NEXT_NOT_FOUND'),
}));

vi.mock('@/lib/quiz-topic-hub-factory', () => ({
  getQuizTopicHubService: () => ({ getTopicWithIndexableQuizzes }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: string }) =>
    createTranslator({ locale, messages: { explore: viExplore }, namespace: 'explore.hub' }),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw notFoundError;
  },
  usePathname: () => '/explore/sinh-hoc',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('@/components/ui/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="intro">{content}</div>,
}));

import TopicHubPage, { generateMetadata } from './page';

const INTRO = `**Sinh học** lớp 12 ${Array.from({ length: 140 }, (_, i) => `từ${i}`).join(' ')}`;

function hub(quizCount: number, indexable = quizCount >= 3): QuizTopicHubDto {
  return {
    slug: 'sinh-hoc',
    locale: 'vi',
    name: 'Sinh học',
    intro: INTRO,
    indexable,
    quizzes: Array.from({ length: quizCount }, (_, i) => ({
      slug: `de-sinh-${i + 1}`,
      title: `Đề sinh ${i + 1}`,
      questionCount: i === 0 ? 40 : 8,
      updatedAt: '2026-11-01T00:00:00.000Z',
    })),
  };
}

const params = (locale = 'vi', topic = 'sinh-hoc') => ({
  params: Promise.resolve({ locale, topic }),
});

async function renderHub() {
  const page = await TopicHubPage(params());
  return render(
    <NextIntlClientProvider locale="vi" messages={{}}>
      {page}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  getTopicWithIndexableQuizzes.mockReset();
});

describe('topic hub metadata (B4, B5)', () => {
  it('titles an indexable hub with its count, self-canonical, no en alternate', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(hub(3));

    const metadata = await generateMetadata(params());

    expect(metadata.title).toBe('Đề trắc nghiệm Sinh học có đáp án – 3 bộ câu hỏi | RinKuzu');
    expect(metadata.description).toMatch(/^Sinh học lớp 12 từ0/);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(metadata.alternates?.canonical).toMatch(/\/vi\/explore\/sinh-hoc$/);
    expect(metadata.alternates?.languages).toBeUndefined();
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('keeps a hub below the threshold out of the index', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(hub(2));

    expect((await generateMetadata(params())).robots).toEqual({ index: false, follow: true });
  });

  it('answers 404 for an unknown or unpublished topic, a bad slug and /en', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(null);
    await expect(TopicHubPage(params())).rejects.toBe(notFoundError);

    getTopicWithIndexableQuizzes.mockResolvedValue(hub(3));
    await expect(TopicHubPage(params('en'))).rejects.toBe(notFoundError);
    await expect(TopicHubPage(params('vi', 'Sinh_Hoc'))).rejects.toBe(notFoundError);
    expect(await generateMetadata(params('en'))).toEqual({});
    expect(getTopicWithIndexableQuizzes).not.toHaveBeenCalledWith('Sinh_Hoc');
  });
});

describe('topic hub page (B3, B7)', () => {
  it('lists crawlable quiz links and hub-tagged play links', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(hub(3));
    await renderHub();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Đề trắc nghiệm Sinh học có đáp án',
    );
    expect(screen.getByText('3 bộ câu hỏi')).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(breadcrumb).getByText('Sinh học')).toHaveAttribute('aria-current', 'page');

    expect(screen.getByRole('region', { name: 'Chọn một bộ đề' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đề sinh 1' })).toHaveAttribute(
      'href',
      '/vi/quiz/de-sinh-1',
    );
    const play = screen.getByRole('link', { name: 'Chơi ngay: Đề sinh 1' });
    expect(play).toHaveAttribute('href', '/vi/quiz/de-sinh-1?mode=quick&entry=hub&topic=sinh-hoc');
    expect(screen.getByRole('link', { name: 'Chơi ngay: Đề sinh 2' })).toHaveAttribute(
      'href',
      '/vi/quiz/de-sinh-2?mode=full&entry=hub&topic=sinh-hoc',
    );
  });

  it('emits the breadcrumb and the item list as JSON-LD', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(hub(3));
    const { container } = await renderHub();

    const script = container.querySelector('script#topic-hub-schema');
    const data = JSON.parse(script?.textContent ?? '{}') as {
      '@graph': Array<{ '@type': string; itemListElement: Array<Record<string, unknown>> }>;
    };
    const [breadcrumb, itemList] = data['@graph'];
    expect(breadcrumb?.['@type']).toBe('BreadcrumbList');
    expect(breadcrumb?.itemListElement.map((item) => item['name'])).toEqual([
      'Trang chủ',
      'Khám phá',
      'Sinh học',
    ]);
    expect(itemList?.['@type']).toBe('ItemList');
    expect(itemList?.itemListElement).toHaveLength(3);
    expect(itemList?.itemListElement[0]).toMatchObject({
      position: 1,
      name: 'Đề sinh 1',
      url: expect.stringMatching(/\/vi\/quiz\/de-sinh-1$/),
    });
  });

  it('counts every quiz in the badge and the title but lists only the first 30', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(hub(31));
    const { container } = await renderHub();

    expect(screen.getByText('31 bộ câu hỏi')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Chơi ngay: / })).toHaveLength(30);
    const data = JSON.parse(
      container.querySelector('script#topic-hub-schema')?.textContent ?? '{}',
    ) as { '@graph': Array<{ itemListElement: unknown[] }> };
    expect(data['@graph'][1]?.itemListElement).toHaveLength(30);

    const metadata = await generateMetadata(params());
    expect(String(metadata.title)).toContain('31 bộ câu hỏi');
  });

  it('shows the empty block for a hub with no quizzes', async () => {
    getTopicWithIndexableQuizzes.mockResolvedValue(hub(0));
    await renderHub();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Chưa có bộ đề nào cho chủ đề này' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Khám phá quiz' })).toHaveAttribute(
      'href',
      '/vi/explore',
    );
    expect(screen.queryByRole('link', { name: /^Chơi ngay/ })).toBeNull();
  });
});
