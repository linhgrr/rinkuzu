---
name: app
description: 'Skill for the App area of rinkuzu. 14 symbols across 5 files.'
---

# App

14 symbols | 5 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how buildBreadcrumbSchema, canonicalFor, languageAlternates work
- Modifying app-related functionality

## Key Files

| File                                           | Symbols                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/seo.ts`                               | normalizeSeoPath, localePrefix, localizedPath, canonicalFor, languageAlternates |
| `src/app/sitemap.ts`                           | localeVariants, buildHreflangLinks, toEntry, sitemap, pushEntry                 |
| `src/app/robots.ts`                            | localizedDisallow, robots                                                       |
| `src/lib/structured-data.ts`                   | buildBreadcrumbSchema                                                           |
| `src/app/[locale]/(app)/categories/layout.tsx` | CategoriesLayout                                                                |

## Entry Points

Start here when exploring this area:

- **`buildBreadcrumbSchema`** (Function) — `src/lib/structured-data.ts:91`
- **`canonicalFor`** (Function) — `src/lib/seo.ts:32`
- **`languageAlternates`** (Function) — `src/lib/seo.ts:37`
- **`sitemap`** (Function) — `src/app/sitemap.ts:34`
- **`pushEntry`** (Function) — `src/app/sitemap.ts:38`

## Key Symbols

| Symbol                  | Type     | File                                           | Line |
| ----------------------- | -------- | ---------------------------------------------- | ---- |
| `buildBreadcrumbSchema` | Function | `src/lib/structured-data.ts`                   | 91   |
| `canonicalFor`          | Function | `src/lib/seo.ts`                               | 32   |
| `languageAlternates`    | Function | `src/lib/seo.ts`                               | 37   |
| `sitemap`               | Function | `src/app/sitemap.ts`                           | 34   |
| `pushEntry`             | Function | `src/app/sitemap.ts`                           | 38   |
| `CategoriesLayout`      | Function | `src/app/[locale]/(app)/categories/layout.tsx` | 20   |
| `robots`                | Function | `src/app/robots.ts`                            | 12   |
| `normalizeSeoPath`      | Function | `src/lib/seo.ts`                               | 18   |
| `localePrefix`          | Function | `src/lib/seo.ts`                               | 23   |
| `localizedPath`         | Function | `src/lib/seo.ts`                               | 27   |
| `localeVariants`        | Function | `src/app/sitemap.ts`                           | 15   |
| `buildHreflangLinks`    | Function | `src/app/sitemap.ts`                           | 19   |
| `toEntry`               | Function | `src/app/sitemap.ts`                           | 26   |
| `localizedDisallow`     | Function | `src/app/robots.ts`                            | 5    |

## Execution Flows

| Flow                                  | Type            | Steps |
| ------------------------------------- | --------------- | ----- |
| `Sitemap → NormalizeSeoPath`          | intra_community | 6     |
| `Sitemap → LocalePrefix`              | intra_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |

## Connected Areas

| Area        | Connections |
| ----------- | ----------- |
| Quiz        | 1 calls     |
| Sitemap.xml | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "buildBreadcrumbSchema"})` — see callers and callees
2. `gitnexus_query({query: "app"})` — find related execution flows
3. Read key files listed above for implementation details
