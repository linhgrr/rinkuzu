import 'server-only';
import { z } from 'zod';
import { formatZodIssues } from '@/lib/validation/zod-issues';

const OBJECT_STORAGE_REGIONS = ['auto', 'wnam', 'enam', 'weur', 'eeur', 'apac', 'oc'] as const;

function readMongoDatabaseName(uri: string): string | null {
  const scheme = uri.startsWith('mongodb://')
    ? 'mongodb://'
    : uri.startsWith('mongodb+srv://')
      ? 'mongodb+srv://'
      : null;
  if (!scheme) return null;

  const authorityAndPath = uri.slice(scheme.length).split('?', 1)[0] ?? '';
  const pathStart = authorityAndPath.indexOf('/');
  if (pathStart < 0) return null;
  const encodedDatabaseName = authorityAndPath.slice(pathStart + 1);
  if (!encodedDatabaseName) return null;

  try {
    const databaseName = decodeURIComponent(encodedDatabaseName).trim();
    return databaseName.length > 0 ? databaseName : null;
  } catch {
    return null;
  }
}

/** Reject common default/placeholder secrets without a shared secret library. */
function isObviousSecretPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  if (/^(.)\1+$/.test(value)) return true;
  if (
    lower === 'replace-me' ||
    lower === 'changeme' ||
    lower === 'change-me' ||
    lower === 'secret' ||
    lower === 'password' ||
    lower === 'placeholder' ||
    lower.includes('replace-me') ||
    lower.includes('changeme') ||
    lower.includes('change-me') ||
    lower.includes('your-secret') ||
    lower.includes('your-token') ||
    lower.includes('placeholder') ||
    lower.includes('example-secret') ||
    lower.includes('example-token')
  ) {
    return true;
  }
  return false;
}

const internalServiceTokenSchema = z
  .string()
  .trim()
  .min(32, 'INTERNAL_SERVICE_TOKEN must be at least 32 chars')
  .refine(
    (value) => !isObviousSecretPlaceholder(value),
    'INTERNAL_SERVICE_TOKEN must not use a placeholder or default value',
  );

const subscriptionCronSecretSchema = z
  .string()
  .trim()
  .min(32, 'SUBSCRIPTION_CRON_SECRET must be at least 32 chars')
  .refine(
    (value) => !isObviousSecretPlaceholder(value),
    'SUBSCRIPTION_CRON_SECRET must not use a placeholder or default value',
  )
  .optional();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .refine(
        (value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
        'MONGODB_URI must use mongodb:// or mongodb+srv://',
      ),

    AUTH_SECRET: z
      .string()
      .min(32, 'AUTH_SECRET must be at least 32 chars')
      .refine((v) => v !== 'replace-me', 'AUTH_SECRET must be changed from the default'),
    AUTH_URL: z.url('AUTH_URL must be a valid URL'),
    AUTH_TRUST_HOST: z.enum(['true', 'false']).default('false'),
    NEXT_PUBLIC_SITE_URL: z.url('NEXT_PUBLIC_SITE_URL must be a valid URL'),
    NEXT_PUBLIC_API_URL: z.url('NEXT_PUBLIC_API_URL must be a valid URL'),

    SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive(),
    SESSION_UPDATE_AGE_SECONDS: z.coerce.number().int().positive(),
    AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive(),
    AUTH_LOCKOUT_WINDOW_MINUTES: z.coerce.number().int().positive(),
    AUTH_LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive(),

    ADAPTIVE_PROXY_TIMEOUT_MS: z.coerce.number().int().positive(),
    INTERNAL_SERVICE_TOKEN: internalServiceTokenSchema,

    OBJECT_STORAGE_ENDPOINT_EXTERNAL: z.url('OBJECT_STORAGE_ENDPOINT_EXTERNAL must be a valid URL'),
    OBJECT_STORAGE_REGION: z.string().refine(
      (value): value is (typeof OBJECT_STORAGE_REGIONS)[number] => {
        return OBJECT_STORAGE_REGIONS.includes(value as (typeof OBJECT_STORAGE_REGIONS)[number]);
      },
      `OBJECT_STORAGE_REGION must be one of: ${OBJECT_STORAGE_REGIONS.join(', ')}`,
    ),
    OBJECT_STORAGE_ADDRESSING_STYLE: z.enum(['path', 'virtual']),
    OBJECT_STORAGE_ACCESS_KEY: z.string().min(1, 'OBJECT_STORAGE_ACCESS_KEY is required'),
    OBJECT_STORAGE_SECRET_KEY: z.string().min(1, 'OBJECT_STORAGE_SECRET_KEY is required'),
    OBJECT_STORAGE_BUCKET: z.string().min(1, 'OBJECT_STORAGE_BUCKET is required'),

    MAIL_FROM: z.email('MAIL_FROM must be a valid email'),
    RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),

    PAYOS_CLIENT_ID: z.string().min(1, 'PAYOS_CLIENT_ID is required'),
    PAYOS_API_KEY: z.string().min(1, 'PAYOS_API_KEY is required'),
    PAYOS_CHECKSUM_KEY: z.string().min(1, 'PAYOS_CHECKSUM_KEY is required'),

    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    SUBSCRIPTION_CRON_SECRET: subscriptionCronSecretSchema,
    IMGBB_API_KEY: z.string().optional(),
    NEXT_PUBLIC_GA_ID: z.string().optional(),
    NEXT_IMAGE_UNOPTIMIZED: z.enum(['true', 'false']).optional(),
  })
  .superRefine((data, ctx) => {
    const mongoDatabaseName = readMongoDatabaseName(data.MONGODB_URI);
    if (
      data.NODE_ENV === 'production' &&
      (mongoDatabaseName === null || mongoDatabaseName.toLowerCase() === 'test')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'Production MONGODB_URI must select an explicit non-test database',
      });
    }

    if (
      (data.AUTH_GOOGLE_ID && !data.AUTH_GOOGLE_SECRET) ||
      (!data.AUTH_GOOGLE_ID && data.AUTH_GOOGLE_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_GOOGLE_ID'],
        message: 'AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must both be set, or both omitted',
      });
    }
  });

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error.issues);
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
