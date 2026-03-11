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
    title: locale === 'vi' ? 'Bang gia | RinKuzu' : 'Pricing | RinKuzu',
    description:
      locale === 'vi'
        ? 'So sanh goi mien phi va premium de hoc tap hieu qua hon voi RinKuzu.'
        : 'Compare free and premium plans to learn more effectively with RinKuzu.',
  });
}

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const registerPath = locale === defaultLocale ? '/register' : `/${locale}/register`;

  return (
    <section className="max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{isVi ? 'Bang gia RinKuzu' : 'RinKuzu pricing'}</h1>
        <p className="text-slate-600">
          {isVi
            ? 'Bat dau mien phi va nang cap khi ban can them tinh nang nang cao.'
            : 'Start free and upgrade when you need advanced learning features.'}
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <h2 className="text-xl font-semibold">{isVi ? 'Goi mien phi' : 'Free plan'}</h2>
          <p className="text-3xl font-bold">0$</p>
          <ul className="text-slate-600 space-y-1">
            <li>- {isVi ? 'Tao quiz co ban tu PDF' : 'Basic PDF-to-quiz generation'}</li>
            <li>- {isVi ? 'Luyen tap va theo doi tien do' : 'Practice and progress tracking'}</li>
            <li>- {isVi ? 'Ho tro cong dong' : 'Community support'}</li>
          </ul>
        </article>

        <article className="rounded-xl border border-violet-200 bg-violet-50 p-6 space-y-3">
          <h2 className="text-xl font-semibold">{isVi ? 'Goi premium' : 'Premium plan'}</h2>
          <p className="text-3xl font-bold">{isVi ? 'Lien he' : 'Contact us'}</p>
          <ul className="text-slate-700 space-y-1">
            <li>- {isVi ? 'Adaptive learning day du' : 'Full adaptive learning access'}</li>
            <li>- {isVi ? 'Kho quiz rieng tu va nang cao' : 'Private and advanced quiz features'}</li>
            <li>- {isVi ? 'Uu tien ho tro' : 'Priority support'}</li>
          </ul>
        </article>
      </div>

      <Link
        href={registerPath}
        className="inline-flex items-center rounded-lg bg-violet-600 px-5 py-2.5 font-medium text-white hover:bg-violet-700"
      >
        {isVi ? 'Tao tai khoan' : 'Create account'}
      </Link>
    </section>
  );
}
