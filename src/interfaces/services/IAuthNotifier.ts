export interface IAuthNotifier {
  sendVerificationEmail(email: string, rawToken: string): Promise<void>;
  sendPasswordResetEmail(email: string, rawToken: string): Promise<void>;
  sendPasswordChangedEmail(email: string): Promise<void>;
}
