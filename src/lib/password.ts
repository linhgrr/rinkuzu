import 'server-only';
import argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';

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

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (hash.startsWith('$argon2')) {
      return await argon2.verify(hash, password);
    }

    if (hash.startsWith('$2')) {
      return await bcrypt.compare(password, hash);
    }

    return false;
  } catch (error) {
    console.error('Password verification error (not a mismatch — unexpected failure):', error);
    return false;
  }
}
