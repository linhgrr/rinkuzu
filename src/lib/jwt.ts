import 'server-only';
import jwt, { SignOptions } from 'jsonwebtoken';

function requireJwtSecret(): string {
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new Error('JWT_SECRET required');
  }
  return jwtSecret;
}
const JWT_SECRET = requireJwtSecret();
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export function signToken(payload: JWTPayload): string {
  const signOptions: SignOptions = {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  };

  return jwt.sign(payload, JWT_SECRET, signOptions);
}
