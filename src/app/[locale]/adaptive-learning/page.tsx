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
        const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
        const headers = {
            'x-user-id': userId,
            ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
        };
        const timeoutMs = Number(process.env.ADAPTIVE_PROXY_TIMEOUT_MS || 20_000);

        const fetchAdaptiveJson = async (path: string) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(`${apiUrl}${path}`, {
                    headers,
                    cache: 'no-store',
                    signal: controller.signal,
                });
                if (!response.ok) return null;
                return response.json();
            } finally {
                clearTimeout(timeout);
            }
        };

        // Parallel fetching
        const [subjectsData, historyData] = await Promise.all([
            fetchAdaptiveJson('/api/history/subjects'),
            fetchAdaptiveJson('/api/history/sessions?limit=5'),
        ]);

        return {
            subjects: subjectsData?.subjects || [],
            sessionHistory: historyData?.sessions || [],
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
