# UI Consistency Plan

## Goals

- Enforce shared UI primitives for actions and form controls.
- Remove accessibility anti-patterns (`role="button"` on non-button elements).
- Normalize focus behavior to `focus-visible` with tokenized ring styles.
- Reduce motion inconsistencies by replacing `transition-all`.

## Batch 1 (Completed)

- Removed duplicate markdown renderer module and kept a single source at `src/components/ui/MarkdownRenderer.tsx`.
- Replaced remaining `role="button"` usages with semantic elements:
  - `src/components/adaptive-learning/SessionHistorySections.tsx`
  - `src/components/adaptive-learning/ConceptDetail.tsx`
  - `src/components/ui/Flashcard.tsx`
  - `src/components/ui/Modal.tsx`
  - `src/app/[locale]/(app)/explore/page.tsx`
- Updated key search/filter controls in explore page to use primitives:
  - Search input now uses `Input`.
  - Clickable filter badge now uses `Button`.
- Started Category component unification:
  - Added shared hook `src/components/ui/hooks/use-dropdown-outside.ts`.
  - Added shared list item UI `src/components/ui/CategoryOptionItem.tsx`.
  - Applied both to `CategorySelector` and `CategorySearch`.

## Batch 2 (Completed)

- Replace raw `<button>` in high-traffic flows with `Button`:
  - Navigation, Sidebar, Adaptive Learning sections, Draft editor.
- Replace raw `<input>` / `<textarea>` with `Input` / `Textarea` in admin forms and quiz editors.
- Remove `focus:outline-none` and `outline-none` where present; standardize to `focus-visible:*`.

## Batch 3 (Completed)

- Replace `transition-all` in `src/components` and `src/app` with targeted transitions:
  - `transition-colors`
  - `transition-shadow`
  - `transition-transform`
- Prioritize interactive cards, floating buttons, and marketing hero sections.

## Batch 4 (Completed)

- Sweep admin area for button/chip spacing consistency:
  - `src/app/[locale]/(app)/admin/subscriptions/page.tsx`
  - `src/app/[locale]/(app)/admin/users/page.tsx`
  - `src/app/[locale]/(app)/admin/categories/page.tsx`
  - `src/app/[locale]/(app)/admin/plans/page.tsx`
  - `src/app/[locale]/(app)/admin/queue/page.tsx`
- Increased default badge sizing in shared UI to reduce cramped metadata and status labels.

## Batch 5 (Next)

- Sync `DESIGN.md` with current implementation decisions:
  - Badge default sizing
  - Button size tiers
  - Badge vs tag/pill semantics
  - Focus-visible and motion rules
- Normalize shared primitives to reduce page-level overrides:
  - `src/app/globals.css`
  - `src/components/ui/Button.tsx`
  - `src/components/ui/Input.tsx`
  - `src/components/ui/Card.tsx`

## Batch 6 (Next)

- Sweep shared UI components still using raw controls or local spacing systems:
  - `src/components/ui/QuestionDiscussion.tsx`
  - `src/components/ui/ReportQuiz.tsx`
  - `src/components/ui/ImageUpload.tsx`
  - `src/components/ui/CategorySearch.tsx`
  - `src/components/Navigation/NavigationClient.tsx`

## Batch 7 (Next)

- Roll the locked spacing/focus/motion system through:
  - Create / edit flows
  - Adaptive-learning flows
  - Marketing / landing surfaces

## Enforcement

- PR template now includes a UI consistency checklist in `.github/pull_request_template.md`.
- New changes should follow checklist before merge.
