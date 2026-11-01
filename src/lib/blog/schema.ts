import { z } from 'zod';
import { locales } from '@/i18n/config';

/**
 * Frontmatter contract for `content/blog/<locale>/<slug>.mdx`.
 *
 * `locale` is declared in the frontmatter (not only inferred from the
 * directory) so the loader can fail the build if a file is ever moved into
 * the wrong locale folder without updating its metadata.
 */
export const blogFrontmatterSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().trim().min(1, 'description is required'),
  date: z.iso.date('date must be an ISO 8601 date (YYYY-MM-DD)'),
  category: z.string().trim().min(1, 'category is required'),
  readTimeMinutes: z.number().int().positive('readTimeMinutes must be a positive integer'),
  heroImage: z.string().trim().min(1, 'heroImage is required'),
  heroImageAlt: z.string().trim().min(1, 'heroImageAlt is required'),
  locale: z.enum(locales, { message: `locale must be one of: ${locales.join(', ')}` }),
  author: z.string().trim().min(1, 'author is required'),
});

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
