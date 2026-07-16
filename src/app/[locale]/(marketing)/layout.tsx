import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getScopedMessages } from '@/i18n/messages';
import { MARKETING_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { GlobalFooter } from '@/components/GlobalFooter';
import { ClientOnlyMarketingAddons } from '@/components/ClientOnlyMarketingAddons';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
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
    <div className={inter.className}>
      <NextIntlClientProvider messages={messages}>
        {children}
        <GlobalFooter />
        <ClientOnlyMarketingAddons />
      </NextIntlClientProvider>
    </div>
  );
}
