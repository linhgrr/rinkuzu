'use client';

import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';

import { GoogleLogo } from '@/components/auth/GoogleLogo';
import { authenticateGoogle } from '@/features/auth/actions';

interface GoogleAuthButtonProps {
  redirectTo: string;
  locale: string;
  disabled?: boolean;
}

function GoogleSubmitButton({ disabled }: Pick<GoogleAuthButtonProps, 'disabled'>) {
  const t = useTranslations('auth');
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={t('continueWithGoogle')}
      aria-busy={pending}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-surface-warm disabled:opacity-60"
    >
      <GoogleLogo />
      {t('continueWithGoogle')}
    </button>
  );
}

/** Google sign-in button + "or continue with email" divider, shared by login & register. */
export function GoogleAuthButton({ redirectTo, locale, disabled }: GoogleAuthButtonProps) {
  const t = useTranslations('auth');

  return (
    <div className="space-y-4">
      <form action={authenticateGoogle}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="locale" value={locale} />
        <GoogleSubmitButton disabled={disabled} />
      </form>
      <div className="relative !my-6 flex items-center">
        <div className="flex-grow border-t border-line" aria-hidden="true" />
        <span className="mx-3 text-xs uppercase tracking-wide text-ink-muted">
          {t('orContinueWithEmail')}
        </span>
        <div className="flex-grow border-t border-line" aria-hidden="true" />
      </div>
    </div>
  );
}
