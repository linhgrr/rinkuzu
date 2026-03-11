import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
    robots: {
        index: true,
        follow: true,
    },
};

export default function AdaptiveLearningLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
                {children}
            </main>
        </div>
    );
}
