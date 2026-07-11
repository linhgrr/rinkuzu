'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineEye,
  HiOutlineEyeOff,
} from 'react-icons/hi';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';
import { resolveAuthCallback } from '@/lib/routing/auth-callback';

interface LoginFormProps {
  locale: string;
  googleEnabled?: boolean;
  onSwitchMode?: () => void;
}

type ErrorState = {
  message: string;
  code?: string;
};

function LoginFormContent({ locale, googleEnabled, onSwitchMode }: LoginFormProps) {
  const t = useTranslations('auth');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<ErrorState | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [navigationPending, setNavigationPending] = useState(false);
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  // Browser URL for NextAuth full-document redirects (locale-prefixed with always).
  const { browserUrl: callbackUrl } = resolveAuthCallback(get('callbackUrl'), locale);

  const startRetryCountdown = (seconds: number) => {
    setRetrySeconds(seconds);
  };

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const intervalId = setInterval(() => {
      setRetrySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [retrySeconds]);

  const onSubmit = handleSubmit(async (values) => {
    // isSubmitting / navigationPending already gate the button; no render-time ref lock.
    if (retrySeconds > 0 || navigationPending) return;
    setServerError(null);

    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        const code = result.error;
        if (code === 'account_locked') {
          startRetryCountdown(15 * 60);
          setServerError({ code, message: t('accountLocked') });
        } else if (code === 'email_not_verified') {
          setServerError({ code, message: t('emailNotVerified') });
        } else if (code === 'invalid_credentials' || code === 'CredentialsSignin') {
          setServerError({ code: 'invalid_credentials', message: t('invalidEmailPassword') });
        } else {
          setServerError({ code, message: t('loginFailed') });
        }
        return;
      }
      // Full page replace — deterministic, avoids SPA race with next-intl router.
      if (result?.ok && result.url) {
        setNavigationPending(true);
        window.location.replace(result.url);
        return;
      }
      setServerError({ code: 'unknown', message: t('loginFailed') });
    } catch (caught) {
      console.error('Login exception:', caught);
      setServerError({ code: 'network', message: t('loginError') });
    }
  });

  const submitPending = isSubmitting || navigationPending;
  const submitDisabled = submitPending || retrySeconds > 0;
  const lockoutCountdownLabel =
    retrySeconds > 0
      ? `${Math.floor(retrySeconds / 60)
          .toString()
          .padStart(2, '0')}:${(retrySeconds % 60).toString().padStart(2, '0')}`
      : '';
  const emailValue = useWatch({ control: form.control, name: 'email' }) ?? '';

  return (
    <div>
      {googleEnabled && <GoogleAuthButton callbackUrl={callbackUrl} disabled={submitPending} />}
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        {serverError && (
          <Card
            variant="bordered"
            className="border-red-200 bg-red-50 p-4 animate-fadeInUp"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start text-red-700">
              <HiOutlineExclamationCircle
                className="size-5 mr-2 mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-medium">{serverError.message}</p>
                {serverError.code === 'account_locked' && retrySeconds > 0 && (
                  <p className="mt-1 text-red-600">
                    {t('tryAgainIn')} <span className="font-mono">{lockoutCountdownLabel}</span>
                  </p>
                )}
                {serverError.code === 'email_not_verified' && (
                  <p className="mt-2">
                    <span>{t('emailNotVerifiedResendHint')} </span>
                    <Link
                      href={`/check-email?email=${encodeURIComponent(emailValue.trim().toLowerCase())}`}
                      className="font-semibold text-red-700 underline hover:text-red-800"
                    >
                      {t('resendVerificationInline')}
                    </Link>
                    <span>.</span>
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <fieldset disabled={submitPending} className="space-y-6 disabled:opacity-60">
          <div>
            <Input
              label={t('emailAddress')}
              id="email"
              type="email"
              inputSize="lg"
              className="rounded-full"
              autoComplete="email"
              required
              placeholder={t('enterEmail')}
              icon={<HiOutlineMail className="size-5" />}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" className="mt-1.5 text-xs text-red-600">
                {t('invalidEmailFormat')}
              </p>
            )}
          </div>

          <div>
            <div className="relative">
              <Input
                label={t('password')}
                id="password"
                type={showPassword ? 'text' : 'password'}
                inputSize="lg"
                className="rounded-full pr-12"
                autoComplete="current-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder={t('enterPassword')}
                icon={<HiOutlineLockClosed className="size-5" />}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                className="absolute bottom-2 right-4 flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-trust"
              >
                {showPassword ? (
                  <HiOutlineEyeOff className="size-5" aria-hidden="true" />
                ) : (
                  <HiOutlineEye className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="mt-1.5 text-xs text-red-600">
                {t('passwordRequired')}
              </p>
            )}
            <div className="mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-trust hover:text-brand-trust-hover"
              >
                {t('forgotPassword')}
              </Link>
            </div>
          </div>
        </fieldset>

        <div className="pt-2">
          <Button
            type="submit"
            loading={submitPending}
            disabled={submitDisabled}
            aria-busy={submitPending}
            size="lg"
            className="w-full rounded-full bg-brand-trust text-white hover:bg-brand-trust-hover shadow-sm border-0"
          >
            {submitPending ? t('signingIn') : t('signInButton')}
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <div className="text-center">
          <p className="text-sm text-ink-muted">
            {t('dontHaveAccount')}{' '}
            {onSwitchMode ? (
              <button
                type="button"
                onClick={onSwitchMode}
                className="font-semibold text-brand-trust transition-colors hover:text-brand-trust-hover"
              >
                {t('createAccount')}
              </button>
            ) : (
              <Link
                href="/register"
                className="font-semibold text-brand-trust hover:text-brand-trust-hover transition-colors"
              >
                {t('createAccount')}
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div>
      <div className="space-y-4 py-6" aria-hidden="true">
        <div className="h-12 rounded-full bg-surface-warm" />
        <div className="h-12 rounded-full bg-surface-warm" />
        <div className="h-12 rounded-full bg-surface-warm" />
      </div>
    </div>
  );
}

export function LoginForm({ locale, googleEnabled }: LoginFormProps) {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormContent locale={locale} googleEnabled={googleEnabled} />
    </Suspense>
  );
}
