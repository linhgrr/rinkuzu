import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineMail } from 'react-icons/hi';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import {
  unsubscribeLinkState,
  type UnsubscribeLinkState,
} from '@/lib/communication/review-reminder';
import { unsubscribeCampaign } from '@/lib/communication/review-reminder-policy';
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
  searchParams: Promise<{
    t?: string | string[];
    c?: string | string[];
    result?: string | string[];
  }>;
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

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center rounded-xl bg-brand-trust px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-trust-hover';
const SECONDARY_BUTTON =
  'inline-flex items-center justify-center rounded-xl border border-brand-trust px-5 py-3 text-sm font-semibold text-brand-trust transition-colors hover:bg-green-50';

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const token = typeof query.t === 'string' ? query.t : '';
  const state = await resolveState(token, query.result === 'error');
  const t = await getTranslations({ locale, namespace: 'communications.unsubscribe' });
  // The nudge's campaign rides along so the opt-out is attributed (RIN-1044).
  const campaign = unsubscribeCampaign(query.c);
  const action = `/api/unsubscribe?t=${encodeURIComponent(token)}${campaign ? `&c=${campaign}` : ''}`;
  const showForm = state === 'subscribed' || (state === 'error' && token.length > 0);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-neutral-50" />
      <div className="relative flex min-h-screen flex-col justify-center px-4 pt-16 py-8 sm:px-6 sm:pt-20 sm:py-12 lg:px-8">
        <div className="mb-6 sm:mx-auto sm:w-full sm:max-w-md sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center sm:h-20">
                <Image
                  src="/images/auth_logo.webp"
                  alt="RinKuzu Logo"
                  width={80}
                  height={80}
                  className="h-16 w-auto object-contain sm:h-20"
                  style={{ width: 'auto' }}
                  unoptimized
                />
              </div>
            </Link>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card className="border-0 bg-white shadow-lg shadow-neutral-200/60">
            <CardHeader className="pb-4 text-center">
              <CardTitle size="lg" className="text-neutral-900">
                {t(COPY[state].title)}
              </CardTitle>
              <CardDescription className="text-base">{t(COPY[state].description)}</CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                {state === 'subscribed' && (
                  <HiOutlineMail className="size-10 text-brand-trust" aria-hidden="true" />
                )}
                {state === 'unsubscribed' && (
                  <HiOutlineCheckCircle className="size-10 text-emerald-500" aria-hidden="true" />
                )}
                {(state === 'invalid' || state === 'error') && (
                  <HiOutlineExclamationCircle className="size-10 text-red-500" aria-hidden="true" />
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {showForm && (
                    <form method="post" action={action}>
                      <input type="hidden" name="locale" value={locale} />
                      <Button type="submit" size="lg">
                        {t(state === 'error' ? 'retryButton' : 'confirmButton')}
                      </Button>
                    </form>
                  )}
                  <Link
                    href="/"
                    prefetch={false}
                    className={showForm ? SECONDARY_BUTTON : PRIMARY_BUTTON}
                  >
                    {t('home')}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
