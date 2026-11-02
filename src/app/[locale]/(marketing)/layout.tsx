import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { getScopedMessages } from '@/i18n/messages';
import { MARKETING_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { GlobalFooter } from '@/components/GlobalFooter';
import { ClientOnlyMarketingAddons } from '@/components/ClientOnlyMarketingAddons';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getScopedMessages(locale, MARKETING_MESSAGE_NAMESPACES);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <GlobalFooter />
      <ClientOnlyMarketingAddons />
    </NextIntlClientProvider>
  );
}
