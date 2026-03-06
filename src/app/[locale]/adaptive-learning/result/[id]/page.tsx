import AdaptiveLearningResult from '@/components/adaptive-learning/Result';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string; id: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.result' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function AdaptiveLearningResultPage({ params }: { params: { id: string } }) {
    return <AdaptiveLearningResult sessionId={params.id} />;
}
