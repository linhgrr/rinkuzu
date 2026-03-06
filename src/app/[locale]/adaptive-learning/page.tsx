import AdaptiveLearningDashboard from '@/components/adaptive-learning/Dashboard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.dashboard' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function AdaptiveLearningPage() {
    return <AdaptiveLearningDashboard />;
}
