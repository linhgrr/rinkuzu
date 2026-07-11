import { NextIntlClientProvider } from 'next-intl';
import Providers from '@/app/providers';
import { getScopedMessages } from '@/i18n/messages';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import BottomNav from '@/components/BottomNav';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { ClientOnlyAppAddons } from '@/components/ClientOnlyAppAddons';
import { AppChrome } from '@/components/app-chrome/AppChrome';
import { getCurrentSession } from '@/lib/auth/session';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [messages, session] = await Promise.all([
    getScopedMessages(locale, APP_MESSAGE_NAMESPACES),
    getCurrentSession(),
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers session={session}>
        <AppChrome>
          <MainLayoutWrapper>{children}</MainLayoutWrapper>
        </AppChrome>
        <BottomNav />
        <ClientOnlyAppAddons />
      </Providers>
    </NextIntlClientProvider>
  );
}
