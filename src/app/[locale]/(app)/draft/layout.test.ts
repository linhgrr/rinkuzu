import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enDraft from '../../../../../messages/en/draft.json';
import viDraft from '../../../../../messages/vi/draft.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: 'draft' }) =>
    createTranslator({
      locale,
      messages: { draft: locale === 'vi' ? viDraft : enDraft },
      namespace,
    }),
}));

import { generateMetadata } from './layout';

function metadataFor(locale: string) {
  return generateMetadata({ params: Promise.resolve({ locale }) });
}

// RIN-993: the draft editor and its not-found page used the marketing title
// "AI Quiz Generator from PDF - Knowledge Graph | RinKuzu".
describe('draft layout metadata', () => {
  it('uses a page-specific, localised title', async () => {
    expect((await metadataFor('en')).title).toBe('Edit draft quiz | RinKuzu');
    expect((await metadataFor('vi')).title).toBe('Chỉnh sửa bản nháp quiz | RinKuzu');
  });

  it('keeps the private page out of the index', async () => {
    expect((await metadataFor('vi')).robots).toEqual({
      index: false,
      follow: false,
      nocache: true,
    });
  });
});
