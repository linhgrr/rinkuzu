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

import { generateMetadata } from './layout';

function metadataFor(locale: string) {
  return generateMetadata({ params: Promise.resolve({ locale }) });
}

// RIN-1200: the tab read the marketing title on this private page.
describe('my-quizzes layout metadata', () => {
  it('uses the localised page title', async () => {
    expect((await metadataFor('en')).title).toBe('My quizzes | RinKuzu');
    expect((await metadataFor('vi')).title).toBe('Bài của tôi | RinKuzu');
  });

  it('keeps the private page out of the index', async () => {
    expect((await metadataFor('vi')).robots).toEqual({
      index: false,
      follow: false,
      nocache: true,
    });
  });
});
