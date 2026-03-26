import dynamic from 'next/dynamic';
import { NextIntlClientProvider } from 'next-intl';
import { getScopedMessages } from '@/i18n/messages';
import { MARKETING_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { GlobalFooter } from '@/components/GlobalFooter';

const PWAInstaller = dynamic(() => import('@/components/PWAInstaller'), {
  ssr: false,
});

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getScopedMessages(locale, MARKETING_MESSAGE_NAMESPACES);

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
      <GlobalFooter />
      <PWAInstaller />
    </NextIntlClientProvider>
  );
}
