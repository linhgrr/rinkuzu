'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { fetchApiResponse } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiCheck,
  HiOutlineEye,
  HiOutlineEyeOff,
} from '@/components/icons';
import { GoogleLogo } from '@/components/auth/GoogleLogo';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { emailSchema, passwordSchema } from '@/lib/validation/auth';
import { usePasswordStrength } from '@/lib/validation/usePasswordStrength';

interface RegisterPageClientProps {
  googleEnabled?: boolean;
}

const formSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    agreeTerms: z.boolean().refine((v) => v === true, { message: 'mustAgreeTerms' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsDoNotMatch',
  });

type FormValues = z.infer<typeof formSchema>;

export function RegisterPageClient({ googleEnabled = false }: RegisterPageClientProps = {}) {
  const t = useTranslations('auth');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', confirmPassword: '', agreeTerms: false },
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = form;

  const password = watch('password');
  const passwordStrength = usePasswordStrength(password);

  const passwordCriteria = [
    { id: 'min', label: t('passwordMinLength'), met: password.length >= 8 },
    { id: 'mix', label: t('passwordMixHint'), met: passwordStrength >= 3 },
    { id: 'unique', label: t('passwordUnique'), met: passwordStrength >= 2 },
  ];

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await fetchApiResponse<
        { id?: string; email: string; role?: string },
        { message?: string }
      >('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      setServerSuccess(response.meta?.message ?? t('accountCreatedSuccess'));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t('registrationFailed'));
    }
  });

  if (serverSuccess) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-neutral-50" />
        <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
          <Card className="w-full border-0 bg-white p-8 text-center shadow-lg shadow-neutral-200/60">
            <HiOutlineCheckCircle className="mx-auto size-12 text-emerald-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold text-neutral-900">{t('checkEmailTitle')}</h1>
            <p className="mt-2 text-neutral-600">{serverSuccess}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const fieldErrorKey = (name: keyof FormValues): string | null => {
    const e = errors[name];
    if (!e) return null;
    if (name === 'email') return 'invalidEmailFormat';
    if (name === 'password') return 'passwordMinLengthError';
    if (name === 'confirmPassword') return 'passwordsDoNotMatch';
    if (name === 'agreeTerms') return 'mustAgreeTerms';
    return null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-neutral-50" />

      <div className="relative flex min-h-screen flex-col justify-center pt-20 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <Link href="/" className="group inline-flex items-center">
              <div className="flex h-16 items-center justify-center transition-transform group-hover:scale-105 sm:h-20">
                <Image
                  src="/images/auth_logo.png"
                  alt="RinKuzu Logo"
                  width={80}
                  height={80}
                  className="h-16 w-auto object-contain sm:h-20"
                  style={{ width: 'auto' }}
                />
              </div>
            </Link>
          </div>

          <div className="mt-8 text-center animate-fadeInUp">
            <h1 className="mb-3 text-4xl font-semibold text-neutral-900">{t('joinRinKuzu')}</h1>
            <p className="text-lg text-neutral-600">{t('createAccountMessage')}</p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card
            className="animate-fadeInUp border-0 bg-white shadow-lg shadow-neutral-200/60"
            style={{ animationDelay: '200ms' }}
          >
            <CardHeader className="pb-4 text-center">
              <CardTitle size="lg" className="text-neutral-900">
                {t('createAccount')}
              </CardTitle>
              <CardDescription className="text-base">{t('enterDetails')}</CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              {googleEnabled && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                    disabled={isSubmitting}
                    aria-label={t('continueWithGoogle')}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-60"
                  >
                    <GoogleLogo />
                    {t('continueWithGoogle')}
                  </button>
                  <div className="relative my-6 flex items-center">
                    <div className="flex-grow border-t border-neutral-200" aria-hidden="true" />
                    <span className="mx-3 text-xs uppercase tracking-wide text-neutral-400">
                      {t('orContinueWithEmail')}
                    </span>
                    <div className="flex-grow border-t border-neutral-200" aria-hidden="true" />
                  </div>
                </div>
              )}
              <form className="space-y-6" onSubmit={onSubmit} noValidate>
                {serverError && (
                  <Card
                    variant="bordered"
                    className="animate-fadeInUp border-red-200 bg-red-50 p-4"
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

                <fieldset disabled={isSubmitting} className="space-y-5 disabled:opacity-60">
                  <div>
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
                    {errors.email &&
                      (() => {
                        const errorKey = fieldErrorKey('email');
                        return errorKey ? (
                          <p className="mt-1.5 text-xs text-red-600">{t(errorKey)}</p>
                        ) : null;
                      })()}
                  </div>

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
                        aria-describedby={password ? 'password-strength' : 'password-criteria'}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                        className="absolute inset-y-0 right-3 my-auto flex size-9 items-center justify-center rounded-md text-neutral-400 transition-colors hover:text-neutral-600"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <HiOutlineEyeOff className="size-5" aria-hidden="true" />
                        ) : (
                          <HiOutlineEye className="size-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {password && (
                      <PasswordStrengthMeter id="password-strength" score={passwordStrength} />
                    )}
                    {errors.password &&
                      (() => {
                        const errorKey = fieldErrorKey('password');
                        return errorKey ? (
                          <p className="mt-1.5 text-xs text-red-600">{t(errorKey)}</p>
                        ) : null;
                      })()}
                  </div>

                  <div>
                    <Input
                      label={t('confirmPassword')}
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder={t('confirmYourPassword')}
                      icon={<HiCheck className="size-5" />}
                      aria-invalid={errors.confirmPassword ? true : undefined}
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword &&
                      (() => {
                        const errorKey = fieldErrorKey('confirmPassword');
                        return errorKey ? (
                          <p className="mt-1.5 text-xs text-red-600">{t(errorKey)}</p>
                        ) : null;
                      })()}
                  </div>
                </fieldset>

                <div
                  id="password-criteria"
                  className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"
                >
                  <h4 className="mb-2 text-sm font-semibold text-blue-900">
                    {t('passwordRequirements')}
                  </h4>
                  <ul className="space-y-1 text-xs text-blue-800">
                    {passwordCriteria.map((c) => (
                      <li
                        key={c.id}
                        className={`flex items-center transition-colors ${
                          c.met ? 'text-emerald-700' : 'text-blue-800'
                        }`}
                      >
                        <HiCheck
                          className={`mr-2 size-3 ${c.met ? 'text-emerald-600' : 'text-blue-400'}`}
                          strokeWidth={3}
                        />
                        {c.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <label className="flex items-start gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
                    {...register('agreeTerms')}
                  />
                  <span>
                    {t('agreeTermsCheckbox')}{' '}
                    <Link
                      href="/terms"
                      className="font-medium text-teal-600 hover:text-teal-700"
                      target="_blank"
                      rel="noopener"
                    >
                      Terms
                    </Link>{' '}
                    ·{' '}
                    <Link
                      href="/privacy"
                      className="font-medium text-teal-600 hover:text-teal-700"
                      target="_blank"
                      rel="noopener"
                    >
                      Privacy
                    </Link>
                  </span>
                </label>
                {errors.agreeTerms && (
                  <p className="-mt-3 text-xs text-red-600">{t('mustAgreeTerms')}</p>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting || !isValid}
                    aria-busy={isSubmitting}
                    size="lg"
                    className="w-full border-0 bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                  >
                    {isSubmitting ? t('creatingAccount') : t('createAccountButton')}
                  </Button>
                </div>
              </form>

              <div className="mt-8 border-t border-neutral-100 pt-6">
                <div className="text-center">
                  <p className="text-sm text-neutral-600">
                    {t('alreadyHaveAccount')}{' '}
                    <Link
                      href="/login"
                      className="font-semibold text-teal-600 transition-colors hover:text-teal-700"
                    >
                      {t('signIn')}
                    </Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
