import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineArrowRight } from 'react-icons/hi';
import { Card, CardContent } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';
import { GUEST_DRAFT_LIMIT_COPY } from '../lib/guest-limit-copy';

/** Same text link as the guest result and cap cards: 44px target, brand-trust underline. */
const TEXT_LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

interface HubCardProps {
  title: string;
  body: string;
  className: string;
  /** The card's controls, inside the shared actions wrapper. */
  children: ReactNode;
}

/**
 * One rhythm for both hub cards (RIN-1561, Designer values in RIN-1553 round 2): padding
 * 16/20 px, title to text 12 px, text to actions at least 16 px. Cards in one row share
 * one height with their actions at the bottom (`h-full` + `mt-auto`); the trial card's
 * actions sit on one row from `sm` so both action rows match and the space above the
 * account links is only the difference in text length.
 */
function HubCard({ title, body, className, children }: HubCardProps) {
  return (
    <Card className={cn('p-0', className)}>
      <CardContent className="flex h-full flex-col p-4 sm:p-5">
        <div className="space-y-3">
          <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
            {title}
          </h2>
          <p className="text-sm leading-6 text-neutral-600">{body}</p>
        </div>
        <div className="mt-auto flex flex-col items-start pt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

/**
 * `/create` for a signed-out visitor (RIN-1473, UI spec RIN-1445 1b): the guest PDF trial
 * (or pasted text, RIN-1539) first, sign-in second, instead of a redirect to login. No
 * drafts and no account API call. A server component: it ships no JS beyond the links.
 */
export function GuestCreateHubPage() {
  const t = useTranslations('create');

  return (
    <main className="min-h-dvh bg-neutral-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {t('createHubTitle')}
          </h1>
        </header>

        <section
          className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2"
          aria-label={t('chooseMethod')}
        >
          <HubCard
            title={t('guestHub.title')}
            body={t('guestHub.body', GUEST_DRAFT_LIMIT_COPY)}
            className="overflow-hidden border-brand-trust/20 bg-gradient-to-br from-green-50 via-white to-green-50/40"
          >
            <div className="flex w-full flex-col items-start sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
              <Link
                href={`${ROUTES.TRY_PDF}?entry=create`}
                className="btn btn-primary h-auto min-h-11 w-full whitespace-normal py-3 text-center leading-snug sm:w-fit"
              >
                {t('guestHub.cta')}
                <HiOutlineArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
              <Link
                href={`${ROUTES.TRY_TEXT}?entry=create`}
                className={cn(TEXT_LINK_CLASS, 'mt-3 gap-1.5 sm:mt-0')}
              >
                {t('guestHub.orPasteText')}
                <HiOutlineArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          </HubCard>

          <HubCard
            title={t('guestHub.accountTitle')}
            body={t('guestHub.accountBody')}
            className="border-line bg-white"
          >
            <div className="flex flex-wrap gap-x-6">
              <Link
                href={withAuthCallback(ROUTES.LOGIN, ROUTES.CREATE_QUIZ)}
                className={TEXT_LINK_CLASS}
              >
                {t('guestHub.signIn')}
              </Link>
              <Link
                href={withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ)}
                className={TEXT_LINK_CLASS}
              >
                {t('guestHub.createAccount')}
              </Link>
            </div>
          </HubCard>
        </section>
      </div>
    </main>
  );
}
