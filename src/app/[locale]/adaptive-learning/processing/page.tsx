import AdaptiveLearningProcessing from '@/components/adaptive-learning/Processing';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.processing' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function AdaptiveLearningProcessingPage() {
    return <AdaptiveLearningProcessing />;
}
