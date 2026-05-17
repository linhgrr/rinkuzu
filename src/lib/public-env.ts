import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url('NEXT_PUBLIC_SITE_URL must be a valid URL'),
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
});

type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

function loadPublicEnv(): PublicEnv {
  if (cached) return cached;

  const parsed = publicEnvSchema.safeParse(process.env);

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
