import { resetPasswordSchema } from '@/lib/validation/auth';
import { getAuthAccountService } from '@/lib/auth-account-factory';
import { createAuthTokenActionRoute } from '@/app/api/auth/token-action-route';

const authAccountService = getAuthAccountService();

export const POST = createAuthTokenActionRoute({
  schema: resetPasswordSchema,
  rateLimitAction: 'reset_password_token_ip',
  rateLimitKey: (_input, context) => context.ip ?? 'unknown',
  execute: (input, context) =>
    authAccountService.resetPassword(input.token, input.password, context),
  successMessage: 'Password updated. Please sign in with your new password.',
});
