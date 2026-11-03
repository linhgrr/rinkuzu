'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

const REDIRECT_DELAY_MS = 1_500;
const SESSION_ENDPOINT = '/api/auth/session';

/**
 * How often a visible tab asks whether its session was replaced (RIN-687).
 *
 * The server already refuses a replaced session on its next request: every
 * `auth()` compares the JWT `av` with the user's `authVersion`. This check only
 * decides how soon the old tab tells the learner and signs out. Bound: within
 * 30 s while the tab is visible, and on the first check after a hidden tab
 * becomes visible again.
 */
const SESSION_CHECK_INTERVAL_MS = 30_000;

interface SessionCheckBody {
  invalidatedReason?: unknown;
}

/**
 * One GET per check, outside next-auth's SessionProvider. The provider's own
 * poll calls `getSession()`, which broadcasts on a fresh BroadcastChannel; the
 * provider's listener on its singleton channel hears that echo in the same tab
 * and fetches again, so every tick cost two requests (and one more per other
 * open tab).
 */
async function isSessionReplaced(): Promise<boolean> {
  const response = await fetch(SESSION_ENDPOINT, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return false;
  const body = (await response.json()) as SessionCheckBody | null;
  return body?.invalidatedReason === 'session_replaced';
}

function useReplacedSessionCheck(signedIn: boolean): boolean {
  const [replaced, setReplaced] = useState(false);

  useEffect(() => {
    if (!signedIn) return undefined;
    let active = true;
    let inFlight = false;

    const check = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        if ((await isSessionReplaced()) && active) setReplaced(true);
      } catch {
        // Offline or a transient error: the next check retries.
      } finally {
        inFlight = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };

    const timer = window.setInterval(() => void check(), SESSION_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [signedIn]);

  return replaced;
}

export function SingleSessionGuard() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations('auth');
  const handledRef = useRef(false);
  const logoutFormRef = useRef<HTMLFormElement>(null);
  const polledReplaced = useReplacedSessionCheck(Boolean(session?.user));
  const replaced = polledReplaced || session?.invalidatedReason === 'session_replaced';

  useEffect(() => {
    if (!replaced || handledRef.current) return;
    handledRef.current = true;

    toast.error(t('sessionReplaced'));

    window.setTimeout(() => {
      logoutFormRef.current?.requestSubmit();
    }, REDIRECT_DELAY_MS);
  }, [replaced, t]);

  return (
    <form ref={logoutFormRef} action="/api/session/logout" method="post" hidden aria-hidden="true">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="reason" value="session_replaced" />
    </form>
  );
}
