import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import AdaptiveLearningGuest from './_components/AdaptiveLearningGuest'
import { fetchAdaptiveDashboardData } from './_lib/fetch-initial-data'
import AdaptiveLearningDashboard from '@/components/adaptive-learning/Dashboard'
import { authOptions } from '@/lib/auth'
import { buildLocalizedMetadata } from '@/lib/seo'

type PageParams = { locale: string }
type PageProps = { params: Promise<PageParams> }

const ADAPTIVE_LEARNING_METADATA = {
  path: '/adaptive-learning',
  title: 'AI Adaptive Learning Platform | RinKuzu',
  description: 'Upload your PDF, let AI extract concepts, and learn with a personalized Bloom-based curriculum.',
} as const

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params

  return buildLocalizedMetadata({
    locale,
    ...ADAPTIVE_LEARNING_METADATA,
  })
}

export default async function AdaptiveLearningPage({ params }: PageProps) {
  const { locale } = await params
  const [session, t] = await Promise.all([
    getServerSession(authOptions),
    getTranslations({ locale, namespace: 'adaptiveLearning' }),
  ])

  if (!session?.user)
    return <AdaptiveLearningGuest locale={locale} t={t} />

  const { subjects, sessionHistory } = await fetchAdaptiveDashboardData(session.user.id)

  return (
    <AdaptiveLearningDashboard
      initialSubjects={subjects}
      initialSessionHistory={sessionHistory}
      didHydrateFromServer
    />
  )
}
