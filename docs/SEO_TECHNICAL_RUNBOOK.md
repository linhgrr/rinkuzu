# SEO Technical Runbook

## Purpose

This runbook defines how to verify and maintain technical SEO for RinKuzu in production.

## Scope

- Canonical and hreflang metadata
- Crawl controls via `robots.txt`
- Indexable URL coverage via `sitemap.xml`
- Structured data (JSON-LD)
- Ongoing monitoring in Search Console and Lighthouse

## Pre-deploy checks

Run from `rinkuzu/`:

```bash
npm run lint
npm run build
```

Expected:
- `lint` passes with no blocking errors.
- `build` succeeds and generates routes including `robots.txt` and `sitemap.xml`.

## Local verification checklist

1. Verify robots output:

```bash
npm run dev
curl -s http://localhost:3000/robots.txt
```

Expected:
- `User-agent: *`
- `Allow: /`
- Private areas are in `Disallow`.
- `Sitemap: <site>/sitemap.xml` exists.

2. Verify sitemap output:

```bash
curl -s http://localhost:3000/sitemap.xml
```

Expected:
- Contains only canonical, indexable URLs.
- Includes locale variants for public pages.
- Excludes private/auth/admin paths.

3. Verify canonical and hreflang tags:

```bash
curl -s http://localhost:3000 | rg "canonical|hreflang"
```

Expected:
- Canonical tag points to absolute site URL.
- Alternate language links include `vi`, `en`, and `x-default`.

4. Verify structured data blocks:

```bash
curl -s http://localhost:3000 | rg "Organization|WebSite"
curl -s http://localhost:3000/faq | rg "FAQPage"
```

Expected:
- Homepage includes `Organization` and `WebSite` JSON-LD.
- FAQ page includes `FAQPage` JSON-LD.

## Production verification

1. Check crawl endpoints:

```bash
curl -I https://quizz-ck.vercel.app/robots.txt
curl -I https://quizz-ck.vercel.app/sitemap.xml
```

Expected: HTTP 200 for both.

2. Validate structured data:
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Validator: https://validator.schema.org/

3. Search Console operations:
- Submit sitemap: `https://quizz-ck.vercel.app/sitemap.xml`
- Review Coverage weekly
- Review Enhancements for rich results
- Track top queries and CTR for homepage, pricing, adaptive-learning pages

## Weekly operations

- Monday: check Search Console indexing and coverage anomalies.
- Wednesday: run Lighthouse SEO on homepage + pricing + FAQ.
- Friday: verify noindex behavior on private routes and update runbook if route map changes.

## Incident response

If indexability regressions occur:
1. Check recent changes in:
   - `src/lib/seo.ts`
   - `src/lib/seo.routes.ts`
   - `src/app/robots.ts`
   - `src/app/sitemap.ts`
2. Re-run local verification checklist.
3. Roll forward with explicit fix; avoid disabling crawlers globally.

## Ownership

- Primary: Frontend maintainers of `rinkuzu`
- Secondary: SEO/content owner for Search Console monitoring
