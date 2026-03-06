'use client';

import Navigation from '@/components/Navigation';

export default function AdaptiveLearningLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-12">
            <Navigation />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
                {children}
            </main>
        </div>
    );
}
