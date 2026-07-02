import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url('NEXT_PUBLIC_SITE_URL must be a valid URL'),
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
});

type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

/**
 * Read NEXT_PUBLIC_* values via direct property access so Next.js inlines
 * them at build time. Reading from `process.env` as an object is not
 * inlined and returns `undefined` in the browser bundle.
 */
function loadPublicEnv(): PublicEnv {
  if (cached) return cached;

  // Direct property access so Next.js inlines the value at build time.
  // Bracket access (`process.env['NEXT_PUBLIC_*']`) is NOT inlined.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_PUBLIC_API_URL: apiUrl,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid public environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

export const publicEnv = loadPublicEnv();
