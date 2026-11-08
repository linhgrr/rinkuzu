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

A missing or invalid required field fails validation (and the build) rather
than rendering a broken page — see `src/lib/blog/content.test.ts`.

This directory currently ships without any `.mdx` posts; wiring it into
routing/SEO and migrating the existing hand-authored articles are tracked in
follow-up issues (RIN-222).
