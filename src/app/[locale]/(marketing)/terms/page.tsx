import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/terms',
    title: 'Terms of Service | RinKuzu',
    description: 'Terms and conditions for using RinKuzu services.',
  });
}

export default async function TermsPage({ params }: Props) {
  await params;

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
      <p className="text-slate-600">
        By using RinKuzu, you agree to comply with these terms and applicable policies.
      </p>
      <h2 className="text-xl font-semibold text-slate-900">User accounts</h2>
      <p className="text-slate-600">
        You are responsible for safeguarding your account credentials and activity under your account.
      </p>
      <h2 className="text-xl font-semibold text-slate-900">Content and usage</h2>
      <p className="text-slate-600">
        You may upload only lawful content that you are authorized to use. We may remove violating content.
      </p>
    </section>
  );
}
