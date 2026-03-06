import AdaptiveLearningUpload from '@/components/adaptive-learning/Upload';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.upload' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

export default function AdaptiveLearningUploadPage() {
    return <AdaptiveLearningUpload />;
}
