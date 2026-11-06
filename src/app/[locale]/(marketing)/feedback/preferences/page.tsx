import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeedbackPreferencePage } from '@/features/communications/components/FeedbackPreferencePage';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[]; action?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'communications.feedbackPreference' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

// Reads the query on the server, so there is no Suspense fallback to flash (RIN-981).
export default async function PublicFeedbackPreferencePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const token = typeof query.token === 'string' ? query.token.trim() : '';
  return (
    <FeedbackPreferencePage
      token={token}
      initialAction={query.action === 'opt_out' ? 'opt_out' : 'decline'}
    />
  );
}
