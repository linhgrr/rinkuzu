import type { Metadata } from 'next';
import Link from 'next/link';
import { buildLocalizedMetadata } from '@/lib/seo';
import { defaultLocale } from '@/i18n/config';

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
  const registerPath = locale === defaultLocale ? '/register' : `/${locale}/register`;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">RinKuzu Pricing</h1>
        <p className="text-slate-600">
          Start free and upgrade when you need advanced learning features.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <h2 className="text-xl font-semibold">Free plan</h2>
          <p className="text-3xl font-bold">0$</p>
          <ul className="text-slate-600 space-y-1">
            <li>- Basic PDF-to-quiz generation</li>
            <li>- Practice and progress tracking</li>
            <li>- Community support</li>
          </ul>
        </article>

        <article className="rounded-xl border border-violet-200 bg-violet-50 p-6 space-y-3">
          <h2 className="text-xl font-semibold">Premium plan</h2>
          <p className="text-3xl font-bold">Contact us</p>
          <ul className="text-slate-700 space-y-1">
            <li>- Full adaptive learning access</li>
            <li>- Private and advanced quiz features</li>
            <li>- Priority support</li>
          </ul>
        </article>
      </div>

      <Link
        href={registerPath}
        className="inline-flex items-center rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700"
      >
        Create account
      </Link>
    </section>
  );
}
