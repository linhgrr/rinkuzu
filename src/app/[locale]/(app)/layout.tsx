import { getServerSession } from 'next-auth';
import { NextIntlClientProvider } from 'next-intl';
import Providers from '@/app/providers';
import { getScopedMessages } from '@/i18n/messages';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import BottomNav from '@/components/BottomNav';
import { GlobalFooter } from '@/components/GlobalFooter';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { ClientOnlyAppAddons } from '@/components/ClientOnlyAppAddons';
import { AppChrome } from '@/components/app-chrome/AppChrome';
import { authOptions } from '@/lib/auth';

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
    getServerSession(authOptions),
  ]);

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers session={session}>
        <AppChrome>
          <MainLayoutWrapper>
            {children}
            <GlobalFooter />
          </MainLayoutWrapper>
        </AppChrome>
        <BottomNav />
        <ClientOnlyAppAddons />
      </Providers>
    </NextIntlClientProvider>
  );
}
