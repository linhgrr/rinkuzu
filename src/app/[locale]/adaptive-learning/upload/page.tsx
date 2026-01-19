import AdaptiveLearningUpload from '@/components/adaptive-learning/Upload';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Upload Material | Adaptive Learning',
    description: 'Upload PDFs to start your personalized learning journey',
};

export default function AdaptiveLearningUploadPage() {
    return <AdaptiveLearningUpload />;
}
