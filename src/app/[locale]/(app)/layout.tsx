import { getScopedMessages } from '@/i18n/messages';
import { APP_MESSAGE_NAMESPACES } from '@/i18n/namespaces';
import { AppShell } from '@/components/app-chrome/AppShell';
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
    <AppShell messages={messages} session={session}>
      {children}
    </AppShell>
  );
}
