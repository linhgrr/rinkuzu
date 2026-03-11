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
    title: locale === 'vi' ? 'Chinh sach Cookie | RinKuzu' : 'Cookie Policy | RinKuzu',
    description:
      locale === 'vi'
        ? 'Thong tin ve cach RinKuzu su dung cookie de cai thien trai nghiem nguoi dung.'
        : 'How RinKuzu uses cookies to improve your user experience.',
  });
}

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">{isVi ? 'Chinh sach Cookie' : 'Cookie Policy'}</h1>
      <p className="text-slate-600">
        {isVi
          ? 'Chung toi su dung cookie de duy tri phien dang nhap, phan tich hieu nang, va cai thien trai nghiem hoc tap.'
          : 'We use cookies to maintain sessions, analyze performance, and improve learning experience.'}
      </p>
      <h2 className="text-xl font-semibold text-slate-900">{isVi ? 'Loai cookie' : 'Cookie types'}</h2>
      <ul className="text-slate-600 space-y-1">
        <li>- {isVi ? 'Cookie can thiet de xac thuc va bao mat.' : 'Essential cookies for authentication and security.'}</li>
        <li>- {isVi ? 'Cookie phan tich de do luong hieu nang san pham.' : 'Analytics cookies for product performance insights.'}</li>
      </ul>
    </section>
  );
}
