---
name: categories
description: 'Skill for the Categories area of rinkuzu. 47 symbols across 20 files.'
---

# Categories

47 symbols | 20 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how getPdfPageCount, uploadPdfViaPresignedUrl, fetchApiData work
- Modifying categories-related functionality

## Key Files

| File                                                                | Symbols                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/admin/categories/page.tsx`                  | closeModals, handleSubmit, deleteCategory, confirmDeleteCategory, formatDate (+1)         |
| `src/app/[locale]/(app)/admin/reports/page.tsx`                     | AdminReportsPage, closeReportModal, updateReportStatus, deleteReport, confirmDeleteReport |
| `src/features/quiz/components/QuestionDiscussion.tsx`               | QuestionDiscussion, fetchComments, handleSubmitComment, formatDate                        |
| `src/app/[locale]/(app)/create/page.tsx`                            | PDFViewerComponent, CreateQuizPage, handleBackgroundExtract, mergePdfFiles                |
| `src/app/[locale]/(app)/setup/page.tsx`                             | SetupPage, checkSetupStatus, createAdminAccount                                           |
| `src/app/[locale]/(app)/review/page.tsx`                            | ReviewPage, fetchDueReviews, handleReviewSubmit                                           |
| `src/app/[locale]/(app)/categories/page.tsx`                        | CategoriesPage, fetchCategories, getCategoryColor                                         |
| `src/lib/pdf.ts`                                                    | getPdfPageCount, uploadPdfViaPresignedUrl                                                 |
| `src/features/adaptive-learning/hooks/use-random-library-images.ts` | useRandomLibraryImages, loadImages                                                        |
| `src/app/[locale]/(app)/payment/success/page.tsx`                   | PaymentSuccessContent, verifyPayment                                                      |

## Entry Points

Start here when exploring this area:

- **`getPdfPageCount`** (Function) — `src/lib/pdf.ts:7`
- **`uploadPdfViaPresignedUrl`** (Function) — `src/lib/pdf.ts:22`
- **`fetchApiData`** (Function) — `src/lib/api/client.ts:98`
- **`useRandomLibraryImages`** (Function) — `src/features/adaptive-learning/hooks/use-random-library-images.ts:6`
- **`loadImages`** (Function) — `src/features/adaptive-learning/hooks/use-random-library-images.ts:13`

## Key Symbols

| Symbol                     | Type     | File                                                                | Line |
| -------------------------- | -------- | ------------------------------------------------------------------- | ---- |
| `getPdfPageCount`          | Function | `src/lib/pdf.ts`                                                    | 7    |
| `uploadPdfViaPresignedUrl` | Function | `src/lib/pdf.ts`                                                    | 22   |
| `fetchApiData`             | Function | `src/lib/api/client.ts`                                             | 98   |
| `useRandomLibraryImages`   | Function | `src/features/adaptive-learning/hooks/use-random-library-images.ts` | 6    |
| `loadImages`               | Function | `src/features/adaptive-learning/hooks/use-random-library-images.ts` | 13   |
| `handleSubmit`             | Function | `src/features/quiz/components/ReportQuiz.tsx`                       | 25   |
| `QuestionDiscussion`       | Function | `src/features/quiz/components/QuestionDiscussion.tsx`               | 101  |
| `fetchComments`            | Function | `src/features/quiz/components/QuestionDiscussion.tsx`               | 117  |
| `handleSubmitComment`      | Function | `src/features/quiz/components/QuestionDiscussion.tsx`               | 150  |
| `formatDate`               | Function | `src/features/quiz/components/QuestionDiscussion.tsx`               | 185  |
| `confirmPurchase`          | Function | `src/app/[locale]/(app)/subscription/page.tsx`                      | 117  |
| `SetupPage`                | Function | `src/app/[locale]/(app)/setup/page.tsx`                             | 59   |
| `checkSetupStatus`         | Function | `src/app/[locale]/(app)/setup/page.tsx`                             | 64   |
| `createAdminAccount`       | Function | `src/app/[locale]/(app)/setup/page.tsx`                             | 79   |
| `ReviewPage`               | Function | `src/app/[locale]/(app)/review/page.tsx`                            | 80   |
| `fetchDueReviews`          | Function | `src/app/[locale]/(app)/review/page.tsx`                            | 87   |
| `handleReviewSubmit`       | Function | `src/app/[locale]/(app)/review/page.tsx`                            | 104  |
| `CreateQuizPage`           | Function | `src/app/[locale]/(app)/create/page.tsx`                            | 620  |
| `handleBackgroundExtract`  | Function | `src/app/[locale]/(app)/create/page.tsx`                            | 650  |
| `CategoriesPage`           | Function | `src/app/[locale]/(app)/categories/page.tsx`                        | 71   |

## Execution Flows

| Flow                                      | Type            | Steps |
| ----------------------------------------- | --------------- | ----- |
| `QuizResultPageClient → ParseApiBody`     | cross_community | 7     |
| `QuizResultPageClient → ApiResponseError` | cross_community | 7     |
| `CreateQuizPage → ParseApiBody`           | cross_community | 6     |
| `CreateQuizPage → ApiResponseError`       | cross_community | 6     |
| `EditQuizPage → ParseApiBody`             | cross_community | 5     |
| `EditQuizPage → ApiResponseError`         | cross_community | 5     |
| `HandleSubmit → ParseApiBody`             | cross_community | 5     |
| `HandleSubmit → ApiResponseError`         | cross_community | 5     |
| `CategoriesPage → ParseApiBody`           | cross_community | 5     |
| `CategoriesPage → ApiResponseError`       | cross_community | 5     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Components | 4 calls     |
| Api        | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "getPdfPageCount"})` — see callers and callees
2. `gitnexus_query({query: "categories"})` — find related execution flows
3. Read key files listed above for implementation details
