import type {
  EmailResponseDto,
  PasswordResetRequestResultDto,
  PasswordResetResultDto,
  RegisterAccountDto,
  RegisterAccountResponseDto,
  VerificationResendResultDto,
} from '@/dtos/auth';
import type { AuthRequestContext } from '@/entities/AuthAccount';
import type { IAuthAccountRepository } from '@/interfaces/repositories/IAuthAccountRepository';
import type { IAuthAccountService } from '@/interfaces/services/IAuthAccountService';
import type { AuthAuditIdentity, IAuthAudit } from '@/interfaces/services/IAuthAudit';
import type { IAuthNotifier } from '@/interfaces/services/IAuthNotifier';
import type { IDeferredTaskScheduler } from '@/interfaces/services/IDeferredTaskScheduler';
import type { ServiceResult } from '@/interfaces/services/types';
import { createSecureToken, hashToken, wasIssuedRecently } from '@/lib/auth-tokens';
import { hashPassword } from '@/lib/password';
import { logger } from '@/lib/logger';
import { AuthAccountDtoMapper } from '@/mappers/auth/AuthAccountDtoMapper';

const VERIFICATION_TTL_MS = 24 * 60 * 60_000;
const VERIFICATION_MIN_INTERVAL_MS = 60_000;
const RESET_TOKEN_TTL_MS = 30 * 60_000;
const RESET_MIN_INTERVAL_MS = 60_000;

export class AuthAccountService implements IAuthAccountService {
  constructor(
    private readonly repository: IAuthAccountRepository,
    private readonly notifier: IAuthNotifier,
    private readonly audit: IAuthAudit,
    private readonly scheduler: IDeferredTaskScheduler,
  ) {}

  async register(
    input: RegisterAccountDto,
    context: AuthRequestContext,
  ): Promise<ServiceResult<RegisterAccountResponseDto>> {
    try {
      const existing = await this.repository.findByEmail(input.email);
      if (existing) {
        this.scheduleAudit('register', context, {
          email: input.email,
          metadata: { reason: 'duplicate_email' },
        });
        return { success: true, data: AuthAccountDtoMapper.toRegisterResponse(input.email) };
      }

      const passwordHash = await hashPassword(input.password);
      const verification = createSecureToken();
      const account = await this.repository.createPending({
        email: input.email,
        passwordHash,
        ...(input.displayName ? { displayName: input.displayName } : {}),
        verificationTokenHash: verification.hash,
        verificationExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
      });
      if (!account) {
        this.scheduleAudit('register', context, {
          email: input.email,
          metadata: { reason: 'duplicate_email' },
        });
        return { success: true, data: AuthAccountDtoMapper.toRegisterResponse(input.email) };
      }

      this.scheduler.schedule(async () => {
        await Promise.all([
          this.notifier.sendVerificationEmail(account.email, verification.raw),
          this.audit.record({
            event: 'register',
            userId: account.id,
            email: account.email,
            ...context,
          }),
          this.audit.record({
            event: 'email_verification_sent',
            userId: account.id,
            email: account.email,
            ...context,
          }),
        ]);
      });
      return {
        success: true,
        data: AuthAccountDtoMapper.toRegisterResponse(account.email),
      };
    } catch (error) {
      logger.error({ error }, 'Registration error');
      return { success: false, error: 'Internal server error', statusCode: 500 };
    }
  }

