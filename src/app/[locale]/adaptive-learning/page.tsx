import AdaptiveLearningDashboard from '@/components/adaptive-learning/Dashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Adaptive Learning | Rinkuzu',
    description: 'Personalized learning path based on your documents',
};

export default function AdaptiveLearningPage() {
    return <AdaptiveLearningDashboard />;
}
