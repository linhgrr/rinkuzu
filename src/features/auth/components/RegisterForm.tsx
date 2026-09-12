'use client';

import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { registerAccount } from '@/features/auth/api/auth-api';
import { ApiResponseError } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiCheck,
  HiOutlineEye,
  HiOutlineEyeOff,
} from 'react-icons/hi';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter';
import { emailSchema, passwordSchema } from '@/lib/validation/auth';
import { usePasswordStrength } from '@/lib/validation/usePasswordStrength';
import { toBrowserPath } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

interface RegisterFormProps {
  locale: string;
  googleEnabled?: boolean;
  onSwitchMode?: () => void;
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

const FIELD_ERROR_KEY: Record<keyof FormValues, string> = {
  email: 'invalidEmailFormat',
  password: 'passwordMinLengthError',
  confirmPassword: 'passwordsDoNotMatch',
  agreeTerms: 'mustAgreeTerms',
};

type PasswordCriterion = {
  id: string;
  label: string;
  met: boolean;
};

function RegisterSuccessState({ title, message }: { title: string; message: string }) {
  return (
    <div className="animate-fadeInUp text-center">
      <HiOutlineCheckCircle className="mx-auto size-12 text-green-500" aria-hidden="true" />
      <h2 className="mt-4 text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-body text-ink-muted">{message}</p>
    </div>
  );
}

function PasswordCriteriaCard({
  title,
  criteria,
}: {
  title: string;
  criteria: PasswordCriterion[];
}) {
  return (
    <div id="password-criteria" className="rounded-2xl border border-line bg-accent-soft/40 p-4">
      <h4 className="mb-2 text-sm font-semibold text-ink">{title}</h4>
      <ul className="space-y-1 text-xs text-ink-muted">
        {criteria.map((criterion) => (
          <li
            key={criterion.id}
            className={`flex items-center transition-colors ${
              criterion.met ? 'text-green-600' : 'text-ink-muted'
            }`}
          >
            <HiCheck
              className={`mr-2 size-3 ${criterion.met ? 'text-green-500' : 'text-neutral-warm-5'}`}
              strokeWidth={3}
            />
            {criterion.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegisterForm({ locale, googleEnabled = false, onSwitchMode }: RegisterFormProps) {
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
    formState: { errors, isSubmitting, isValid },
  } = form;

  const password = useWatch({ control: form.control, name: 'password' }) ?? '';
  const passwordStrength = usePasswordStrength(password);

  const passwordCriteria = [
    { id: 'min', label: t('passwordMinLength'), met: password.length >= 8 },
    { id: 'mix', label: t('passwordMixHint'), met: passwordStrength >= 3 },
    { id: 'unique', label: t('passwordUnique'), met: passwordStrength >= 2 },
  ] satisfies PasswordCriterion[];

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    captureAnalyticsEvent('signup_started', { method: 'credentials', locale });
    try {
      const result = await registerAccount({ email: values.email, password: values.password });
      setServerSuccess(result.message ?? t('accountCreatedSuccess'));
    } catch (error) {
      setServerError(
        error instanceof ApiResponseError && error.code === 'registration_method_mismatch'
          ? t('registrationMethodMismatch')
          : error instanceof Error
            ? error.message
            : t('registrationFailed'),
      );
    }
  });

  if (serverSuccess) {
    return <RegisterSuccessState title={t('checkEmailTitle')} message={serverSuccess} />;
  }

  return (
    <div>
      {googleEnabled && (
        <GoogleAuthButton
          callbackUrl={toBrowserPath(ROUTES.DASHBOARD, locale)}
          disabled={isSubmitting}
        />
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

        <fieldset disabled={isSubmitting} className="space-y-6 disabled:opacity-60">
          <div>
            <Input
              label={t('emailAddress')}
              id="register-email"
              type="email"
              inputSize="lg"
              className="rounded-full"
              autoComplete="email"
              required
              placeholder={t('enterEmail')}
              icon={<HiOutlineMail className="size-5" />}
              aria-invalid={errors.email ? true : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600">{t(FIELD_ERROR_KEY.email)}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Input
                label={t('password')}
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                inputSize="lg"
                className="rounded-full pr-12"
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
                className="absolute bottom-2 right-4 flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <HiOutlineEyeOff className="size-5" aria-hidden="true" />
                ) : (
                  <HiOutlineEye className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {password && <PasswordStrengthMeter id="password-strength" score={passwordStrength} />}
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-600">{t(FIELD_ERROR_KEY.password)}</p>
            )}
          </div>

          <div>
            <Input
              label={t('confirmPassword')}
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              inputSize="lg"
              className="rounded-full"
              autoComplete="new-password"
              required
              placeholder={t('confirmYourPassword')}
              icon={<HiCheck className="size-5" />}
              aria-invalid={errors.confirmPassword ? true : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-red-600">{t(FIELD_ERROR_KEY.confirmPassword)}</p>
            )}
          </div>
        </fieldset>

        <PasswordCriteriaCard title={t('passwordRequirements')} criteria={passwordCriteria} />

        <label className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-line text-brand-trust focus:ring-brand-trust"
            {...register('agreeTerms')}
          />
          <span>
            {t('agreeTermsCheckbox')}{' '}
            <Link
              href="/terms"
              className="font-medium text-brand-trust hover:text-brand-trust-hover"
              target="_blank"
              rel="noopener"
            >
              Terms
            </Link>{' '}
            ·{' '}
            <Link
              href="/privacy"
              className="font-medium text-brand-trust hover:text-brand-trust-hover"
              target="_blank"
              rel="noopener"
            >
              Privacy
            </Link>
          </span>
        </label>
        {errors.agreeTerms && <p className="-mt-3 text-xs text-red-600">{t('mustAgreeTerms')}</p>}

        <div className="pt-2">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting || !isValid}
            aria-busy={isSubmitting}
            size="lg"
            className="w-full rounded-full border-0 bg-brand-trust text-white shadow-sm hover:bg-brand-trust-hover"
          >
            {isSubmitting ? t('creatingAccount') : t('createAccountButton')}
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-line pt-6">
        <div className="text-center">
          <p className="text-sm text-ink-muted">
            {t('alreadyHaveAccount')}{' '}
            {onSwitchMode ? (
              <button
                type="button"
                onClick={onSwitchMode}
                className="font-semibold text-brand-trust transition-colors hover:text-brand-trust-hover"
              >
                {t('signIn')}
              </button>
            ) : (
              <Link
                href="/login"
                className="font-semibold text-brand-trust transition-colors hover:text-brand-trust-hover"
              >
                {t('signIn')}
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