  async verifyEmail(
    rawToken: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<EmailResponseDto>> {
    try {
      const account = await this.repository.verifyEmail(hashToken(rawToken), new Date());
      if (!account) {
        return {
          success: false,
          error: 'Verification link is invalid or has expired',
          statusCode: 400,
        };
      }
      this.scheduleAudit('email_verified', context, {
        userId: account.id,
        email: account.email,
      });
      return { success: true, data: AuthAccountDtoMapper.toEmailResponse(account.email) };
    } catch (error) {
      logger.error({ error }, 'Verify-email error');
      return { success: false, error: 'Failed to verify email', statusCode: 500 };
    }
  }

  async requestPasswordReset(
    email: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<PasswordResetRequestResultDto>> {
    try {
      const account = await this.repository.findByEmail(email);
      if (!account || !account.passwordHash) {
        this.scheduleAudit('password_reset_requested', context, {
          email,
          metadata: { reason: 'unknown_user_or_oauth' },
        });
        return { success: true, data: AuthAccountDtoMapper.toPasswordResetRequestResult(email) };
      }
      if (
        account.passwordResetTokenHash &&
        wasIssuedRecently(account.passwordResetExpires, RESET_TOKEN_TTL_MS, RESET_MIN_INTERVAL_MS)
      ) {
        return {
          success: true,
          data: AuthAccountDtoMapper.toPasswordResetRequestResult(account.email),
        };
      }

      const token = createSecureToken();
      const issued = await this.repository.issuePasswordResetToken(
        account.email,
        token.hash,
        new Date(Date.now() + RESET_TOKEN_TTL_MS),
      );
      if (issued) {
        this.scheduler.schedule(async () => {
          await Promise.all([
            this.notifier.sendPasswordResetEmail(account.email, token.raw),
            this.audit.record({
              event: 'password_reset_requested',
              userId: account.id,
              email: account.email,
              ...context,
            }),
          ]);
        });
      }
      return {
        success: true,
        data: AuthAccountDtoMapper.toPasswordResetRequestResult(account.email),
      };
    } catch (error) {
      logger.error({ error }, 'Forgot-password error');
      return { success: true, data: AuthAccountDtoMapper.toPasswordResetRequestResult(email) };
    }
  }

  async resendVerification(
    email: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<VerificationResendResultDto>> {
    try {
      const account = await this.repository.findByEmail(email);
      if (!account || account.emailVerified || !account.passwordHash) {
        this.scheduleAudit('email_verification_sent', context, {
          email,
          metadata: { reason: account ? 'already_verified_or_oauth' : 'unknown_user' },
        });
        return { success: true, data: AuthAccountDtoMapper.toVerificationResendResult(email) };
      }
      if (
        account.emailVerificationTokenHash &&
        wasIssuedRecently(
          account.emailVerificationExpires,
          VERIFICATION_TTL_MS,
          VERIFICATION_MIN_INTERVAL_MS,
        )
      ) {
        return {
          success: true,
          data: AuthAccountDtoMapper.toVerificationResendResult(account.email),
        };
      }

      const token = createSecureToken();
      const issued = await this.repository.issueVerificationToken(
        account.email,
        token.hash,
        new Date(Date.now() + VERIFICATION_TTL_MS),
      );
      if (issued) {
        this.scheduler.schedule(async () => {
          await Promise.all([
            this.notifier.sendVerificationEmail(account.email, token.raw),
            this.audit.record({
              event: 'email_verification_sent',
              userId: account.id,
              email: account.email,
              ...context,
            }),
          ]);
        });
      }
      return {
        success: true,
        data: AuthAccountDtoMapper.toVerificationResendResult(account.email),
      };
    } catch (error) {
      logger.error({ error }, 'Resend-verification error');
      return { success: true, data: AuthAccountDtoMapper.toVerificationResendResult(email) };
    }
  }

  async resetPassword(
    rawToken: string,
    password: string,
    context: AuthRequestContext,
  ): Promise<ServiceResult<PasswordResetResultDto>> {
    try {
      const tokenHash = hashToken(rawToken);
      const candidate = await this.repository.findValidPasswordResetAccount(tokenHash, new Date());
      if (!candidate) {
        return {
          success: false,
          error: 'Reset link is invalid or has expired',
          statusCode: 400,
        };
      }
      const account = await this.repository.resetPassword(
        candidate.id,
        tokenHash,
        await hashPassword(password),
        new Date(),
      );
      if (!account) {
        return {
          success: false,
          error: 'Reset link is invalid or has expired',
          statusCode: 400,
        };
      }

      this.scheduler.schedule(async () => {
        await Promise.all([
          this.notifier.sendPasswordChangedEmail(account.email),
          this.audit.record({
            event: 'password_reset_completed',
            userId: account.id,
            email: account.email,
            ...context,
          }),
        ]);
      });
      return { success: true, data: AuthAccountDtoMapper.toPasswordResetResult(account.email) };
    } catch (error) {
      logger.error({ error }, 'Reset-password error');
      return { success: false, error: 'Failed to reset password', statusCode: 500 };
    }
  }

  private scheduleAudit(
    event: Parameters<IAuthAudit['record']>[0]['event'],
    context: AuthRequestContext,
    identity: AuthAuditIdentity,
  ): void {
    this.scheduler.schedule(() => this.audit.record({ event, ...identity, ...context }));
  }
}
