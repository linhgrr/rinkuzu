import { redirect } from '@/i18n/navigation';

interface LegacyMobileCreateQuizRouteProps {
  params: Promise<{ locale: string }>;
}

export default async function MobileCreateQuizRoutePage({
  params,
}: LegacyMobileCreateQuizRouteProps) {
  const { locale } = await params;
  return redirect({ href: '/create/pdf/mobile', locale });
}
