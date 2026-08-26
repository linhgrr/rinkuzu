import { redirect } from '@/i18n/navigation';

export default async function EmailPreferencesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return redirect({
    href: { pathname: '/profile', query: { tab: 'email' } },
    locale,
  });
}
