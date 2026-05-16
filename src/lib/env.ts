import 'server-only';
import { z } from 'zod';

const isProd = process.env['NODE_ENV'] === 'production';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL').optional(),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 chars')
    .refine((v) => v !== 'replace-me', 'NEXTAUTH_SECRET must be changed from the default'),

  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),

  INTERNAL_SERVICE_TOKEN: z.string().optional(),

  ADAPTIVE_PROXY_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().optional(),
  SESSION_UPDATE_AGE_SECONDS: z.coerce.number().int().positive().optional(),

  AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(15),

  MAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  PAYOS_CLIENT_ID: z.string().optional(),
  PAYOS_API_KEY: z.string().optional(),
  PAYOS_CHECKSUM_KEY: z.string().optional(),
  SUBSCRIPTION_CRON_SECRET: z.string().optional(),

  IMGBB_API_KEY: z.string().optional(),
});

const productionRefinements = baseSchema.superRefine((data, ctx) => {
  if (
    (data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET) ||
    (!data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GOOGLE_CLIENT_ID'],
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set, or both omitted',
    });
  }

  if (data.NODE_ENV !== 'production') return;

  if (!data.INTERNAL_SERVICE_TOKEN || data.INTERNAL_SERVICE_TOKEN.length < 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['INTERNAL_SERVICE_TOKEN'],
      message: 'INTERNAL_SERVICE_TOKEN must be set (≥16 chars) in production',
    });
  }
  if (!data.NEXTAUTH_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['NEXTAUTH_URL'],
      message: 'NEXTAUTH_URL is required in production',
    });
  }
  if (!data.MAIL_FROM || !data.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY and MAIL_FROM are required in production',
    });
  }
});

export type Env = z.infer<typeof baseSchema>;

let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) return cached;

  const parsed = productionRefinements.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    const header = `Invalid environment configuration${isProd ? ' (production)' : ''}:`;
    throw new Error(`${header}\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

export const env = loadEnv();

export function getEnv(): Env {
  return loadEnv();
}
