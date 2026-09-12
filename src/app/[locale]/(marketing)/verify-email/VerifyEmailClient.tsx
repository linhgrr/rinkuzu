'use client';

import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Suspense, useEffect, useReducer, useRef } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineMail } from 'react-icons/hi';
import { verifyEmail } from '@/features/auth/api/auth-api';
import { markAnalyticsSignupPending } from '@/lib/analytics/client';

type Status = 'pending' | 'verifying' | 'success' | 'error';

type ViewState = {
  status: Status;
  message: string | null;
};

type ViewAction =
  | { type: 'missing-token'; message: string }
  | { type: 'verifying' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const INITIAL_VIEW_STATE: ViewState = {
  status: 'pending',
  message: null,
};

function viewStateReducer(_state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'missing-token':
      return { status: 'error', message: action.message };
    case 'verifying':
      return { status: 'verifying', message: null };
    case 'success':
      return { status: 'success', message: action.message };
    case 'error':
      return { status: 'error', message: action.message };
    default:
      return _state;
  }
}

function VerifyEmailContent() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const token = get('token') ?? '';
  const [viewState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      dispatch({ type: 'missing-token', message: t('verifyEmailFailed') });
      return;
    }

    dispatch({ type: 'verifying' });
    verifyEmail(token)
      .then((result) => {
        markAnalyticsSignupPending('credentials', locale);
        dispatch({
          type: 'success',
          message: result.message ?? t('verifyEmailSuccess'),
        });
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'error',
          message: error instanceof Error ? error.message : t('verifyEmailFailed'),
        });
      });
  }, [locale, token, t]);

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
                {t('verifyEmailTitle')}
              </CardTitle>
              <CardDescription className="text-base">
                {viewState.status === 'verifying'
                  ? t('verifyEmailVerifying')
                  : viewState.status === 'success'
                    ? t('verifyEmailSuccess')
                    : t('verifyEmailFailed')}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              <output
                aria-live="polite"
                className="flex flex-col items-center gap-4 py-4 text-center"
              >
                {viewState.status === 'verifying' && (
                  <HiOutlineMail className="size-10 text-brand-trust" aria-hidden="true" />
                )}
                {viewState.status === 'success' && (
                  <HiOutlineCheckCircle className="size-10 text-emerald-500" aria-hidden="true" />
                )}
                {viewState.status === 'error' && (
                  <HiOutlineExclamationCircle className="size-10 text-red-500" aria-hidden="true" />
                )}

                {viewState.message && (
                  <p className="text-sm text-neutral-700">{viewState.message}</p>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {viewState.status === 'success' && (
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center rounded-xl bg-brand-trust px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-trust-hover"
                    >
                      {t('signIn')}
                    </Link>
                  )}
                  {viewState.status === 'error' && (
                    <Link
                      href="/check-email"
                      className="inline-flex items-center justify-center rounded-xl border border-brand-trust px-5 py-3 text-sm font-semibold text-brand-trust transition-colors hover:bg-green-50"
                    >
                      {t('resendVerification')}
                    </Link>
                  )}
                </div>
              </output>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function VerifyEmailClient() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
