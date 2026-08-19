'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

const REDIRECT_DELAY_MS = 1_500;

export function SingleSessionGuard() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations('auth');
  const handledRef = useRef(false);
  const logoutFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (session?.invalidatedReason !== 'session_replaced' || handledRef.current) return;
    handledRef.current = true;

    toast.error(t('sessionReplaced'));

    window.setTimeout(() => {
      logoutFormRef.current?.requestSubmit();
    }, REDIRECT_DELAY_MS);
  }, [locale, session?.invalidatedReason, t]);

  return (
    <form ref={logoutFormRef} action="/api/session/logout" method="post" hidden aria-hidden="true">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reason" value="session_replaced" />
    </form>
  );
}
