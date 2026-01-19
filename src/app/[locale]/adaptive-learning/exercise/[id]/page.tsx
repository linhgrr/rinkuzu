import AdaptiveLearningExercise from '@/components/adaptive-learning/Exercise';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Excercise | Adaptive Learning',
    description: 'Practice concepts tailored to your needs',
};

export default function AdaptiveLearningExercisePage({ params }: { params: { id: string } }) {
    return <AdaptiveLearningExercise exerciseId={params.id} />;
}
