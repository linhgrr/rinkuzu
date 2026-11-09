import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { getQuizTopicHubService } from '@/lib/quiz-topic-hub-factory';
import viExplore from '../../../../../messages/vi/explore.json';

type HubService = ReturnType<typeof getQuizTopicHubService>;
type QuizTopicHubSummaryDto = Awaited<ReturnType<HubService['listIndexableTopics']>>[number];

// RIN-1249 B6: `/vi/explore` links the indexable hubs; nothing in `/en` or
// without hubs, and a failed read leaves the page as it was. Fake topics.

const { listIndexableTopics, loggerError } = vi.hoisted(() => ({
  listIndexableTopics: vi.fn<() => Promise<QuizTopicHubSummaryDto[]>>(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/quiz-topic-hub-factory', () => ({
  getQuizTopicHubService: () => ({ listIndexableTopics }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerError } }));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: string }) =>
    createTranslator({ locale, messages: { explore: viExplore }, namespace: 'explore.hub' }),
}));
vi.mock('@/features/explore/components/ExplorePageClient', () => ({
  ExplorePageClient: ({ hubLinks }: { hubLinks?: ReactNode }) => (
    <main>
      <h1>Khám phá</h1>
      {hubLinks}
    </main>
  ),
}));

import ExplorePage from './page';

function summary(index: number): QuizTopicHubSummaryDto {
  return {
    slug: `mon-${index}`,
    locale: 'vi',
    name: `Môn ${index}`,
    indexableQuizCount: 3,
    lastModified: '2026-11-01T00:00:00.000Z',
  };
}

async function renderExplore(locale: string) {
  const page = await ExplorePage({ params: Promise.resolve({ locale }) });
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {page}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listIndexableTopics.mockReset();
  loggerError.mockReset();
});

describe('/explore topic hub links (B6)', () => {
  it('links at most 12 indexable hubs on /vi/explore', async () => {
    listIndexableTopics.mockResolvedValue(Array.from({ length: 14 }, (_, i) => summary(i + 1)));
    await renderExplore('vi');

    const nav = screen.getByRole('navigation', { name: 'Đề trắc nghiệm theo môn' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(12);
    expect(links[0]).toHaveAttribute('href', '/vi/explore/mon-1');
    expect(links[0]).toHaveTextContent('Môn 1');
  });

  it('renders no block without hubs, in /en, or when the read fails', async () => {
    listIndexableTopics.mockResolvedValue([]);
    const { container, unmount } = await renderExplore('vi');
    expect(container.querySelector('#explore-hubs-heading')).toBeNull();
    unmount();

    listIndexableTopics.mockClear().mockResolvedValue([summary(1)]);
    const en = await renderExplore('en');
    expect(en.container.querySelector('#explore-hubs-heading')).toBeNull();
    expect(listIndexableTopics).not.toHaveBeenCalled();
    en.unmount();

    listIndexableTopics.mockRejectedValue(new Error('database unavailable'));
    const failed = await renderExplore('vi');
    expect(failed.container.querySelector('#explore-hubs-heading')).toBeNull();
    expect(loggerError).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'explore: topic hub links failed',
    );
  });
});
