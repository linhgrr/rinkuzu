import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/privacy',
    title: 'Privacy Policy | RinKuzu',
    description: 'How RinKuzu collects, uses, and protects user data.',
  });
}

export default async function PrivacyPage({ params }: Props) {
  await params;

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="text-slate-600">
        RinKuzu is committed to protecting your personal data. We only use data to operate and improve the service.
      </p>
      <h2 className="text-xl font-semibold text-slate-900">Data we collect</h2>
      <p className="text-slate-600">
        Account information, uploaded learning materials, and learning activity data for personalization.
      </p>
      <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
      <p className="text-slate-600">support@rinkuzu.com</p>
    </section>
  );
}
