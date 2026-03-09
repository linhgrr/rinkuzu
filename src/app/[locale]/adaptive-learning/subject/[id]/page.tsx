import SubjectDetails from '@/components/adaptive-learning/SubjectDetails';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Props = {
    params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'adaptiveLearning.meta.subject' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default async function AdaptiveLearningSubjectPage({ params }: Props) {
    const { id } = await params;
    return <SubjectDetails sessionId={id} />;
}
