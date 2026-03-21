import Link from 'next/link'
import { defaultLocale } from '@/i18n/config'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildFaqSchema, buildSoftwareApplicationSchema } from '@/lib/structured-data'

type TranslateFn = (key: string, values?: Record<string, any>) => string

type AdaptiveLearningGuestProps = {
  locale: string
  t: TranslateFn
}

const FAQ_ITEMS = [
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
] as const

const getLocalizedPath = (locale: string, path: string) =>
  locale === defaultLocale ? path : `/${locale}${path}`

export default function AdaptiveLearningGuest({ locale, t }: AdaptiveLearningGuestProps) {
  const loginPath = getLocalizedPath(locale, '/login')
  const registerPath = getLocalizedPath(locale, '/register')
  const uploadPath = getLocalizedPath(locale, '/adaptive-learning/upload')
  const callbackPath = getLocalizedPath(locale, '/adaptive-learning')

  const faqSchema = buildFaqSchema(
    FAQ_ITEMS.map(item => ({ q: item.question, a: item.answer })),
  )

  const softwareSchema = buildSoftwareApplicationSchema(locale)

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <JsonLd id="adaptive-faq-schema" data={faqSchema} />
      <JsonLd id="adaptive-software-schema" data={softwareSchema} />

      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          AI Adaptive Learning for STEM subjects
        </h1>
        <p className="text-lg text-slate-600">
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
          <h2 className="mb-2 font-semibold text-slate-900">{t('howItWorksStep1')}</h2>
          <p className="text-sm text-slate-600">{t('uploadDescription')}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold text-slate-900">{t('howItWorksStep2')}</h2>
          <p className="text-sm text-slate-600">{t('knowledgeGraph.subtitle')}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold text-slate-900">{t('howItWorksStep3')}</h2>
          <p className="text-sm text-slate-600">{t('dashboardDescription')}</p>
        </article>
      </div>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map(item => (
            <article key={item.question} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-1 font-medium text-slate-900">{item.question}</h3>
              <p className="text-sm text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-xl bg-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Ready to start your learning path?
          </h2>
          <p className="mt-1 text-slate-300">
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
  )
}
