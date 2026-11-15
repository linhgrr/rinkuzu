import { setRequestLocale } from 'next-intl/server';
import { getScopedMessages } from '@/i18n/messages';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { AppShell } from '@/components/app-chrome/AppShell';

/**
 * Cached signed-out twins of `(app)` pages (RIN-1646). The proxy rewrites a
 * request with no session cookie here, so this tree renders the signed-out
 * chrome and must never read the session, cookies or headers: the HTML is
 * shared by every signed-out visitor (guarded by
 * tests/ui/public-cache-session-free-contract.test.ts).
 */
export default async function PublicCacheLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getScopedMessages(locale, APP_MESSAGE_NAMESPACES);

  return (
    <AppShell messages={messages} session={null}>
      {children}
    </AppShell>
  );
}
