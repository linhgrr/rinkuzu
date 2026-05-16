'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineEye,
  HiOutlineEyeOff,
} from '@/components/icons';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { fetchApiResponse } from '@/lib/api/client';
import { passwordSchema } from '@/lib/validation/auth';
import { usePasswordStrength } from '@/lib/validation/usePasswordStrength';

const formSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'passwordsDoNotMatch',
  });

type FormValues = z.infer<typeof formSchema>;

function ResetPasswordContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(
    !token ? t('resetPasswordInvalidToken') : null,
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirm: '' },
  });

  const password = watch('password');
  const strength = usePasswordStrength(password);

  useEffect(() => {
    if (!token) setServerError(t('resetPasswordInvalidToken'));
  }, [token, t]);

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return;
    setServerError(null);
    try {
      const response = await fetchApiResponse<unknown, { message?: string }>(
        '/api/auth/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: values.password }),
        },
      );
      setSuccess(response.meta?.message ?? t('resetPasswordSuccess'));
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : t('resetPasswordInvalidToken'));
    }
  });

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
                {t('resetPasswordTitle')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('resetPasswordDescription')}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              {success ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-center gap-4 py-4 text-center"
                >
                  <HiOutlineCheckCircle className="size-10 text-emerald-500" aria-hidden="true" />
                  <p className="text-sm text-neutral-700">{success}</p>
                  <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700">
                    {t('backToLogin')}
                  </Link>
                </div>
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

                  <fieldset
                    disabled={isSubmitting || !token}
                    className="space-y-5 disabled:opacity-60"
                  >
                    <div>
                      <div className="relative">
                        <Input
                          label={t('password')}
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          placeholder={t('enterPassword')}
                          icon={<HiOutlineLockClosed className="size-5" />}
                          aria-invalid={errors.password ? true : undefined}
                          {...register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-pressed={showPassword}
                          aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                          className="absolute inset-y-0 right-3 my-auto flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-600"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <HiOutlineEyeOff className="size-5" aria-hidden="true" />
                          ) : (
                            <HiOutlineEye className="size-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1.5 text-xs text-red-600">{t('passwordMinLengthError')}</p>
                      )}
                      {password && <PasswordStrengthMeter score={strength} />}
                    </div>

                    <div>
                      <Input
                        label={t('confirmPassword')}
                        id="confirm"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        placeholder={t('confirmYourPassword')}
                        icon={<HiOutlineLockClosed className="size-5" />}
                        aria-invalid={errors.confirm ? true : undefined}
                        {...register('confirm')}
                      />
                      {errors.confirm && (
                        <p className="mt-1.5 text-xs text-red-600">{t('passwordsDoNotMatch')}</p>
                      )}
                    </div>
                  </fieldset>

                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting || !isValid || !token}
                    aria-busy={isSubmitting}
                    size="lg"
                    className="w-full bg-teal-600 text-white hover:bg-teal-700 shadow-sm border-0"
                  >
                    {isSubmitting ? t('resetPasswordSubmitting') : t('resetPasswordSubmit')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordClient() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
