import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import AdaptiveLearningGuest from '@/features/adaptive/components/AdaptiveLearningGuest';
import { fetchAdaptiveDashboardData } from './_lib/fetch-initial-data';
import AdaptiveLearningDashboard from '@/components/adaptive/Dashboard';
import { authOptions } from '@/lib/auth';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildSoftwareApplicationSchema } from '@/lib/structured-data';

type PageParams = { locale: string };
type PageProps = { params: Promise<PageParams> };

const ADAPTIVE_LEARNING_METADATA = {
  path: '/adaptive',
  title: 'AI Adaptive Learning Platform | RinKuzu',
  description:
    'Upload your PDF, let AI extract concepts, and learn with a personalized Bloom-based curriculum.',
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  return buildLocalizedMetadata({
    locale,
    ...ADAPTIVE_LEARNING_METADATA,
  });
}

const softwareSchema = buildSoftwareApplicationSchema('vi');

export default async function AdaptiveLearningPage({ params }: PageProps) {
  const { locale } = await params;
  const [session, t] = await Promise.all([
    getServerSession(authOptions),
    getTranslations({ locale, namespace: 'adaptiveLearning' }),
  ]);

  return (
    <>
      <JsonLd id="adaptive-software-schema" data={softwareSchema} />
      {session?.user ? (
        <AdaptiveDashboardLoader userId={session.user.id} />
      ) : (
        <AdaptiveLearningGuest locale={locale} t={t} />
      )}
    </>
  );
}

// Separate async server component for authenticated dashboard data
async function AdaptiveDashboardLoader({ userId }: { userId: string }) {
  const { subjects, sessionHistory } = await fetchAdaptiveDashboardData(userId);
  return (
    <AdaptiveLearningDashboard
      initialSubjects={subjects}
      initialSessionHistory={sessionHistory}
      didHydrateFromServer
    />
  );
}
