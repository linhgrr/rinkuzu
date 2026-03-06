import SubjectDetails from '@/components/adaptive-learning/SubjectDetails';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string; id: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.subject' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function AdaptiveLearningSubjectPage({ params }: { params: { id: string } }) {
    return <SubjectDetails sessionId={params.id} />;
}
