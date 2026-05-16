'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlineMail, HiOutlineExclamationCircle } from '@/components/icons';
import { ApiResponseError, fetchApiResponse } from '@/lib/api/client';
import { extractApiErrorMeta } from '@/lib/api/error';
import { resendVerificationSchema, type ForgotPasswordInput } from '@/lib/validation/auth';

const DEFAULT_RESEND_COOLDOWN = 60;

function CheckEmailContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const initialEmail = (get('email') || '').trim().toLowerCase();

  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(resendVerificationSchema),
    mode: 'onTouched',
    defaultValues: { email: initialEmail },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    if (cooldown > 0) return;
    setServerError(null);
    try {
      const response = await fetchApiResponse<unknown, { message?: string }>(
        '/api/auth/resend-verification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: values.email }),
        },
      );
      setInfo(response.meta?.message ?? t('checkEmailDescription'));
      setCooldown(DEFAULT_RESEND_COOLDOWN);
    } catch (caught) {
      if (caught instanceof ApiResponseError && caught.status === 429) {
        const meta = extractApiErrorMeta<{ retryAfterSeconds?: number }>(caught.payload as never);
        const retry =
          typeof meta?.retryAfterSeconds === 'number'
            ? meta.retryAfterSeconds
            : DEFAULT_RESEND_COOLDOWN;
        setCooldown(retry);
        setServerError(t('rateLimited', { seconds: retry }));
      } else {
        setServerError(caught instanceof Error ? caught.message : t('loginError'));
      }
    }
  });

  const buttonLabel =
    cooldown > 0
      ? t('resendVerificationCountdown', { seconds: cooldown })
      : isSubmitting
        ? t('forgotPasswordSubmitting')
        : t('resendVerification');

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
                {t('checkEmailTitle')}
              </CardTitle>
              <CardDescription className="text-base">{t('checkEmailDescription')}</CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <form className="space-y-6" onSubmit={onSubmit} noValidate>
                {serverError && (
                  <Card
                    variant="bordered"
                    className="border-red-200 bg-red-50 p-4"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex items-center text-red-700">
                      <HiOutlineExclamationCircle
                        className="mr-2 size-5 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium">{serverError}</span>
                    </div>
                  </Card>
                )}

                {info && (
                  <p className="text-sm text-emerald-700" role="status" aria-live="polite">
                    {info}
                  </p>
                )}

                <Input
                  label={t('emailAddress')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('enterEmail')}
                  icon={<HiOutlineMail className="size-5" />}
                  aria-invalid={errors.email ? true : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="-mt-3 text-xs text-red-600">{t('invalidEmailFormat')}</p>
                )}

                <Button
                  type="submit"
                  loading={isSubmitting}
                  disabled={isSubmitting || cooldown > 0}
                  aria-busy={isSubmitting}
                  size="lg"
                  className="w-full bg-teal-600 text-white hover:bg-teal-700 shadow-sm border-0"
                >
                  {buttonLabel}
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    {t('backToLogin')}
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function CheckEmailClient() {
  return (
    <Suspense fallback={null}>
      <CheckEmailContent />
    </Suspense>
  );
}
