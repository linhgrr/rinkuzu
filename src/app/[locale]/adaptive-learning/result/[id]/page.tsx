import AdaptiveLearningResult from '@/components/adaptive-learning/Result';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Props = {
    params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'adaptiveLearning.meta.result' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default async function AdaptiveLearningResultPage({ params }: Props) {
    const { id } = await params;
    return <AdaptiveLearningResult sessionId={id} />;
}
