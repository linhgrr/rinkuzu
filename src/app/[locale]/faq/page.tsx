import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/faq',
    title: locale === 'vi' ? 'FAQ | RinKuzu' : 'FAQ | RinKuzu',
    description:
      locale === 'vi'
        ? 'Cau hoi thuong gap ve RinKuzu va tinh nang hoc tap thich ung bang AI.'
        : 'Frequently asked questions about RinKuzu and adaptive AI learning.',
  });
}

export default async function FAQPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  const faqs = [
    {
      q: isVi ? 'RinKuzu la gi?' : 'What is RinKuzu?',
      a: isVi
        ? 'RinKuzu la nen tang tao quiz va hoc tap thich ung bang AI tu tai lieu PDF.'
        : 'RinKuzu is an AI-powered quiz and adaptive learning platform built from PDF materials.',
    },
    {
      q: isVi ? 'Toi co the dung mien phi khong?' : 'Can I use it for free?',
      a: isVi
        ? 'Ban co the bat dau voi cac tinh nang co ban. Mot so tinh nang nang cao yeu cau goi premium.'
        : 'You can start with core features for free. Some advanced features require a premium plan.',
    },
    {
      q: isVi ? 'Nen tang ho tro ngon ngu nao?' : 'Which languages are supported?',
      a: isVi
        ? 'Hien tai RinKuzu ho tro tieng Viet va tieng Anh.'
        : 'RinKuzu currently supports Vietnamese and English.',
    },
  ];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <h1 className="text-3xl font-bold text-slate-900">{isVi ? 'Cau hoi thuong gap' : 'Frequently asked questions'}</h1>
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
