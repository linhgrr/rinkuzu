import { Inter, Montserrat } from 'next/font/google';
import type { Session } from 'next-auth';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';
import Providers from '@/app/providers';
import BottomNav from '@/components/BottomNav';
import { ClientOnlyAppAddons } from '@/components/ClientOnlyAppAddons';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { AppChrome } from '@/components/app-chrome/AppChrome';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['400', '600', '700'],
});

interface AppShellProps {
  children: ReactNode;
  messages: AbstractIntlMessages;
  /** `null` renders the signed-out chrome without a session fetch. */
  session: Session | null;
}

/**
 * The app chrome around every `(app)` page and its cached signed-out twins
 * (RIN-1646). It reads nothing per request: the caller passes the session.
 */
export function AppShell({ children, messages, session }: AppShellProps) {
  return (
    <div className={`${inter.className} ${montserrat.variable}`}>
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
