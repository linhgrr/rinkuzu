import { z } from 'zod';
import { locales } from '@/i18n/config';

const optionalText = z.string().trim().min(1).optional();
const positiveInt = z.number().int().positive();

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
  /**
   * `true` keeps the post off every list, the sitemap and its own route
   * (default `false`). A `date` in the future does the same until that day
   * (UTC); see `isPublished` in `./posts.ts`.
   */
  draft: z.boolean().optional(),

  // Optional presentation overrides. Each one falls back to a required field
  // above, so a new post needs none of them; they keep the hand-authored copy
  // of the posts migrated in RIN-404 unchanged.
  /** Short card text on the author page (defaults to `description`). */
  summary: optionalText,
  /** Subtitle under the article title (defaults to `description`). */
  lede: optionalText,
  /** `<meta name="description">` and Open Graph text (defaults to `description`). */
  seoDescription: optionalText,
  /** Twitter card text (defaults to the SEO description). */
  twitterDescription: optionalText,
  /** Read time shown on the article page (defaults to `readTimeMinutes`). */
  articleReadTimeMinutes: positiveInt.optional(),
  /** Last breadcrumb item on the article page (defaults to `title`). */
  breadcrumbLabel: optionalText,
  /** Label used by the previous/next links of neighbouring posts (defaults to `title`). */
  navLabel: optionalText,
  /** Call-to-action heading and body below the article. */
  ctaTitle: optionalText,
  ctaBody: optionalText,
  /** Article JSON-LD `wordCount` and `timeRequired` (omitted when absent). */
  wordCount: positiveInt.optional(),
  timeRequiredMinutes: positiveInt.optional(),
  /**
   * Share image (1200x630) for Open Graph and X cards: an absolute URL or a
   * site path. Without it the post gets a generated card with its title and
   * category (`/<locale>/blog/<slug>/og.png`, RIN-1330).
   */
  ogImage: optionalText,
  /** Topics for the related-posts block, compared case-insensitively (RIN-1331). */
  tags: z.array(z.string().trim().min(1, 'tags must not be empty')).max(8).optional(),
});

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
