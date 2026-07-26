import { NextIntlClientProvider } from 'next-intl';
import Providers from '@/app/providers';
import { CheckoutHeader } from './CheckoutHeader';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { getScopedMessages } from '@/i18n/messages';
import { getCurrentSession } from '@/lib/auth/session';

export default async function CheckoutLayout({
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
        <div className="min-h-dvh bg-surface-page font-home text-ink">
          <CheckoutHeader />
          <main>{children}</main>
        </div>
      </Providers>
    </NextIntlClientProvider>
  );
}
