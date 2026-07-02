import 'server-only';
import argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

export type PasswordHashAlgorithm = 'argon2id' | 'bcrypt' | 'unknown';

export interface PasswordVerificationResult {
  valid: boolean;
  algorithm: PasswordHashAlgorithm;
  needsRehash: boolean;
}

function detectPasswordHashAlgorithm(hash: string): PasswordHashAlgorithm {
  if (hash.startsWith('$argon2')) return 'argon2id';
  if (hash.startsWith('$2')) return 'bcrypt';
  return 'unknown';
}

// Password hashing functions (SERVER-SIDE ONLY)
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  } catch (_error) {
    throw new Error('Failed to hash password');
  }
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<PasswordVerificationResult> {
  try {
    const algorithm = detectPasswordHashAlgorithm(hash);

    if (algorithm === 'argon2id') {
      return {
        valid: await argon2.verify(hash, password),
        algorithm,
        needsRehash: false,
      };
    }

    if (algorithm === 'bcrypt') {
      const valid = await bcrypt.compare(password, hash);
      return {
        valid,
        algorithm,
        needsRehash: valid,
      };
    }

    return {
      valid: false,
      algorithm: 'unknown',
      needsRehash: false,
    };
  } catch (error) {
    logger.error({ error }, 'Password verification error (not a mismatch — unexpected failure)');
    return {
      valid: false,
      algorithm: detectPasswordHashAlgorithm(hash),
      needsRehash: false,
    };
  }
}
