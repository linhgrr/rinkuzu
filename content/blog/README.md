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

A missing or invalid required field fails validation (and the build) rather
than rendering a broken page — see `src/lib/blog/content.test.ts`.

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
