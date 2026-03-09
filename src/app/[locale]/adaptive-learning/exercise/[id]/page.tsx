import AdaptiveLearningExercise from '@/components/adaptive-learning/Exercise';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Props = {
    params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'adaptiveLearning.meta.exercise' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default async function AdaptiveLearningExercisePage({ params }: Props) {
    const { id } = await params;
    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                nav, .fixed.bottom-0.left-0.right-0.z-50 {
                    display: none !important;
                }
                main.pb-16 {
                    padding-bottom: 0 !important;
                }
            `}} />
            <AdaptiveLearningExercise sessionId={id} />
        </>
    );
}
