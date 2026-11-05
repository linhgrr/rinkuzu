/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { QuizResultPageClient } from './QuizResultPageClient';

const { fetchPageDataMock, searchParams, router } = vi.hoisted(() => ({
  fetchPageDataMock: vi.fn(),
  searchParams: { value: new URLSearchParams('attemptId=attempt-1') },
  router: { push: () => undefined, back: () => undefined },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.value,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/quiz/demo/result',
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stable identity, like next-intl's memoized `t`.
const translate = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en' }));

vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));

vi.mock('@/lib/routing/useRequiredRouteParam', () => ({
  useRequiredRouteParam: () => 'demo',
}));

vi.mock('@/features/ask-rin-chan/components/AskRinPanel', () => ({ AskRinPanel: () => null }));

vi.mock('@/features/quiz/api/quiz-result-page-api', () => ({
  createQuizResultBookmark: vi.fn(),
  deleteQuizResultBookmark: vi.fn(),
  fetchQuizResultPageData: (...args: unknown[]) => fetchPageDataMock(...args),
}));

describe('QuizResultPageClient load failures (RIN-753)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams('attemptId=attempt-1');
  });

  it('shows the page-level server error with a retry that reloads, never the server text', async () => {
    fetchPageDataMock
      .mockRejectedValueOnce(
        new ApiResponseError({ message: 'Mongo exploded at shard 3', status: 500, payload: {} }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.serverTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Mongo exploded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(
      await screen.findByRole('heading', { name: 'errors.api.networkTitle' }),
    ).toBeInTheDocument();
    expect(fetchPageDataMock).toHaveBeenCalledTimes(2);
  });

  it('asks a signed-out visitor to sign in and come back on 401', async () => {
    fetchPageDataMock.mockRejectedValueOnce(
      new ApiResponseError({ message: 'Unauthorized', status: 401, payload: {} }),
    );

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.authRequiredTitle' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized')).not.toBeInTheDocument();
  });

  it('treats a link without an attempt id as not found', async () => {
    searchParams.value = new URLSearchParams('');

    render(<QuizResultPageClient />);

    expect(
      await screen.findByRole('heading', { name: 'errors.api.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(fetchPageDataMock).not.toHaveBeenCalled();
  });
});
