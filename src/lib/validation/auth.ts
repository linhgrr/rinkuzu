import { z } from 'zod';
import { locales } from '@/i18n/config';
import { canonicalizeEmail, EMAIL_MAX_LENGTH } from '@/shared/email/canonical-email';
import { guestClaimTokenSchema } from '@/lib/validation/guest-claim-token';

/** The browser keeps at most 10 guest claims (features/quiz/lib/guest-claims). */
const REGISTER_GUEST_CLAIM_MAX_TOKENS = 10;

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function scorePassword(password: string): PasswordStrength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4) as PasswordStrength;
}

export const emailSchema = z
  .string()
  .transform(canonicalizeEmail)
  .pipe(
    z
      .string()
      .max(EMAIL_MAX_LENGTH, `Email must be at most ${EMAIL_MAX_LENGTH} characters`)
      .email('Invalid email address'),
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(50, 'Display name must be at most 50 characters');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
  // Where to return after sign-in; sanitised again where the email link is built.
  callbackUrl: z.string().max(512).optional(),
  // Guest results to attach when the email is verified, in any browser (RIN-1310).
  guestClaimTokens: z.array(guestClaimTokenSchema).max(REGISTER_GUEST_CLAIM_MAX_TOKENS).optional(),
  // UI locale of the signup page (RIN-1263). An unknown value is dropped, never a 400.
  locale: z.enum(locales).optional().catch(undefined),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(32).max(128),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
