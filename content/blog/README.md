# Blog content

MDX source for `/blog` posts, consumed by `src/lib/blog/content.ts`.

## Convention

```
content/blog/<locale>/<slug>.mdx
```

- `<locale>` — one of `en`, `vi` (see `src/i18n/config.ts`).
- `<slug>` — lowercase, hyphen-separated; becomes the post's URL slug and
  must match the file name (without `.mdx`).

Each file needs a YAML frontmatter block validated by
`blogFrontmatterSchema` in `src/lib/blog/schema.ts`:

| Field             | Type                  | Notes                                 |
| ----------------- | --------------------- | ------------------------------------- |
| `title`           | string                | Required, non-empty.                  |
| `description`     | string                | Required, non-empty.                  |
| `date`            | string (`YYYY-MM-DD`) | ISO 8601 date.                        |
| `category`        | string                | Required, non-empty.                  |
| `readTimeMinutes` | integer               | Positive integer, minutes to read.    |
| `heroImage`       | string                | Path or URL to the hero image.        |
| `heroImageAlt`    | string                | Required alt text for the hero image. |
| `locale`          | `"en" \| "vi"`        | Must match the parent directory.      |
| `author`          | string                | Author slug, e.g. `rinkuzu-team`.     |

Optional fields override copy that otherwise falls back to a required field:

| Field                    | Falls back to        | Used for                                   |
| ------------------------ | -------------------- | ------------------------------------------ |
| `summary`                | `description`        | Card text on the author page.              |
| `lede`                   | `description`        | Subtitle under the article title.          |
| `seoDescription`         | `description`        | Meta, Open Graph and JSON-LD description.  |
| `twitterDescription`     | SEO description      | Twitter card description.                  |
| `articleReadTimeMinutes` | `readTimeMinutes`    | Read time on the article page.             |
| `breadcrumbLabel`        | `title`              | Last breadcrumb item on the article page.  |
| `navLabel`               | `title`              | Previous/next links on neighbouring posts. |
| `ctaTitle`, `ctaBody`    | a generic upload CTA | Call to action below the article.          |
| `wordCount`              | omitted              | Article JSON-LD `wordCount`.               |
| `timeRequiredMinutes`    | omitted              | Article JSON-LD `timeRequired` (`PT<n>M`). |
| `draft`                  | `false`              | `true` hides the post everywhere (below).  |

`tags` (optional, up to 8 non-empty strings, e.g. `["personalized-learning", "pdf"]`)
picks the related posts shown under each article: posts in the same locale that
share a tag (compared case-insensitively) or the `category`, most shared tags
first, then same category, then newest; at most 3. A post that shares neither
shows no related block. Give a translation the same tags as its `en` post.

A missing or invalid required field fails validation (and the build) rather
than rendering a broken page — see `src/lib/blog/content.test.ts`.

## The body is Markdown, not code

Posts are data. The body is rendered by react-markdown (GFM, raw HTML skipped)
in `src/components/ui/MarkdownRenderer.tsx`; it is **never compiled as MDX**,
so there is no MDX runtime and no component allowlist to maintain. The `.mdx`
extension is kept only for editor highlighting.

Loading posts (`src/lib/blog/body-safety.ts`, called from
`src/lib/blog/content.ts`) fails with `BlogContentError: <file>:<line>: ...`
when the body contains, **outside fenced code blocks and inline code**:

- an `import` or `export` statement line;
- a JSX/MDX expression: any `{` or `}` (write `\{` and `\}` to show a brace);
- a raw HTML or JSX tag: `<div>`, `</span>`, `<Foo />`, `<script>`, `<!-- -->`
  (write `\<` to show a literal `<` before a letter);
- a link, image, reference or autolink URL whose scheme is not `http`, `https`
  or `mailto`. Relative links (`/en/faq`, `#section`) are fine.

Everything else is fine: headings, lists, emphasis, GFM tables and task lists,
images, links, `<https://...>` autolinks, and any of the constructs above inside
a code block or code span. The check runs in
`src/lib/blog/content.test.ts` (it loads the real `content/blog` tree), so a PR
that adds such a post turns the `test:unit` step of `local/ci` red, and
`next build` fails on it too.

## Drafts and scheduled posts

`isPublished` in `src/lib/blog/posts.ts` decides, for every list, the author
pages, previous/next links, the sitemap and the post route:

- `draft: true` keeps the post out of all of them, and its URL is a 404, in
  every environment (dev, preview and production alike; there is no draft
  preview mode). To check a draft locally, set `draft: false` in your working
  copy and run `next dev`; do not commit that.
- A `date` after today (UTC) works like a draft until that day. The blog pages
  and `sitemap.xml` are statically cached and re-rendered at most hourly
  (`export const revalidate = 3600`, ISR), so the post appears within an hour
  of 00:00 UTC on its date, with no new deploy.

The file is still validated (frontmatter and body) while it is a draft or
scheduled, so a broken draft fails CI just like a published post.

## Publishing a new post

A standard post is a content-file-only PR: no route, component, sitemap or
SEO code changes.

1. Add `content/blog/en/<slug>.mdx` with the required frontmatter and the
   article body in plain Markdown (`##`/`###` headings build the table of
   contents). Link to other pages with locale-prefixed paths, for example
   `/en/faq`: links in the body are plain anchors and skip the locale router.
2. Add `content/blog/vi/<slug>.mdx` with Vietnamese frontmatter. Leave the body
   empty for a listing-only translation (see below), or add one to publish a
   translated article.
3. Run `npx vitest run --config vitest.node.config.ts src/lib/blog` to validate
   the frontmatter, then open a PR labelled `type:ui` so QA checks the preview.

Everything else is derived from the frontmatter when the site builds:

- the index, article and author pages (`src/app/[locale]/(marketing)/blog`);
- `<title>`, meta description, canonical, hreflang, Open Graph and Twitter
  tags (`generateMetadata` in `blog/[slug]/page.tsx`, via
  `buildLocalizedMetadata`);
- Article and BreadcrumbList JSON-LD (same file);
- sitemap entries for the article and its author, dated by `date`
  (`getBlogSitemapRoutes` in `src/lib/blog/posts.ts`, read by
  `src/lib/public-sitemap.ts`).

Product copy says **personalized** (en) and **cá nhân hóa** (vi), never
"adaptive" or "thích ứng".

A new author needs a profile in `src/lib/blog/authors.ts` (code change);
until then the author page and its sitemap entry are skipped.

## Routing

- `/<locale>/blog` lists the locale's posts, newest first.
- `/<locale>/blog/<slug>` is pre-rendered for every slug that has a body
  (`generateStaticParams` in `src/app/[locale]/(marketing)/blog/[slug]/page.tsx`).
- `/<locale>/blog/authors/<author>` lists that author's posts; the author
  profile itself lives in `src/lib/blog/authors.ts`.

**Listing-only translations.** A `vi` file with frontmatter but no body
localizes the index and author cards, and its article page shows the `en`
article. Add a body to publish a translated article.

**Formatting.** `.mdx` files are excluded from Prettier, which rewrites
Markdown (tables, emphasis, spacing) and would change published pages.
