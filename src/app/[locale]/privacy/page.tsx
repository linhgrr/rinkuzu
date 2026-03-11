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
    title: locale === 'vi' ? 'Chinh sach bao mat | RinKuzu' : 'Privacy Policy | RinKuzu',
    description:
      locale === 'vi'
        ? 'Thong tin ve cach RinKuzu thu thap, su dung va bao ve du lieu nguoi dung.'
        : 'How RinKuzu collects, uses, and protects user data.',
  });
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">{isVi ? 'Chinh sach bao mat' : 'Privacy Policy'}</h1>
      <p className="text-slate-600">
        {isVi
          ? 'RinKuzu cam ket bao ve du lieu ca nhan cua ban. Chung toi chi su dung du lieu de van hanh va cai thien dich vu.'
          : 'RinKuzu is committed to protecting your personal data. We only use data to operate and improve the service.'}
      </p>
      <h2 className="text-xl font-semibold text-slate-900">{isVi ? 'Du lieu thu thap' : 'Data we collect'}</h2>
      <p className="text-slate-600">
        {isVi
          ? 'Thong tin tai khoan, noi dung tai lieu ban tai len, va du lieu hoc tap de ca nhan hoa trai nghiem.'
          : 'Account information, uploaded learning materials, and learning activity data for personalization.'}
      </p>
      <h2 className="text-xl font-semibold text-slate-900">{isVi ? 'Lien he' : 'Contact'}</h2>
      <p className="text-slate-600">support@rinkuzu.com</p>
    </section>
  );
}
