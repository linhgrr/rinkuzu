import type { IAuthNotifier, VerificationEmailOptions } from '@/interfaces/services/IAuthNotifier';
import {
  buildPasswordChangedMessage,
  buildPasswordResetMessage,
  buildVerifyEmailMessage,
  sendTransactionalMail,
} from '@/lib/mail';

export class AuthMailNotifier implements IAuthNotifier {
  async sendVerificationEmail(
    email: string,
    rawToken: string,
    options: VerificationEmailOptions = {},
  ): Promise<void> {
    await sendTransactionalMail(await buildVerifyEmailMessage(email, rawToken, options));
  }

  async sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
    await sendTransactionalMail(await buildPasswordResetMessage(email, rawToken));
  }

  async sendPasswordChangedEmail(email: string): Promise<void> {
    await sendTransactionalMail(await buildPasswordChangedMessage(email));
  }
}
