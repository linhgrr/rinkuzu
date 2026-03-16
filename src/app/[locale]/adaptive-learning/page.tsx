import AdaptiveLearningDashboard from '@/components/adaptive-learning/Dashboard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { defaultLocale } from '@/i18n/config';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildFaqSchema, buildSoftwareApplicationSchema } from '@/lib/structured-data';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;

    return buildLocalizedMetadata({
        locale,
        path: '/adaptive-learning',
        title: 'AI Adaptive Learning Platform | RinKuzu',
        description: 'Upload your PDF, let AI extract concepts, and learn with a personalized Bloom-based curriculum.',
    });
}

async function fetchInitialData(userId: string) {
    try {
        const apiUrl = process.env.ADAPTIVE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
        const headers = {
            'x-user-id': userId,
            ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
        };
        const timeoutMs = Number(process.env.ADAPTIVE_PROXY_TIMEOUT_MS || 60_000);

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

        // Keep independent requests resilient so one failure does not blank all dashboard data.
        const [subjectsDataResult, historyDataResult] = await Promise.allSettled([
            fetchAdaptiveJson('/api/history/subjects'),
            fetchAdaptiveJson('/api/history/sessions?limit=5'),
        ]);

        const subjectsData = subjectsDataResult.status === 'fulfilled' ? subjectsDataResult.value : null;
        const historyData = historyDataResult.status === 'fulfilled' ? historyDataResult.value : null;

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
    const [session, t] = await Promise.all([
        getServerSession(authOptions),
        getTranslations({ locale, namespace: 'adaptiveLearning' }),
    ]);

    if (!session?.user) {
        const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
        const registerPath = locale === defaultLocale ? '/register' : `/${locale}/register`;
        const uploadPath = locale === defaultLocale ? '/adaptive-learning/upload' : `/${locale}/adaptive-learning/upload`;
        const callbackPath = locale === defaultLocale ? '/adaptive-learning' : `/${locale}/adaptive-learning`;

        const faqItems = [
            {
                question: 'How does adaptive learning work?',
                answer: 'You upload a PDF, AI extracts concepts, builds prerequisite knowledge graph, then recommends Bloom-level exercises.',
            },
            {
                question: 'Is it suitable for beginners?',
                answer: 'Yes. The system adapts difficulty and unlocks lessons progressively from fundamentals to advanced topics.',
            },
            {
                question: 'Can I learn multiple subjects?',
                answer: 'Yes. You can create multiple sessions from different documents and track progress per subject.',
            },
        ];

        const faqSchema = buildFaqSchema(
            faqItems.map((item) => ({ q: item.question, a: item.answer }))
        );

        const softwareSchema = buildSoftwareApplicationSchema(locale);

        return (
            <section className="max-w-4xl mx-auto space-y-8">
                <JsonLd id="adaptive-faq-schema" data={faqSchema} />
                <JsonLd id="adaptive-software-schema" data={softwareSchema} />

                <header className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                        AI Adaptive Learning for STEM subjects
                    </h1>
                    <p className="text-slate-600 text-lg">
                        {t('dashboardDescription')}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`}
                            className="inline-flex items-center rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700"
                        >
                            Login to start learning
                        </Link>
                        <Link
                            href={registerPath}
                            className="inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Create account
                        </Link>
                    </div>
                </header>

                <div className="grid gap-4 md:grid-cols-3">
                    <article className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="font-semibold text-slate-900 mb-2">{t('howItWorksStep1')}</h2>
                        <p className="text-sm text-slate-600">{t('uploadDescription')}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="font-semibold text-slate-900 mb-2">{t('howItWorksStep2')}</h2>
                        <p className="text-sm text-slate-600">{t('knowledgeGraph.subtitle')}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="font-semibold text-slate-900 mb-2">{t('howItWorksStep3')}</h2>
                        <p className="text-sm text-slate-600">{t('dashboardDescription')}</p>
                    </article>
                </div>

                <section className="space-y-3">
                    <h2 className="text-2xl font-semibold text-slate-900">
                        Frequently asked questions
                    </h2>
                    <div className="space-y-3">
                        {faqItems.map((item) => (
                            <article key={item.question} className="rounded-xl border border-slate-200 bg-white p-5">
                                <h3 className="font-medium text-slate-900 mb-1">{item.question}</h3>
                                <p className="text-slate-600 text-sm">{item.answer}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <div className="rounded-xl bg-slate-900 text-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold">
                            Ready to start your learning path?
                        </h2>
                        <p className="text-slate-300 mt-1">
                            Upload your first document and let AI build your personalized curriculum.
                        </p>
                    </div>
                    <Link
                        href={`${loginPath}?callbackUrl=${encodeURIComponent(uploadPath)}`}
                        className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 font-medium text-slate-900 hover:bg-slate-100"
                    >
                        Start now
                    </Link>
                </div>
            </section>
        );
    }

    const userId = session.user.id;
    const { subjects, sessionHistory } = await fetchInitialData(userId);
    return <AdaptiveLearningDashboard initialSubjects={subjects} initialSessionHistory={sessionHistory} />;
}
