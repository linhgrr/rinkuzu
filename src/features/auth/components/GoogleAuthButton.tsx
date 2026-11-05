'use client';

import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { GoogleLogo } from '@/features/auth/components/GoogleLogo';

interface GoogleAuthButtonProps {
  callbackUrl: string;
  disabled?: boolean;
  onBeforeSignIn?: () => void;
  /** Overrides "Continue with Google", e.g. the guest result's "Save with Google" (RIN-912). */
  label?: string;
  /** Id of the text that explains why to sign in, read after the label. */
  describedBy?: string;
}

/** Google sign-in button + "or continue with email" divider, shared by login & register. */
export function GoogleAuthButton({
  callbackUrl,
  disabled,
  onBeforeSignIn,
  label,
  describedBy,
}: GoogleAuthButtonProps) {
  const t = useTranslations('auth');
  const buttonLabel = label ?? t('continueWithGoogle');

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          onBeforeSignIn?.();
          void signIn('google', { callbackUrl });
        }}
        disabled={disabled}
        aria-label={buttonLabel}
        aria-describedby={describedBy}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink shadow-xs transition-colors hover:bg-surface-warm disabled:opacity-60"
      >
        <GoogleLogo />
        {buttonLabel}
      </button>
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
