import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import AdaptiveLearningGuest from '@/features/adaptive/components/AdaptiveLearningGuest';
import { fetchAdaptiveDashboardData } from '@/features/adaptive/api/adaptive-dashboard-initial-api';
import { AdaptiveDashboardRouteSkeleton } from './_components/AdaptiveDashboardRouteSkeleton';
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
        <Suspense fallback={<AdaptiveDashboardRouteSkeleton />}>
          <AdaptiveDashboardLoader userId={session.user.id} />
        </Suspense>
      ) : (
        <AdaptiveLearningGuest locale={locale} t={t} />
      )}
    </>
  );
}

// Separate async server component for authenticated dashboard data
async function AdaptiveDashboardLoader({ userId }: { userId: string }) {
  const { apiOnline, initialErrorKey, subjects, sessionHistory } =
    await fetchAdaptiveDashboardData(userId);
  return (
    <Suspense fallback={<AdaptiveDashboardRouteSkeleton />}>
      <AdaptiveLearningDashboard
        initialSubjects={subjects}
        initialSessionHistory={sessionHistory}
        initialApiOnline={apiOnline}
        initialErrorKey={initialErrorKey}
        didHydrateFromServer
      />
    </Suspense>
  );
}
