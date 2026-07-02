import { hashPassword, type PasswordVerificationResult } from '@/lib/password';

export interface SuccessfulLoginPasswordUpdate {
  password?: string;
}

export async function buildSuccessfulLoginPasswordUpdate(
  plaintextPassword: string,
  verification: PasswordVerificationResult,
): Promise<SuccessfulLoginPasswordUpdate> {
  if (!verification.valid || !verification.needsRehash) {
    return {};
  }

  return {
    password: await hashPassword(plaintextPassword),
  };
}
