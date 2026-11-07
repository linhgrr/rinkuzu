'use client';

import type { RefObject } from 'react';
import {
  HiOutlineExternalLink,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineInformationCircle,
  HiOutlineLockClosed,
} from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PASSWORD_MIN_LENGTH } from '@/lib/validation/auth';

export const PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;
export type PasswordField = (typeof PASSWORD_FIELDS)[number];
/** Translation keys of the `profile` namespace, one per field that failed. */
export type PasswordFieldErrors = Partial<Record<PasswordField, string>>;
export type PasswordValues = Record<PasswordField, string>;

const GOOGLE_ACCOUNT_SECURITY_URL = 'https://myaccount.google.com/security';

type Translate = (key: string) => string;

/** Every check the client can make before calling the server, in field order. */
export function validatePasswordChange(values: PasswordValues): PasswordFieldErrors {
  return {
    ...(values.currentPassword ? {} : { currentPassword: 'currentPasswordRequired' }),
    ...(values.newPassword.length < PASSWORD_MIN_LENGTH
      ? { newPassword: 'passwordMinLength' }
      : {}),
    ...(values.confirmPassword === values.newPassword
      ? {}
      : { confirmPassword: 'passwordsDoNotMatch' }),
  };
}

export function firstInvalidPasswordField(errors: PasswordFieldErrors): PasswordField | undefined {
  return PASSWORD_FIELDS.find((field) => errors[field] !== undefined);
}

/** Submitted (or server) errors win; otherwise warn while typing, as before. */
function visibleErrors(values: PasswordValues, errors: PasswordFieldErrors): PasswordFieldErrors {
  const tooShort = values.newPassword.length > 0 && values.newPassword.length < PASSWORD_MIN_LENGTH;
  const mismatch =
    values.confirmPassword.length > 0 && values.confirmPassword !== values.newPassword;
  const newPassword = errors.newPassword ?? (tooShort ? 'passwordMinLength' : undefined);
  const confirmPassword = errors.confirmPassword ?? (mismatch ? 'passwordsDoNotMatch' : undefined);
  return {
    ...(errors.currentPassword === undefined ? {} : { currentPassword: errors.currentPassword }),
    ...(newPassword === undefined ? {} : { newPassword }),
    ...(confirmPassword === undefined ? {} : { confirmPassword }),
  };
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-neutral-100 px-6 py-5">
      <div className="flex items-center gap-2">
        <HiOutlineLockClosed className="size-5 text-brand-trust" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      </div>
    </div>
  );
}

/** A Google-only account has no password here, so it gets no password inputs. */
export function GooglePasswordCard({ t }: { t: Translate }) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title={t('passwordSectionTitle')} />
      <div className="flex items-start gap-3 p-6">
        <HiOutlineInformationCircle
          className="mt-0.5 size-5 shrink-0 text-brand-trust"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <p className="text-sm text-neutral-700">{t('googlePasswordInfo')}</p>
          <a
            href={GOOGLE_ACCOUNT_SECURITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-trust hover:underline"
          >
            {t('googlePasswordLink')}
            <HiOutlineExternalLink className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </Card>
  );
}

interface PasswordSectionProps {
  errors: PasswordFieldErrors;
  fieldRefs: Record<PasswordField, RefObject<HTMLInputElement | null>>;
  onFieldChange: (field: PasswordField, value: string) => void;
  onSavePassword: () => void;
  onTogglePasswordVisibility: () => void;
  savingPassword: boolean;
  showNewPassword: boolean;
  t: Translate;
  values: PasswordValues;
}

export function PasswordSection({
  errors,
  fieldRefs,
  onFieldChange,
  onSavePassword,
  onTogglePasswordVisibility,
  savingPassword,
  showNewPassword,
  t,
  values,
}: PasswordSectionProps) {
  const shown = visibleErrors(values, errors);
  const errorText = (field: PasswordField) => {
    const key = shown[field];
    return key === undefined ? {} : { error: t(key) };
  };

  return (
    <Card className="overflow-hidden">
      <SectionHeader title={t('changePassword')} />
      <form
        noValidate
        className="space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSavePassword();
        }}
      >
        <Input
          ref={fieldRefs.currentPassword}
          label={t('currentPassword')}
          type="password"
          value={values.currentPassword}
          onChange={(event) => onFieldChange('currentPassword', event.target.value)}
          placeholder={t('currentPasswordPlaceholder')}
          autoComplete="current-password"
          icon={<HiOutlineLockClosed className="size-full" />}
          iconPosition="left"
          {...errorText('currentPassword')}
        />

        <Input
          ref={fieldRefs.newPassword}
          label={t('newPassword')}
          type={showNewPassword ? 'text' : 'password'}
          value={values.newPassword}
          onChange={(event) => onFieldChange('newPassword', event.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          autoComplete="new-password"
          icon={<HiOutlineLockClosed className="size-full" />}
          hint={t('passwordMinLengthHint')}
          {...errorText('newPassword')}
        />
        <button
          type="button"
          onClick={onTogglePasswordVisibility}
          className="-mt-2 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700"
        >
          {showNewPassword ? (
            <HiOutlineEyeOff className="size-3.5" aria-hidden="true" />
          ) : (
            <HiOutlineEye className="size-3.5" aria-hidden="true" />
          )}
          {showNewPassword ? t('hidePassword') : t('showPassword')}
        </button>

        <Input
          ref={fieldRefs.confirmPassword}
          label={t('confirmNewPassword')}
          type="password"
          value={values.confirmPassword}
          onChange={(event) => onFieldChange('confirmPassword', event.target.value)}
          placeholder={t('confirmNewPasswordPlaceholder')}
          autoComplete="new-password"
          icon={<HiOutlineLockClosed className="size-full" />}
          {...errorText('confirmPassword')}
        />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? t('saving') : t('updatePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
