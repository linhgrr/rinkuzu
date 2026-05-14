import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key-change-in-production';
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
