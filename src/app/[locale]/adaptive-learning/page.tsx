import AdaptiveLearningDashboard from '@/components/adaptive-learning/Dashboard';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { defaultLocale } from '@/i18n/config';
import { buildLocalizedMetadata, canonicalFor } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;

    return buildLocalizedMetadata({
        locale,
        path: '/adaptive-learning',
        title: locale === 'vi'
            ? 'Hoc tap thich ung bang AI | RinKuzu'
            : 'AI Adaptive Learning Platform | RinKuzu',
        description: locale === 'vi'
            ? 'Tai tai lieu PDF, de AI trich xuat khai niem va tao lo trinh hoc tap ca nhan hoa theo Bloom.'
            : 'Upload your PDF, let AI extract concepts, and learn with a personalized Bloom-based curriculum.',
    });
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
    const t = await getTranslations({ locale, namespace: 'adaptiveLearning' });

    if (!session?.user) {
        const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
        const registerPath = locale === defaultLocale ? '/register' : `/${locale}/register`;
        const uploadPath = locale === defaultLocale ? '/adaptive-learning/upload' : `/${locale}/adaptive-learning/upload`;
        const callbackPath = locale === defaultLocale ? '/adaptive-learning' : `/${locale}/adaptive-learning`;

        const faqItems = [
            {
                question: locale === 'vi'
                    ? 'Hoc tap thich ung hoat dong nhu the nao?'
                    : 'How does adaptive learning work?',
                answer: locale === 'vi'
                    ? 'Ban tai PDF, AI se trich xuat khai niem, tao do thi tien quyet va de xuat bai tap theo muc Bloom phu hop.'
                    : 'You upload a PDF, AI extracts concepts, builds prerequisite knowledge graph, then recommends Bloom-level exercises.',
            },
            {
                question: locale === 'vi'
                    ? 'Nen tang co phu hop cho nguoi moi bat dau khong?'
                    : 'Is it suitable for beginners?',
                answer: locale === 'vi'
                    ? 'Co. He thong danh gia muc do va mo khoa bai hoc theo tien do, giup nguoi hoc di tu co ban den nang cao.'
                    : 'Yes. The system adapts difficulty and unlocks lessons progressively from fundamentals to advanced topics.',
            },
            {
                question: locale === 'vi'
                    ? 'Toi co the hoc nhieu mon cung luc khong?'
                    : 'Can I learn multiple subjects?',
                answer: locale === 'vi'
                    ? 'Co. Ban co the tao nhieu phien hoc tu cac tai lieu khac nhau va theo doi tien do rieng tung mon.'
                    : 'Yes. You can create multiple sessions from different documents and track progress per subject.',
            },
        ];

        const faqSchema = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                },
            })),
        };

        const softwareSchema = {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'RinKuzu Adaptive Learning',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            url: canonicalFor(locale, '/adaptive-learning'),
            offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
            },
            description: locale === 'vi'
                ? 'Nen tang hoc tap thich ung su dung AI de tao lo trinh hoc ca nhan hoa tu tai lieu PDF.'
                : 'Adaptive learning platform using AI to build personalized learning paths from PDF materials.',
        };

        return (
            <section className="max-w-4xl mx-auto space-y-8">
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
                />

                <header className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                        {locale === 'vi'
                            ? 'Hoc tap thich ung bang AI cho mon STEM'
                            : 'AI Adaptive Learning for STEM subjects'}
                    </h1>
                    <p className="text-slate-600 text-lg">
                        {t('dashboardDescription')}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`}
                            className="inline-flex items-center rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700"
                        >
                            {locale === 'vi' ? 'Dang nhap de bat dau' : 'Login to start learning'}
                        </Link>
                        <Link
                            href={registerPath}
                            className="inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                        >
                            {locale === 'vi' ? 'Tao tai khoan' : 'Create account'}
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
                        {locale === 'vi' ? 'Cau hoi thuong gap' : 'Frequently asked questions'}
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
                            {locale === 'vi' ? 'San sang bat dau lo trinh hoc?' : 'Ready to start your learning path?'}
                        </h2>
                        <p className="text-slate-300 mt-1">
                            {locale === 'vi'
                                ? 'Tai tai lieu dau tien va de AI tao curriculum ca nhan hoa cho ban.'
                                : 'Upload your first document and let AI build your personalized curriculum.'}
                        </p>
                    </div>
                    <Link
                        href={`${loginPath}?callbackUrl=${encodeURIComponent(uploadPath)}`}
                        className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 font-medium text-slate-900 hover:bg-slate-100"
                    >
                        {locale === 'vi' ? 'Bat dau ngay' : 'Start now'}
                    </Link>
                </div>
            </section>
        );
    }

    const userId = session.user.id;
    const { subjects, sessionHistory } = await fetchInitialData(userId);
    return <AdaptiveLearningDashboard initialSubjects={subjects} initialSessionHistory={sessionHistory} />;
}
