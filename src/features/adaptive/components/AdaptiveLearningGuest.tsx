import { Link } from '@/i18n/navigation';
import { JsonLd } from '@/components/seo/JsonLd';
import { QuestionContent } from '@/components/ui/QuestionContent';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import { buildFaqSchema, buildSoftwareApplicationSchema } from '@/lib/structured-data';
import { ROUTES } from '@/shared/constants/routes';

type AdaptiveLearningGuestProps = {
  locale: string;
  t: TranslateFn;
};

const FAQ_KEYS = ['howItWorks', 'forBeginners', 'multipleSubjects'] as const;

export default function AdaptiveLearningGuest({ locale, t }: AdaptiveLearningGuestProps) {
  // next-intl Link hrefs must be locale-unprefixed.
  const loginPath = ROUTES.LOGIN;
  const registerPath = ROUTES.REGISTER;
  const uploadPath = '/adaptive/upload';
  const callbackPath = '/adaptive';

  const faqItems = FAQ_KEYS.map((key) => ({
    question: t(`guest.faq.${key}.question`),
    answer: t(`guest.faq.${key}.answer`),
  }));

  const faqSchema = buildFaqSchema(faqItems.map((item) => ({ q: item.question, a: item.answer })));

  const softwareSchema = buildSoftwareApplicationSchema(locale);

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <JsonLd id="adaptive-faq-schema" data={faqSchema} />
      <JsonLd id="adaptive-software-schema" data={softwareSchema} />

      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
          {t('guest.heroTitle')}
        </h1>
        <p className="text-lg text-neutral-600">{t('dashboardDescription')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`}
            className="inline-flex items-center rounded-lg bg-brand-action px-5 py-2.5 font-medium text-brand-action-text hover:bg-brand-action-hover"
          >
            {t('guest.loginCta')}
          </Link>
          <Link
            href={registerPath}
            className="inline-flex items-center rounded-lg border border-line px-5 py-2.5 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {t('guest.registerCta')}
          </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-2 font-semibold text-neutral-900">{t('howItWorksStep1')}</h2>
          <p className="text-sm text-neutral-600">{t('uploadDescription')}</p>
        </article>
        <article className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-2 font-semibold text-neutral-900">{t('howItWorksStep2')}</h2>
          <p className="text-sm text-neutral-600">{t('knowledgeGraph.subtitle')}</p>
        </article>
        <article className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-2 font-semibold text-neutral-900">{t('howItWorksStep3')}</h2>
          <p className="text-sm text-neutral-600">{t('dashboardDescription')}</p>
        </article>
      </div>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-neutral-900">{t('guest.faqTitle')}</h2>
        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <article key={FAQ_KEYS[index]} className="rounded-xl border border-line bg-white p-5">
              <QuestionContent
                content={item.question}
                variant="compact"
                headingLevel={3}
                className="mb-1 font-medium text-neutral-900"
              />
              <QuestionContent
                content={item.answer}
                variant="compact"
                className="text-sm text-neutral-600"
              />
            </article>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4 rounded-xl bg-brand-trust p-6 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('guest.ctaTitle')}</h2>
          <p className="mt-1 text-white/75">{t('guest.ctaDescription')}</p>
        </div>
        <Link
          href={`${loginPath}?callbackUrl=${encodeURIComponent(uploadPath)}`}
          className="inline-flex items-center justify-center rounded-lg bg-brand-action px-5 py-2.5 font-medium text-brand-action-text hover:bg-brand-action-hover"
        >
          {t('guest.startNow')}
        </Link>
      </div>
    </section>
  );
}
