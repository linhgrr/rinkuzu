import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/cookies',
    title: 'Cookie Policy | RinKuzu',
    description: 'How RinKuzu uses cookies to improve your user experience.',
  });
}

export default async function CookiesPage({ params }: Props) {
  await params;

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Cookie Policy</h1>
      <p className="text-slate-600">
        We use cookies to maintain sessions, analyze performance, and improve learning experience.
      </p>
      <h2 className="text-xl font-semibold text-slate-900">Cookie types</h2>
      <ul className="text-slate-600 space-y-1">
        <li>- Essential cookies for authentication and security.</li>
        <li>- Analytics cookies for product performance insights.</li>
      </ul>
    </section>
  );
}
