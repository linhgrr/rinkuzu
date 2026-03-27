import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';
import { Pricing2 } from '@/components/blocks/pricing2';
import { siteUrl } from '@/lib/seo';
import { buildFaqSchema } from '@/lib/structured-data';
import { JsonLd } from '@/components/seo/JsonLd';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/pricing',
    title: 'Pricing | RinKuzu',
    description:
      'RinKuzu pricing: free plan with core PDF quiz generation and adaptive practice. Premium plan for professionals with full adaptive learning, advanced features, and priority support.',
  });
}

const pricingFaqs = [
  {
    q: 'What is included in the free plan?',
    a: 'The free plan includes unlimited basic PDF-to-quiz generation, adaptive practice sessions, mastery tracking, Bloom\'s Taxonomy level practice, community quiz browsing, and a personal dashboard. Everything you need to get started with AI-powered learning.',
  },
  {
    q: 'How does the Premium plan work?',
    a: 'Premium unlocks full adaptive learning features including priority concept recommendation, advanced quiz modes, priority email support, and early access to new features. Contact us for custom pricing for teams and institutions.',
  },
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
  },
  {
    q: 'Is there a student or educator discount?',
    a: 'Yes! Educators and students can contact us at support@rinkuzu.com for special pricing. We believe AI-powered learning should be accessible to everyone.',
  },
];

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;

  const pricingSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'RinKuzu Pricing Plans',
    url: `${siteUrl.origin}/pricing`,
    description: 'Compare RinKuzu Free and Premium plans for AI-powered adaptive learning from PDFs.',
    mainEntity: {
      '@type': 'ItemList',
      name: 'RinKuzu Pricing Plans',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Free Plan',
          url: `${siteUrl.origin}/pricing#free`,
          description: 'Core PDF quiz generation, adaptive practice, and mastery tracking.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/IsAccessibleForFree',
          },
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Premium Plan',
          url: `${siteUrl.origin}/pricing#premium`,
          description: 'Full adaptive learning, advanced features, and priority support.',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/ContactForPricing',
            description: 'Contact us for custom pricing',
          },
        },
      ],
    },
  };

  const faqSchema = buildFaqSchema(pricingFaqs);

  return (
    <main className="min-h-screen bg-white">
      {/* SEO Schema */}
      <JsonLd id="pricing-schema" data={pricingSchema} />
      <JsonLd id="pricing-faq-schema" data={faqSchema} />

      {/* Hero */}
      <section className="bg-[#fbfbfd] py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-[#1d1d1f] mb-4">Simple, Transparent Pricing</h1>
          <p className="text-[#86868b] text-lg">
            Start free. Upgrade when you&apos;re ready for full adaptive learning.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <Pricing2
        heading="Choose Your Plan"
        description="Start free and upgrade when you need advanced learning features."
        plans={[
          {
            id: 'free',
            name: 'Free',
            description: 'For students and individuals',
            monthlyPrice: '$0',
            yearlyPrice: '$0',
            features: [
              { text: 'Unlimited PDF-to-quiz generation' },
              { text: 'Adaptive practice sessions' },
              { text: 'Knowledge graph visualization' },
              { text: 'Bloom\'s Taxonomy mastery levels' },
              { text: 'Progress tracking dashboard' },
              { text: 'Community quiz browsing' },
              { text: 'Community support' },
            ],
            button: {
              text: 'Get Started Free',
              url: locale === 'en' ? '/register' : `/${locale}/register`,
            },
          },
          {
            id: 'premium',
            name: 'Premium',
            description: 'For professionals and teams',
            monthlyPrice: 'Contact us',
            yearlyPrice: 'Contact us',
            features: [
              { text: 'Everything in Free' },
              { text: 'Priority concept recommendation' },
              { text: 'Advanced quiz analytics' },
              { text: 'Team management & sharing' },
              { text: 'Priority email support' },
              { text: 'Early access to new features' },
              { text: 'Custom learning paths' },
            ],
            button: {
              text: 'Contact Sales',
              url: 'mailto:support@rinkuzu.com',
            },
          },
        ]}
      />

      {/* Pricing FAQ */}
      <section className="py-20 bg-[#fbfbfd]">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#1d1d1f] mb-10 text-center">Pricing Questions</h2>
          <div className="space-y-6">
            {pricingFaqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-semibold text-[#1d1d1f] mb-2">{faq.q}</h3>
                <p className="text-[#86868b] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-[#1d1d1f] text-white py-16 text-center">
        <div className="max-w-xl mx-auto px-6 space-y-4">
          <h2 className="text-2xl font-semibold">Not sure which plan is right for you?</h2>
          <p className="text-gray-400">
            Start with the free plan — no credit card required. Upgrade anytime.
          </p>
          <a
            href="/faq"
            className="inline-block border border-white/30 text-white font-semibold px-8 py-3 rounded-full hover:bg-white/10 transition-colors"
          >
            Read the FAQ
          </a>
        </div>
      </section>
    </main>
  );
}

