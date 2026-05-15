---
name: slug
description: 'Skill for the [slug] area of rinkuzu. 35 symbols across 29 files.'
---

# [slug]

35 symbols | 29 files | Cohesion: 96%

## When to Use

- Working with code in `src/`
- Understanding how buildLocalizedMetadata, generateMetadata, generateMetadata work
- Modifying [slug]-related functionality

## Key Files

| File                                                        | Symbols                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| `src/app/[locale]/(app)/category/[slug]/page.tsx`           | formatDate, getCategoryColor, CategoryQuizCard, clearFilters |
| `src/app/[locale]/(marketing)/blog/authors/[slug]/page.tsx` | generateMetadata, buildPersonSchema, AuthorPage              |
| `src/app/[locale]/(app)/category/[slug]/layout.tsx`         | humanizeSlug, generateMetadata                               |
| `src/lib/seo.ts`                                            | buildLocalizedMetadata                                       |
| `src/services/quiz/QuizService.ts`                          | getQuizBySlug                                                |
| `src/services/quiz/QuizCrudService.ts`                      | getQuizBySlug                                                |
| `src/app/[locale]/(marketing)/page.tsx`                     | generateMetadata                                             |
| `src/app/[locale]/(marketing)/terms/page.tsx`               | generateMetadata                                             |
| `src/app/[locale]/(marketing)/privacy/page.tsx`             | generateMetadata                                             |
| `src/app/[locale]/(marketing)/pricing/page.tsx`             | generateMetadata                                             |

## Entry Points

Start here when exploring this area:

- **`buildLocalizedMetadata`** (Function) — `src/lib/seo.ts:55`
- **`generateMetadata`** (Function) — `src/app/[locale]/(marketing)/page.tsx:8`
- **`generateMetadata`** (Function) — `src/app/[locale]/(marketing)/terms/page.tsx:393`
- **`generateMetadata`** (Function) — `src/app/[locale]/(marketing)/privacy/page.tsx:141`
- **`generateMetadata`** (Function) — `src/app/[locale]/(marketing)/pricing/page.tsx:11`

## Key Symbols

| Symbol                   | Type     | File                                                                                 | Line |
| ------------------------ | -------- | ------------------------------------------------------------------------------------ | ---- |
| `buildLocalizedMetadata` | Function | `src/lib/seo.ts`                                                                     | 55   |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/page.tsx`                                              | 8    |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/terms/page.tsx`                                        | 393  |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/privacy/page.tsx`                                      | 141  |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/pricing/page.tsx`                                      | 11   |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/faq/page.tsx`                                          | 11   |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/cookies/page.tsx`                                      | 7    |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/contact/page.tsx`                                      | 8    |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/blog/page.tsx`                                         | 7    |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/about/page.tsx`                                        | 8    |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/explore/layout.tsx`                                          | 8    |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/categories/layout.tsx`                                       | 10   |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/adaptive-learning/page.tsx`                                  | 21   |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/blog/knowledge-graphs-adaptive-learning-pdfs/page.tsx` | 13   |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/blog/authors/page.tsx`                                 | 7    |
| `generateMetadata`       | Function | `src/app/[locale]/(marketing)/blog/ai-powered-quiz-generation-guide/page.tsx`        | 13   |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/users/[userId]/page.tsx`                                     | 75   |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/quiz/[slug]/layout.tsx`                                      | 9    |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/category/[slug]/layout.tsx`                                  | 28   |
| `generateMetadata`       | Function | `src/app/[locale]/(app)/adaptive-learning/upload/page.tsx`                           | 6    |

## Execution Flows

| Flow                                  | Type            | Steps |
| ------------------------------------- | --------------- | ----- |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |

## Connected Areas

| Area | Connections |
| ---- | ----------- |
| App  | 2 calls     |
| Quiz | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "buildLocalizedMetadata"})` — see callers and callees
2. `gitnexus_query({query: "[slug]"})` — find related execution flows
3. Read key files listed above for implementation details
