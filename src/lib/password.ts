import * as argon2 from 'argon2';

// Password hashing functions (SERVER-SIDE ONLY)
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password);
  } catch (error) {
    throw new Error('Failed to hash password');
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
} 