import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Button } from '@/components/ui/Button';
import {
  EMAIL_LINK_PRIMARY_BUTTON,
  EMAIL_LINK_SECONDARY_BUTTON,
  EmailLinkCard,
  type EmailLinkIcon,
} from '@/features/communications/components/EmailLinkCard';
import { Link } from '@/i18n/navigation';
import {
  unsubscribeLinkState,
  type UnsubscribeLinkState,
} from '@/lib/communication/review-reminder';
import { logger } from '@/lib/logger';

/**
 * Signed-out unsubscribe page for the 2-day review email (RIN-915). GET only
 * reads: a valid link shows one "Unsubscribe" button that POSTs to the
 * one-click route, so link scanners that prefetch the URL cannot opt anyone
 * out. After the POST the route redirects back here and the page reads the
 * new state from the database.
 */

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string | string[]; result?: string | string[] }>;
};

type PageState = UnsubscribeLinkState | 'error';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'communications.unsubscribe' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

async function resolveState(token: string, failed: boolean): Promise<PageState> {
  try {
    const state = await unsubscribeLinkState(token);
    // A failed POST on a link that still reads as subscribed shows the retry state.
    return failed && state === 'subscribed' ? 'error' : state;
  } catch (error) {
    logger.error({ error, operation: 'unsubscribe-page' }, 'Unsubscribe page failed');
    return 'error';
  }
}

const COPY: Record<PageState, { title: string; description: string }> = {
  subscribed: { title: 'confirmTitle', description: 'confirmDescription' },
  unsubscribed: { title: 'doneTitle', description: 'doneDescription' },
  invalid: { title: 'invalidTitle', description: 'invalidDescription' },
  error: { title: 'errorTitle', description: 'errorDescription' },
};

const ICON: Record<PageState, EmailLinkIcon> = {
  subscribed: 'mail',
  unsubscribed: 'done',
  invalid: 'problem',
  error: 'problem',
};

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const token = typeof query.t === 'string' ? query.t : '';
  const state = await resolveState(token, query.result === 'error');
  const t = await getTranslations({ locale, namespace: 'communications.unsubscribe' });
  const action = `/api/unsubscribe?t=${encodeURIComponent(token)}`;
  const showForm = state === 'subscribed' || (state === 'error' && token.length > 0);

  return (
    <EmailLinkCard
      icon={ICON[state]}
      title={t(COPY[state].title)}
      description={t(COPY[state].description)}
    >
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        {showForm && (
          <form method="post" action={action}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              {t(state === 'error' ? 'retryButton' : 'confirmButton')}
            </Button>
          </form>
        )}
        <Link
          href="/"
          prefetch={false}
          className={showForm ? EMAIL_LINK_SECONDARY_BUTTON : EMAIL_LINK_PRIMARY_BUTTON}
        >
          {t('home')}
        </Link>
      </div>
    </EmailLinkCard>
  );
}
