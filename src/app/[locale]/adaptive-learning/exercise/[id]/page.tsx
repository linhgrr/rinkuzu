import AdaptiveLearningExercise from '@/components/adaptive-learning/Exercise';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string; id: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.exercise' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function AdaptiveLearningExercisePage({ params }: { params: { id: string } }) {
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
            <AdaptiveLearningExercise sessionId={params.id} />
        </>
    );
}
