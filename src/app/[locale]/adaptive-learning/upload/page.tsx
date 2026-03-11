import AdaptiveLearningUpload from '@/components/adaptive-learning/Upload';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildLocalizedMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
    const t = await getTranslations({ locale: params.locale, namespace: 'adaptiveLearning.meta.upload' });
    return buildLocalizedMetadata({
        locale: params.locale,
        path: '/adaptive-learning/upload',
        title: t('title'),
        description: t('description'),
        robots: {
            index: false,
            follow: false,
            nocache: true,
        },
    });
}

export default function AdaptiveLearningUploadPage() {
    return <AdaptiveLearningUpload />;
}
