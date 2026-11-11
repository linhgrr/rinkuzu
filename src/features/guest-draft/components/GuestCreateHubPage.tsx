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
  'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

/** Both card buttons: 44px minimum, full width on mobile, wraps long vi copy. */
const CARD_BUTTON_CLASS =
  'btn h-auto min-h-11 w-full whitespace-normal py-3 text-center leading-snug sm:w-fit';

interface HubCardProps {
  title: string;
  body: string;
  className: string;
  /** A button, then a text link: the same shape in both cards. */
  children: ReactNode;
}

/**
 * One rhythm for both hub cards (RIN-1561): 20/24 px padding, title to text 8 px, text to
 * actions 24 px, button to link 8 px. The actions sit at the bottom when the desktop row
 * stretches the shorter card, so any extra room falls between the two groups.
 */
function HubCard({ title, body, className, children }: HubCardProps) {
  return (
    <Card className={cn('p-0', className)}>
      <CardContent className="flex h-full flex-col gap-6 p-5 sm:p-6">
        <div className="space-y-2">
          <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
            {title}
          </h2>
          <p className="text-sm leading-6 text-neutral-600">{body}</p>
        </div>
        <div className="mt-auto flex flex-col items-start gap-2">{children}</div>
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
            <Link
              href={`${ROUTES.TRY_PDF}?entry=create`}
              className={cn(CARD_BUTTON_CLASS, 'btn-primary')}
            >
              {t('guestHub.cta')}
              <HiOutlineArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
            <Link href={`${ROUTES.TRY_TEXT}?entry=create`} className={TEXT_LINK_CLASS}>
              {t('guestHub.orPasteText')}
              <HiOutlineArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          </HubCard>

          <HubCard
            title={t('guestHub.accountTitle')}
            body={t('guestHub.accountBody')}
            className="border-line bg-white"
          >
            <Link
              href={withAuthCallback(ROUTES.LOGIN, ROUTES.CREATE_QUIZ)}
              className={cn(CARD_BUTTON_CLASS, 'btn-secondary')}
            >
              {t('guestHub.signIn')}
            </Link>
            <Link
              href={withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ)}
              className={TEXT_LINK_CLASS}
            >
              {t('guestHub.createAccount')}
            </Link>
          </HubCard>
        </section>
      </div>
    </main>
  );
}
