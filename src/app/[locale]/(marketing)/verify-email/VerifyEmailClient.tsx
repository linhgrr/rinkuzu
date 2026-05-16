'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineMail,
} from '@/components/icons';
import { fetchApiResponse } from '@/lib/api/client';

type Status = 'pending' | 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setStatus('error');
      setMessage(t('verifyEmailFailed'));
      return;
    }

    setStatus('verifying');
    fetchApiResponse<unknown, { message?: string }>('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((response) => {
        setStatus('success');
        setMessage(response.meta?.message ?? t('verifyEmailSuccess'));
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : t('verifyEmailFailed'));
      });
  }, [token, t]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-neutral-50" />
      <div className="relative flex min-h-screen flex-col justify-center px-4 pt-16 py-8 sm:px-6 sm:pt-20 sm:py-12 lg:px-8">
        <div className="mb-6 sm:mx-auto sm:w-full sm:max-w-md sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center sm:h-20">
                <Image
                  src="/images/auth_logo.png"
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
                {status === 'verifying'
                  ? t('verifyEmailVerifying')
                  : status === 'success'
                    ? t('verifyEmailSuccess')
                    : t('verifyEmailFailed')}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2">
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-4 py-4 text-center"
              >
                {status === 'verifying' && (
                  <HiOutlineMail className="size-10 text-teal-500" aria-hidden="true" />
                )}
                {status === 'success' && (
                  <HiOutlineCheckCircle className="size-10 text-emerald-500" aria-hidden="true" />
                )}
                {status === 'error' && (
                  <HiOutlineExclamationCircle className="size-10 text-red-500" aria-hidden="true" />
                )}

                {message && <p className="text-sm text-neutral-700">{message}</p>}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {status === 'success' && (
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                    >
                      {t('signIn')}
                    </Link>
                  )}
                  {status === 'error' && (
                    <Link
                      href="/check-email"
                      className="inline-flex items-center justify-center rounded-xl border border-teal-600 px-5 py-3 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal-50"
                    >
                      {t('resendVerification')}
                    </Link>
                  )}
                </div>
              </div>
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
