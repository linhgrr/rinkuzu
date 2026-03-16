import AdaptiveLearningExercise from '@/components/adaptive-learning/Exercise';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
    params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, id } = await params;
    const t = await getTranslations({ locale, namespace: 'adaptiveLearning.meta.exercise' });
    return buildLocalizedMetadata({
        locale,
        path: `/adaptive-learning/exercise/${id}`,
        title: t('title'),
        description: t('description'),
        robots: {
            index: false,
            follow: false,
            nocache: true,
        },
    });
}

export default async function AdaptiveLearningExercisePage({ params }: Props) {
    const { id } = await params;
    return <AdaptiveLearningExercise sessionId={id} />;
}
