export interface VerificationEmailOptions {
  /** Same-origin path the verify page forwards to sign-in (RIN-773). */
  callbackUrl?: string;
}

export interface IAuthNotifier {
  sendVerificationEmail(
    email: string,
    rawToken: string,
    options?: VerificationEmailOptions,
  ): Promise<void>;
  sendPasswordResetEmail(email: string, rawToken: string): Promise<void>;
  sendPasswordChangedEmail(email: string): Promise<void>;
}
