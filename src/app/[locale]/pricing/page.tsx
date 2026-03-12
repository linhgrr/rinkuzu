import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';
import { Pricing2 } from '@/components/blocks/pricing2';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/pricing',
    title: 'Pricing | RinKuzu',
    description: 'Compare free and premium plans to learn more effectively with RinKuzu.',
  });
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;

  return (
    <Pricing2
      heading="Pricing Plans"
      description="Start free and upgrade when you need advanced learning features."
      plans={[
        {
          id: "free",
          name: "Free plan",
          description: "For personal use",
          monthlyPrice: "$0",
          yearlyPrice: "$0",
          features: [
            { text: "Basic PDF-to-quiz generation" },
            { text: "Practice and progress tracking" },
            { text: "Community support" },
          ],
          button: {
            text: "Create account",
            url: locale === 'en' ? '/register' : `/${locale}/register`,
          },
        },
        {
          id: "premium",
          name: "Premium plan",
          description: "For professionals",
          monthlyPrice: "Contact us",
          yearlyPrice: "Contact us",
          features: [
            { text: "Full adaptive learning access" },
            { text: "Private and advanced quiz features" },
            { text: "Priority support" },
          ],
          button: {
            text: "Contact sales",
            url: "mailto:support@rinkuzu.com",
          },
        },
      ]}
    />
  );
}
