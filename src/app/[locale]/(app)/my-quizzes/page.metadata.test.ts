import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enProfile from '../../../../../messages/en/profile.json';
import viProfile from '../../../../../messages/vi/profile.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: { profile: locale === 'vi' ? viProfile : enProfile },
      namespace: namespace as 'profile',
    }),
}));

vi.mock('@/features/profile/components/ProfileQuizzes', () => ({ default: () => null }));

import { generateMetadata } from './page';

function metadataFor(locale: string, tab?: string) {
  return generateMetadata({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(tab === undefined ? {} : { tab }),
  });
}

// RIN-1200: the title follows the active tab, like the page h1.
describe('my-quizzes page metadata', () => {
  it('names the quizzes tab by default', async () => {
    expect((await metadataFor('en')).title).toBe('My quizzes | RinKuzu');
    expect((await metadataFor('vi', 'unknown')).title).toBe('Bài của tôi | RinKuzu');
  });

  it('names the Folders tab', async () => {
    expect((await metadataFor('en', 'folders')).title).toBe('Folders | RinKuzu');
    expect((await metadataFor('vi', 'folders')).title).toBe('Thư mục | RinKuzu');
  });

  it('keeps the private page out of the index', async () => {
    expect((await metadataFor('vi')).robots).toEqual({
      index: false,
      follow: false,
      nocache: true,
    });
  });
});
