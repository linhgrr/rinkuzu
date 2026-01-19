import AdaptiveLearningProcessing from '@/components/adaptive-learning/Processing';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Processing... | Adaptive Learning',
    description: 'AI analysis in progress',
};

export default function AdaptiveLearningProcessingPage() {
    return <AdaptiveLearningProcessing />;
}
