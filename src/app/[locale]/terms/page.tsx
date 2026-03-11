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
    title: locale === 'vi' ? 'Dieu khoan su dung | RinKuzu' : 'Terms of Service | RinKuzu',
    description:
      locale === 'vi'
        ? 'Dieu khoan va dieu kien su dung nen tang RinKuzu.'
        : 'Terms and conditions for using RinKuzu services.',
  });
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <section className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">{isVi ? 'Dieu khoan su dung' : 'Terms of Service'}</h1>
      <p className="text-slate-600">
        {isVi
          ? 'Khi su dung RinKuzu, ban dong y tuan thu cac dieu khoan su dung va quy dinh lien quan.'
          : 'By using RinKuzu, you agree to comply with these terms and applicable policies.'}
      </p>
      <h2 className="text-xl font-semibold text-slate-900">{isVi ? 'Tai khoan nguoi dung' : 'User accounts'}</h2>
      <p className="text-slate-600">
        {isVi
          ? 'Ban co trach nhiem bao mat thong tin dang nhap va hoat dong trong tai khoan cua minh.'
          : 'You are responsible for safeguarding your account credentials and activity under your account.'}
      </p>
      <h2 className="text-xl font-semibold text-slate-900">{isVi ? 'Noi dung va su dung' : 'Content and usage'}</h2>
      <p className="text-slate-600">
        {isVi
          ? 'Ban chi duoc tai len noi dung hop phap va co quyen su dung. Chung toi co quyen tu choi noi dung vi pham.'
          : 'You may upload only lawful content that you are authorized to use. We may remove violating content.'}
      </p>
    </section>
  );
}
