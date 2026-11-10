import { useTranslations } from 'next-intl';
import { HiOutlineArrowRight } from 'react-icons/hi';
import { Card, CardContent } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { withAuthCallback } from '@/lib/routing/auth-callback';
import { ROUTES } from '@/shared/constants/routes';
import { GUEST_DRAFT_LIMIT_COPY } from '../lib/guest-limit-copy';

/** Same text link as the guest result and cap cards: 44px target, brand-trust underline. */
const ACCOUNT_LINK_CLASS =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand-trust underline hover:text-brand-trust-hover';

/**
 * `/create` for a signed-out visitor (RIN-1473, UI spec RIN-1445 1b): the guest PDF trial
 * first, sign-in second, instead of a redirect to login. No drafts and no account API call.
 * A server component: it ships no JS beyond the links.
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
          <Card className="overflow-hidden border-brand-trust/20 bg-gradient-to-br from-green-50 via-white to-green-50/40 p-0">
            <CardContent className="flex min-h-56 flex-col p-5 sm:p-6">
              <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
                {t('guestHub.title')}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                {t('guestHub.body', GUEST_DRAFT_LIMIT_COPY)}
              </p>
              <Link
                href={`${ROUTES.TRY_PDF}?entry=create`}
                className="btn btn-primary mt-auto h-auto min-h-11 w-full whitespace-normal py-3 text-center leading-snug sm:w-fit"
              >
                {t('guestHub.cta')}
                <HiOutlineArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-line bg-white p-0">
            <CardContent className="flex min-h-56 flex-col p-5 sm:p-6">
              <h2 className="text-xl leading-7 font-semibold tracking-tight text-neutral-950">
                {t('guestHub.accountTitle')}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{t('guestHub.accountBody')}</p>
              <div className="mt-auto flex flex-wrap gap-x-6 pt-3">
                <Link
                  href={withAuthCallback(ROUTES.LOGIN, ROUTES.CREATE_QUIZ)}
                  className={ACCOUNT_LINK_CLASS}
                >
                  {t('guestHub.signIn')}
                </Link>
                <Link
                  href={withAuthCallback(ROUTES.REGISTER, ROUTES.CREATE_QUIZ)}
                  className={ACCOUNT_LINK_CLASS}
                >
                  {t('guestHub.createAccount')}
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
