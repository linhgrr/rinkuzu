import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enSubscription from '../../../../../messages/en/subscription.json';
import viSubscription from '../../../../../messages/vi/subscription.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: 'subscription' }) =>
    createTranslator({
      locale,
      messages: { subscription: locale === 'vi' ? viSubscription : enSubscription },
      namespace,
    }),
}));

import { generateMetadata } from './layout';

function metadataFor(locale: string) {
  return generateMetadata({ params: Promise.resolve({ locale }) });
}

// RIN-1015: the tab read the generic root title "AI Quiz Generator from PDF ...".
describe('subscription layout metadata', () => {
  it('uses the localised page title', async () => {
    expect((await metadataFor('vi')).title).toBe('Gói đăng ký | RinKuzu');
    expect((await metadataFor('en')).title).toBe('Subscription | RinKuzu');
  });

  it('keeps the private page out of the index', async () => {
    expect((await metadataFor('vi')).robots).toEqual({
      index: false,
      follow: false,
      nocache: true,
    });
  });
});
