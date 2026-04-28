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

## Batch 2 (Next)

- Replace raw `<button>` in high-traffic flows with `Button`:
  - Navigation, Sidebar, Adaptive Learning sections, Draft editor.
- Replace raw `<input>` / `<textarea>` with `Input` / `Textarea` in admin forms and quiz editors.
- Remove `focus:outline-none` and `outline-none` where present; standardize to `focus-visible:*`.

## Batch 3 (Next)

- Replace `transition-all` in `src/components` and `src/app` with targeted transitions:
  - `transition-colors`
  - `transition-shadow`
  - `transition-transform`
- Prioritize interactive cards, floating buttons, and marketing hero sections.

## Enforcement

- PR template now includes a UI consistency checklist in `.github/pull_request_template.md`.
- New changes should follow checklist before merge.
