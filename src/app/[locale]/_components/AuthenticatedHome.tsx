'use client';

import { useQuizzes } from '@/hooks';
import { useTranslations } from 'next-intl';
import { NavLogo } from '@/components/Navigation';
import { DashboardClient } from './index';

interface AuthenticatedHomeProps {
    session: any;
    initialStatus: string;
}

export function AuthenticatedHome({ session, initialStatus }: AuthenticatedHomeProps) {
    const { quizzes, isLoading: quizzesLoading } = useQuizzes(6);
    const t = useTranslations('common');

    if (quizzesLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <div className="text-center animate-pulse">
                    <div className="flex justify-center mb-4">
                        <NavLogo />
                    </div>
                    <p className="text-[#86868b]">{t('loadingDashboard')}</p>
                </div>
            </div>
        );
    }

    return <DashboardClient userEmail={session?.user?.email || ''} />;
}
