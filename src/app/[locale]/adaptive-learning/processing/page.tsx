import AdaptiveLearningProcessing from '@/components/adaptive-learning/Processing';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.processing' });
    return buildLocalizedMetadata({
        locale: params.locale,
        path: '/adaptive-learning/processing',
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
