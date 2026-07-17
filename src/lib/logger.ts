import 'server-only';
import pino, { type Logger as PinoLogger } from 'pino';

import { env } from './env';

/**
 * Structured logger backed by pino.
 *
 * - JSON output in production (machine-ingestible by Datadog / ELK / Loki).
 * - Pretty-printed in dev when `pino-pretty` is available; otherwise plain JSON.
 * - Redacts known secret keys before serialising.
 *
 * Use `logger.child({ scope: 'subscription' })` to attach permanent context.
 */

const REDACT_PATHS: ReadonlyArray<string> = [
  'password',
  'pwd',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'checksumKey',
  'signature',
  // Wildcard-ish nested paths are handled by pino's own redact via splats.
  '*.password',
  '*.token',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.authorization',
];

function buildLogger(): PinoLogger {
  return pino({
    level: process.env['LOG_LEVEL'] ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
    base: {
      env: env.NODE_ENV,
    },
    redact: {
      paths: [...REDACT_PATHS],
      censor: '[redacted]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger: PinoLogger = buildLogger();
