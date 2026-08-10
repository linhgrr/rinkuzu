import AdaptiveLearningProcessing from '@/features/adaptive/components/Processing';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';
import { AsyncRouteParams } from '@/types/next-route';

export async function generateMetadata({
  params,
}: AsyncRouteParams<{ locale: string }>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'adaptiveLearning.meta.processing' });
  return buildLocalizedMetadata({
    locale,
    path: '/adaptive/processing',
    title: t('title'),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  });
}

export default function AdaptiveLearningProcessingPage() {
  return <AdaptiveLearningProcessing />;
}
