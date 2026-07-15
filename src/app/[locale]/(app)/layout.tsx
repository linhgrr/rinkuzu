import { getServerSession } from 'next-auth';
import { Montserrat } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import Providers from '@/app/providers';
import { getScopedMessages } from '@/i18n/messages';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import BottomNav from '@/components/BottomNav';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { ClientOnlyAppAddons } from '@/components/ClientOnlyAppAddons';
import { AppChrome } from '@/components/app-chrome/AppChrome';
import { authOptions } from '@/lib/auth';

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['400', '600', '700'],
});

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
    <div className={montserrat.variable}>
      <NextIntlClientProvider messages={messages}>
        <Providers session={session}>
          <AppChrome>
            <MainLayoutWrapper>{children}</MainLayoutWrapper>
          </AppChrome>
          <BottomNav />
          <ClientOnlyAppAddons />
        </Providers>
      </NextIntlClientProvider>
    </div>
  );
}
