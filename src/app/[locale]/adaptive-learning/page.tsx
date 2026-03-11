import AdaptiveLearningDashboard from '@/components/adaptive-learning/Dashboard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'adaptiveLearning.meta.dashboard' });
    return {
        title: t('title'),
        description: t('description'),
    };
}

async function fetchInitialData(userId: string) {
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        // Parallel fetching
        const [subjectsRes, histRes] = await Promise.all([
            fetch(`${apiUrl}/api/history/subjects`, {
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': userId
                },
                cache: 'no-store'
            }),
            fetch(`${apiUrl}/api/history/sessions?limit=5`, { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': userId
                },
                cache: 'no-store'
            })
        ]);

        const subjectsData = subjectsRes.ok ? await subjectsRes.json() : { subjects: [] };
        const historyData = histRes.ok ? await histRes.json() : { sessions: [] };

        return {
            subjects: subjectsData.subjects || [],
            sessionHistory: historyData.sessions || []
        };
    } catch (err) {
        console.error('Failed fetching adaptive learning data server-side:', err);
        return { subjects: [], sessionHistory: [] };
    }
}

export default async function AdaptiveLearningPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
        const callbackPath = locale === defaultLocale ? '/adaptive-learning' : `/${locale}/adaptive-learning`;
        redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
    }

    const userId = session.user.id;
    const { subjects, sessionHistory } = await fetchInitialData(userId);

    return <AdaptiveLearningDashboard initialSubjects={subjects} initialSessionHistory={sessionHistory} />;
}
