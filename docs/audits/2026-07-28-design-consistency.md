# RinKuzu design consistency audit

Date: 2026-07-28
Status: verified inventory; no aggregate score

## Method and source of truth

This audit replaces the earlier `4.8/10` score. Static counts are useful for finding review targets, but
they are not acceptance criteria by themselves. Decisions follow semantic role, rendered behavior,
accessibility, responsive behavior, and the designer reference frames documented in `DESIGN.md`.

Consumer violations are counted separately from raw values declared in token files or shared variants.
Image/media quality, microcopy, alignment, and responsive quality are not scored without rendered review.

## Verified defects

- Profile history referenced a missing `profile.loadHistoryError` translation and omitted the translation
  function from its effect dependencies.
- Bookmark deletion coupled the successful server delete to SWR revalidation, so a refresh failure could
  be presented as a failed delete.
- Headerless Modal consumers received shared content padding, causing double padding in composed modal
  bodies and breaking full-bleed content.
- Bookmark cards nested padded card content inside an already padded surface.
- Badge `purple`, `info`, and `success` did not map to distinct semantic roles.
- ErrorState used an informational blue surface instead of error semantics.
- AppChrome and BottomNav used different active-state aliases.
- `/quizzes` lacked a page heading, used an unnamed `1340px` container, and its menu actions lacked
  consistent focus/destructive treatment.
- Admin pages carried one-off native select styling despite sharing the same form-control contract.

These defects are addressed in the current implementation wave and covered by targeted type, lint, unit,
axe, and visual checks.

## Technical debt under ratchet

The repository still contains consumer hard-coded colors, arbitrary typography, arbitrary radius/shadow,
arbitrary layout geometry, raw neutral borders, and standalone raw buttons. These are tracked by
`quality/design-system-policy.json` and `npm run check:design-system`.

The ratchet prevents the measured debt from increasing. It does not claim the existing debt is zero.
Named token definitions, generated/brand assets, email/SVG output, and registered optical geometry are
outside the consumer-debt count.

## Optical and branding exceptions

- Fractional dashboard hero artwork bounds, transforms, rotations, crop, and overlap are deliberate
  optical geometry.
- Landing navigation typography and CTA shades are component roles that preserve the approved visual,
  even when their values differ from authenticated app action tokens.
- Unbounded and Vina Sans are landing display fonts; Montserrat remains the core application font.
- `18px` button padding, `14px` input padding, and `20px` panel radius are named optical tokens.
- Heroicons v1 (`react-icons/hi`) is the default icon family. Existing Lucide, Iconify, and Heroicons v2
  consumers are migration debt, not evidence that additional icon families are allowed.

## Requires visual review

- Intentional `/quizzes` container change from `1340px` to the named `1320px` app container.
- Desktop and mobile focus presentation for AppChrome, BottomNav, QuizCard actions, and landing header.
- Deterministic screenshots for `/dashboard`, `/quizzes`, `/adaptive`, and landing after animations and
  dynamic content are stabilized.
- Any future landing token migration that changes computed color, font metrics, image crop, or overlap.

## Not audited

- Image compression, intrinsic media quality, and art direction.
- Copywriting quality and localization tone.
- Pixel alignment or responsive behavior not observed in a rendered deterministic fixture.
- Debug/internal adaptive tooling as a visual-quality score. It remains subject to accessibility and focus
  rules.

## Acceptance criteria

The change is acceptable when typecheck, format, lint, design-system ratchet, unit/axe tests, targeted E2E,
and the full pre-commit gate pass. A visual baseline update must be reviewed as an explicit artifact; it
must not be hidden inside a token-only refactor.
