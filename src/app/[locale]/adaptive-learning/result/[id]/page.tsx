import AdaptiveLearningResult from '@/components/adaptive-learning/Result';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Result | Adaptive Learning',
    description: 'Exercise feedback',
};

export default function AdaptiveLearningResultPage({ params }: { params: { id: string } }) {
    return <AdaptiveLearningResult exerciseId={params.id} />;
}
