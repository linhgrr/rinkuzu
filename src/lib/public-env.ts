/**
 * Public (NEXT_PUBLIC_*) configuration. This module reaches client bundles through
 * `@/lib/seo`, so it validates with `URL` instead of zod: one zod import here put all
 * of zod in the first-load JS of the quiz result page (RIN-1370).
 */
interface PublicEnv {
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_API_URL: string;
}

let cached: PublicEnv | null = null;

function isValidUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read NEXT_PUBLIC_* values via direct property access so Next.js inlines
 * them at build time. Reading from `process.env` as an object is not
 * inlined and returns `undefined` in the browser bundle.
 */
function loadPublicEnv(): PublicEnv {
  if (cached) return cached;

  // Direct property access so Next.js inlines the value at build time.
  // Bracket access (`process.env['NEXT_PUBLIC_*']`) is NOT inlined.
  const values = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  };

  const issues = Object.entries(values)
    .filter(([, value]) => !isValidUrl(value))
    .map(([name]) => `  • ${name}: ${name} must be a valid URL`);

  if (issues.length > 0) {
    throw new Error(`Invalid public environment configuration:\n${issues.join('\n')}`);
  }

  cached = values as PublicEnv;
  return cached;
}

export const publicEnv = loadPublicEnv();
