import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CircleCheck } from 'lucide-react';
import { buildLocalizedMetadata, siteUrl } from '@/lib/seo';
import { buildFaqSchema } from '@/lib/structured-data';
import { JsonLd } from '@/components/seo/JsonLd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createPlanCatalogService } from '@/lib/plan-catalog-factory';
import { formatVndCurrency } from '@/lib/formatters';
import { DurationUtils } from '@/types/subscription';
import {
  FREE_PRICING_FEATURE_KEYS,
  PREMIUM_PRICING_FEATURE_KEYS,
} from '@/features/subscription/constants/pricing-features';
import { formatPlanDuration } from '@/features/subscription/lib/plan-duration';
import {
  PricingPlanCtaLink,
  PricingViewTracker,
} from '@/features/subscription/components/PricingPaywallTracking';

type Props = {
  params: Promise<{ locale: string }>;
};

interface FaqEntry {
  q: string;
  a: string;
}

interface PremiumPlanView {
  id: string;
  name: string;
  price: number;
  months: number;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return buildLocalizedMetadata({
    locale,
    path: '/pricing',
    title: t('meta.title'),
    description: t('meta.description'),
  });
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const registerHref = ROUTES.REGISTER;
  const subscriptionHref = ROUTES.SUBSCRIPTION;

  const premiumPlans = (await loadPremiumPlans()).sort((a, b) => a.price - b.price);
  const lowestPrice = premiumPlans[0]?.price ?? null;

  const freeFeatures = FREE_PRICING_FEATURE_KEYS.map((key) => t(`free.features.${key}`));
  const premiumFeatures = PREMIUM_PRICING_FEATURE_KEYS.map((key) => t(`premium.features.${key}`));
  const faqs = t.raw('faqs') as FaqEntry[];

  const faqSchema = buildFaqSchema(faqs);
  const pricingSchema = buildPricingSchema(premiumPlans);

  return (
    <main className="min-h-screen bg-white">
      <JsonLd id="pricing-schema" data={pricingSchema} />
      <JsonLd id="pricing-faq-schema" data={faqSchema} />
      <PricingViewTracker />

      <section className="bg-[var(--bg-section)] py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-semibold text-[var(--text-primary)] mb-4">
            {t('hero.title')}
          </h1>
          <p className="text-[var(--text-muted)] text-lg">{t('hero.subtitle')}</p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-6xl flex-col items-stretch justify-center gap-6 md:flex-row md:flex-wrap">
            <Card className="flex w-full md:w-72 flex-col justify-between text-left">
              <CardHeader>
                <CardTitle>{t('free.name')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('free.tagline')}</p>
                <span className="text-4xl font-bold">{formatVndCurrency(0)}</span>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {freeFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CircleCheck className="size-4 flex-shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={registerHref}
                  className="mt-6 inline-block w-full rounded-full border border-neutral-300 px-6 py-2.5 text-center font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
                >
                  {t('free.cta')}
                </Link>
              </CardContent>
            </Card>

            {premiumPlans.map((plan) => (
              <Card
                key={plan.id}
                className="pricing-card-featured relative flex w-full md:w-72 flex-col justify-between text-left"
              >
                {plan.price === lowestPrice && (
                  <div className="pricing-popular-badge absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold">
                    {t('premium.popular')}
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatPlanDuration(t, plan.months)}
                  </p>
                  <span className="text-4xl font-bold">{formatVndCurrency(plan.price)}</span>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 font-semibold text-green-700">
                    {t('premium.everythingInFree')}
                  </p>
                  <ul className="space-y-3">
                    {premiumFeatures.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CircleCheck className="size-4 flex-shrink-0 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <PricingPlanCtaLink
                    href={subscriptionHref}
                    planId={plan.id}
                    className="mt-6 inline-block w-full rounded-full bg-brand-action-strong px-6 py-2.5 text-center font-semibold text-white transition-colors hover:bg-brand-action-strong-hover"
                  >
                    {t('premium.cta')}
                  </PricingPlanCtaLink>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[var(--bg-section)]">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)] mb-10 text-center">
            {t('faqHeading')}
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">{faq.q}</h3>
                <p className="text-[var(--text-muted)] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-orange-50 via-white to-green-50 py-16 text-center border-t border-neutral-100">
        <div className="max-w-xl mx-auto px-6 space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-900">{t('cta.title')}</h2>
          <p className="text-neutral-600">{t('cta.subtitle')}</p>
          <Link
            href={registerHref}
            className="inline-block bg-brand-action-strong text-white font-semibold px-8 py-3 rounded-full hover:bg-brand-action-strong-hover transition-colors shadow-sm"
          >
            {t('cta.button')}
          </Link>
        </div>
      </section>
    </main>
  );
}

async function loadPremiumPlans(): Promise<PremiumPlanView[]> {
  try {
    const plans = await createPlanCatalogService().listActive();
    const premiumPlans: PremiumPlanView[] = [];
    for (const plan of plans) {
      if (plan.price <= 0) continue;
      premiumPlans.push({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        months: DurationUtils.getDurationInfo(plan.duration).months,
      });
    }
    return premiumPlans;
  } catch {
    // Marketing page must render even if the plans service is unavailable.
    return [];
  }
}

function buildPricingSchema(premiumPlans: PremiumPlanView[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'RinKuzu Pricing Plans',
    url: `${siteUrl.origin}/pricing`,
    description:
      'Compare RinKuzu Free and Premium plans for AI-powered personalized learning from PDFs.',
    mainEntity: {
      '@type': 'ItemList',
      name: 'RinKuzu Pricing Plans',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Free Plan',
          url: `${siteUrl.origin}/pricing#free`,
          description: 'Core PDF quiz generation, personalized practice, and mastery tracking.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'VND',
            availability: 'https://schema.org/IsAccessibleForFree',
          },
        },
        ...premiumPlans.map((plan, index) => ({
          '@type': 'ListItem',
          position: index + 2,
          name: plan.name,
          url: `${siteUrl.origin}/pricing#premium`,
          description:
            'Full access to the curated Quiz Premium catalog, higher AI limits, and advanced statistics.',
          offers: {
            '@type': 'Offer',
            price: String(plan.price),
            priceCurrency: 'VND',
            availability: 'https://schema.org/InStock',
          },
        })),
      ],
    },
  };
}
