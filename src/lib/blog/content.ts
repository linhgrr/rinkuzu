import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Locale } from '@/i18n/config';
import { locales } from '@/i18n/config';
import { findUnsafeBodyConstruct } from './body-safety';
import { blogFrontmatterSchema, type BlogFrontmatter } from './schema';

/**
 * Content convention: `content/blog/<locale>/<slug>.mdx`.
 *
 * - `<locale>` must be one of the directories in {@link locales} (`en`, `vi`).
 * - `<slug>` becomes the post's `slug` field and must be URL-safe
 *   (lowercase letters, numbers, and hyphens).
 * - Each file's frontmatter must satisfy {@link blogFrontmatterSchema}; a
 *   missing or invalid required field throws so the build fails loudly
 *   instead of rendering a broken page.
 * - The body is plain Markdown, never compiled as MDX: imports, `{expressions}`,
 *   HTML/JSX tags and non-http(s)/mailto link schemes outside code throw
 *   (see `./body-safety.ts`).
 */
export type BlogPost = BlogFrontmatter & {
  slug: string;
  /** Raw MDX body, with frontmatter stripped. */
  content: string;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A leading `---` fence, the YAML block, then a closing `---` on its own line.
const FRONTMATTER_PATTERN = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export class BlogContentError extends Error {}

/**
 * Splits an MDX source into its YAML frontmatter and body. YAML is parsed
 * with the 1.2 core schema, so unquoted `2026-01-15` stays a string rather
 * than becoming a `Date`.
 */
export const parseFrontmatter = (
  raw: string,
  filePath: string,
): { data: unknown; content: string } => {
  const match = FRONTMATTER_PATTERN.exec(raw);
  if (!match) {
    throw new BlogContentError(`Missing frontmatter block in ${filePath}`);
  }
  try {
    return { data: parseYaml(match[1] ?? ''), content: raw.slice(match[0].length) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BlogContentError(`Invalid YAML frontmatter in ${filePath}: ${reason}`);
  }
};

const getContentRoot = (): string => path.join(process.cwd(), 'content', 'blog');

const listMdxFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
    .map((entry) => entry.name);
};

/** Throws with `<file>:<line>` when the body holds code rather than content. */
const assertBodyIsContent = (raw: string, body: string, filePath: string): void => {
  const unsafe = findUnsafeBodyConstruct(body);
  if (!unsafe) {
    return;
  }
  const frontmatterLines = raw.slice(0, raw.length - body.length).split('\n').length - 1;
  throw new BlogContentError(
    `${filePath}:${frontmatterLines + unsafe.line}: ${unsafe.reason} is not allowed in a blog body; ` +
      'posts are plain Markdown (see content/blog/README.md)',
  );
};

const parsePostFile = (locale: Locale, filePath: string, slug: string): BlogPost => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(raw, filePath);

  const result = blogFrontmatterSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new BlogContentError(
      `Invalid frontmatter in ${filePath}:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
    );
  }

  const frontmatter = result.data;
  if (frontmatter.locale !== locale) {
    throw new BlogContentError(
      `Frontmatter locale "${frontmatter.locale}" in ${filePath} does not match its directory "${locale}"`,
    );
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new BlogContentError(
      `Invalid slug "${slug}" derived from ${filePath}; slugs must be lowercase and hyphen-separated`,
    );
  }

  assertBodyIsContent(raw, content, filePath);

  return { ...frontmatter, slug, content };
};

/**
 * Reads and validates every `<contentRoot>/<locale>/<slug>.mdx` file.
 * Throws {@link BlogContentError} on the first invalid frontmatter found so
 * callers (and the build) fail loudly rather than rendering a broken post.
 *
 * `contentRoot` defaults to `content/blog` and is only overridden by tests.
 */
export const loadBlogPosts = (contentRoot: string = getContentRoot()): BlogPost[] => {
  const posts: BlogPost[] = [];

  for (const locale of locales) {
    const localeDir = path.join(contentRoot, locale);
    for (const fileName of listMdxFiles(localeDir)) {
      const slug = fileName.replace(/\.mdx$/, '');
      posts.push(parsePostFile(locale, path.join(localeDir, fileName), slug));
    }
  }

  return posts;
};

let cachedPosts: BlogPost[] | null = null;

export const getAllBlogPosts = (): BlogPost[] => {
  if (!cachedPosts) {
    cachedPosts = loadBlogPosts();
  }
  return cachedPosts;
};

export const getBlogPostsByLocale = (locale: Locale): BlogPost[] =>
  getAllBlogPosts().filter((post) => post.locale === locale);

export const getBlogPostBySlug = (locale: Locale, slug: string): BlogPost | undefined =>
  getAllBlogPosts().find((post) => post.locale === locale && post.slug === slug);
