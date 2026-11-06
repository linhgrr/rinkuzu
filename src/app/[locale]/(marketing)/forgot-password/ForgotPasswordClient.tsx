'use client';

import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HiOutlineMail, HiOutlineExclamationCircle, HiOutlineCheckCircle } from 'react-icons/hi';
import { requestPasswordReset } from '@/features/auth/api/auth-api';
import { describeApiError } from '@/lib/api/error-kind';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/auth';

const DEFAULT_RETRY_AFTER_SECONDS = 60;

export function ForgotPasswordClient() {
  const t = useTranslations('auth');
  const apiErrorMessage = useApiErrorMessage();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
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
      await requestPasswordReset(values.email);
      setSuccess(true);
    } catch (caught) {
      // Never the server text (RIN-980); a rate limit gets the check-email countdown.
      const described = describeApiError(caught);
      if (described.kind === 'rate_limited') {
        const retry = described.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS;
        setCooldown(retry);
        setServerError(t('rateLimited', { seconds: retry }));
      } else {
        setServerError(apiErrorMessage(caught));
      }
    }
  });

  const buttonLabel =
    cooldown > 0
      ? t('resendVerificationCountdown', { seconds: cooldown })
      : isSubmitting
        ? t('forgotPasswordSubmitting')
        : t('forgotPasswordSubmit');

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-neutral-50" />

      <div className="relative flex min-h-screen flex-col justify-center px-4 pt-16 py-8 sm:px-6 sm:pt-20 sm:py-12 lg:px-8">
        <div className="mb-6 sm:mx-auto sm:w-full sm:max-w-md sm:mb-8">
          <div className="text-center">
            <Link href="/" prefetch={false} className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center transition-transform group-hover:scale-105 sm:h-20">
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
                {t('forgotPasswordTitle')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('forgotPasswordDescription')}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              {success ? (
                <output
                  aria-live="polite"
                  className="flex flex-col items-center gap-4 py-4 text-center"
                >
                  <HiOutlineCheckCircle className="size-10 text-emerald-500" aria-hidden="true" />
                  <p className="text-sm text-neutral-700">{t('forgotPasswordSent')}</p>
                  <Link
                    href="/login"
                    className="font-semibold text-brand-trust transition-colors hover:text-brand-trust-hover"
                  >
                    {t('backToLogin')}
                  </Link>
                </output>
              ) : (
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
                    className="w-full bg-brand-trust text-white hover:bg-brand-trust-hover shadow-sm border-0"
                  >
                    {buttonLabel}
                  </Button>

                  <div className="text-center">
                    <Link
                      href="/login"
                      className="text-sm font-medium text-brand-trust hover:text-brand-trust-hover"
                    >
                      {t('backToLogin')}
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
