import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildFaqSchema } from '@/lib/structured-data';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/faq',
    title: 'FAQ | RinKuzu',
    description: 'Frequently asked questions about RinKuzu and adaptive AI learning.',
  });
}

export default async function FAQPage({ params }: Props) {
  await params;

  const faqs = [
    {
      q: 'What is RinKuzu?',
      a: 'RinKuzu is an AI-powered quiz and adaptive learning platform built from PDF materials.',
    },
    {
      q: 'Can I use it for free?',
      a: 'You can start with core features for free. Some advanced features require a premium plan.',
    },
    {
      q: 'Which languages are supported?',
      a: 'RinKuzu currently supports Vietnamese and English.',
    },
  ];

  const faqSchema = buildFaqSchema(faqs);

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <JsonLd id="faq-schema" data={faqSchema} />
      <h1 className="text-3xl font-bold text-slate-900">Frequently asked questions</h1>
      <div className="space-y-4">
        {faqs.map((item) => (
          <article key={item.q} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">{item.q}</h2>
            <p className="text-slate-600 mt-2">{item.a}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
