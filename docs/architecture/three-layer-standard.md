# RinKuzu Three-Layer Type Standard

Status: normative. The shape rules below are enforced by `npm run check:architecture`
(scripts/check-layer-boundaries.mjs) except where a rule is explicitly marked below as a
convention the checker does not yet scan for — see "What check:architecture actually enforces".
Companion: docs/architecture/source-of-truth-registry.md (data ownership), this doc (type
ownership).

## The three layers and their type families

| Layer              | Code                                                              | Owns type family                                                                                                                                | Shape rules                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation       | src/app, src/components, src/features                             | View models (feature `api/` + `types/` modules)                                                                                                 | serialized wire data only; never imports @/dtos, @/models, @/repositories¹; never calls fetch/fetchApi outside feature `api/` boundary modules                                                        |
| Application/Domain | src/services, src/entities, src/interfaces, src/dtos, src/mappers | DTO (src/dtos, zod is the source of truth, Date as ISO string, id as string) and Entity (src/entities, Date as Date, id as string, no mongoose) | DTOs never import entities/models/repositories; entities never reference `_id` or Mongo types; services never import mongoose/@/models/@/repositories, so they depend on the injected interfaces only |
| Persistence        | src/repositories, src/models                                      | Persistence records (src/repositories/types, `_id: ObjectId`, Date as Date) and mongoose schemas (src/models)                                   | only repositories touch models²; one DDL writer (migrations), never request-path DDL³                                                                                                                 |

¹ The two presentation rules do **not** cover the same files, so read them separately.
`presentation -> persistence` (mongoose / `@/lib/mongoose` / `@/models` / `@/repositories`) walks the
whole presentation layer — src/app including src/app/api, plus src/components, plus src/features,
tests included. `presentation -> dto` walks src/app/[locale] and src/components only: src/app/api is
exempt because route handlers are the one presentation-side place that legitimately speaks DTO, and
src/features is left to the feature-scoped rules that model its own boundaries (`feature client ->
dto`, `feature non-boundary -> dto`, and their api-client twins). Both rules read static
`from '…'` specifiers; a dynamic `await import('@/repositories/…')` is invisible to them, and none
exists outside repository tests today. Neither scans for `@/entities` imports from presentation code
specifically — that ban is enforced only where DTOs themselves import entities (`dto -> domain`) and
for the quiz-builder client allowlist (`quiz builder client -> domain`). No presentation file imports
`@/entities` today, but a general presentation-wide `@/entities` scan is not wired into the checker;
treat the entities half of this cell as convention until it is.

² Enforced repo-wide (`non-persistence -> models`): every file under `src` importing `@/models` is a
violation unless it is under `src/repositories` (the persistence layer) or `src/models` itself
(models importing sibling models is legal within the persistence layer). Six pre-existing files are
grandfathered in a frozen allowlist because they predate this ratchet — `src/lib/audit.ts` and five
`src/lib/communication/*.ts` modules — and that allowlist may only shrink: `checkRatchet` fails both
on a new violation outside it and on an entry whose file no longer violates. New code should still
go through a repository; closing the `src/lib` gap remains its own refactor, tracked separately.

³ Not scanned by `check-layer-boundaries.mjs` at all. This is migration discipline enforced by
process and code review (`npm run migrate:performance-indexes` / `:apply`, one DDL writer), not by
the architecture checker.

## Mappers are the only crossings

- src/mappers: DTO <-> Entity (serialize/deserialize at the service boundary).
- src/repositories/mappers: Entity <-> Persistence record (hydrate/dehydrate at the repository boundary).
- A mapper is runtime code and belongs to the layer pair it crosses; it may import both sides.

## Deliberate shape echoes are NOT debt

The same business concept appears up to three times (DTO / Entity / Persistence record) with
systematic differences (id vs \_id, string dates vs Date). This duplication is the cost of
decoupling and is intentional: each layer can evolve without breaking the others, and drift is
caught at the mappers by the type checker. Do NOT "fix" it by deriving one layer's type from
another across a boundary — `check:architecture` bans the imports that would require, on purpose.
Cross-layer echo clones are recorded in quality/duplication-baseline.json as known.

**The rule is about crossings, and only about crossings.** Two shapes that echo each other _inside_
one layer are not protected by it. `src/models/PremiumPlaySession.ts` and
`PremiumPlaySessionPersistenceRecord` described the same documents field for field, in comments that
cited this section — but both are persistence, they cannot evolve apart, and a field added to one and
not the other was a bug no type checker was catching. They now share one generic field interface. If
you are about to cite this section, first check that the two shapes are on opposite sides of a
boundary; if they are not, the section below applies instead.

## What else is in the duplication baseline, and why

As of the 2026-08-30 re-cut the baseline holds 10 clones, 123 duplicated lines, 0.21% of `src`.
Every one of them is there on purpose:

| group                                                             | count | status                                                                                                             |
| ----------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| Cross-layer shape echoes (the section above)                      | 7     | deliberate — do not "fix"                                                                                          |
| One explicit pair in `src/services/premium/PremiumQuizService.ts` | 1     | deliberate — two response shapes kept stated rather than hidden behind a helper that cost more lines than it saved |
| Route import blocks                                               | 2     | residue — nothing to extract; see below                                                                            |

The two residue pairs are `admin/billing/orders` ↔ `admin/billing/webhooks` and
`admin/premium-submissions` ↔ `premium-submissions/mine`. What jscpd matches in each is the **import
block** plus `export const dynamic`, not a body. There is no helper that removes an import list — a
module that re-exported them would be a barrel, which `check:architecture` rejects outright as a
re-export-only file — and the second pair differs in the one line that matters, `withAdmin` against
`withAuth`. Hiding that difference behind a parameter would make the weaker guard easier to reach for.
So they stay, stated.

The baseline previously held 16 clones of controller boilerplate. They were retired by extending the
wrapper pattern rather than by suppressing the detector; the section below is the result.

Being in the baseline still does not make a clone sanctioned. **A baselined clone is invisible in the
gate's failure output, so the only way to see what is in it is to read
`reports/jscpd/jscpd-report.json` directly.** The ratchet in `scripts/check-duplication.mjs` only ever
permits the count to fall.

## One validation idiom, and the route wrappers built on it

Every `src/app/api/**/route.ts` validates through `src/lib/api/validated.ts` — `parseRouteParams`,
`parseSearchParams`, `parseJsonBody`, `parseParamsAndBody` — which return `{ ok: false, response }`
carrying the canonical 400 with a `{ fields }` payload. The lower layer they wrap,
`readAndValidateX` in `src/lib/api/request.ts`, returns the raw result instead and is for the rare
route that must answer something other than that 400: `billing/webhooks/[provider]` turns an unknown
provider into a 404, and is the only caller left.

Before this was unified, four spellings of the same bail-out were in circulation — the field map
under `fields`, the field map as the whole meta object, the field map under `issues`, and no meta at
all — and two route tests had comments pinning the drift as though it were intended. One route
answered in two different shapes depending on which half of the request failed.

On top of that idiom sit the route wrappers. Reach for the one that fits before writing a handler by
hand; each exists because it holds an obligation that fails **silently** when a route forgets it.

| wrapper                                                                                | family                             | what it holds that a route can forget           |
| -------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| `withCommunicationMutation` / `withCommunicationRead`                                  | admin campaigns, feedback, support | same-origin guard; the error scope              |
| `withBillingOrderMutation`                                                             | operator writes on an order        | mutation guard; body/route id cross-check       |
| `withBillingUserOrderAction` / `withBillingUserBodyAction`                             | customer-initiated billing writes  | same-origin guard; per-user rate limit          |
| `withWebhookRowAction`                                                                 | operator actions on a webhook row  | mutation guard; operator identity into audit    |
| `withPremiumSessionAction` / `Start` / `withPremiumRead` / `withPremiumSubmissionRead` | paid quiz content                  | private cache headers, on success **and** error |
| `quizAuthoringErrorResponse`                                                           | quiz create + draft submit         | `premium_required` → 403, not 400               |

Two rules for adding to this table. A wrapper earns its place by removing an obligation whose absence
is invisible in a green response — not by shortening a file, and never by breaking a clone the
detector found. And the auth level stays at the call site: `withAdmin` and `withAuth` are chosen
where the route is declared, never passed in as an argument.

## Sharing IS allowed within a layer

- DTO layer: shared zod fragments (see src/dtos/quiz.ts `quizComposeBaseFields`).
- Persistence layer: shared schema-field builders (src/models/Communication.ts `leaseQueueFields`),
  shared field interfaces across the schema and its persistence record
  (src/models/PremiumPlaySession.ts `PremiumPlaySessionFields`), and shared mapper helpers in either
  direction (src/repositories/mappers/question-content.ts `questionContentFields`).
- Never share a runtime schema or type across layer boundaries; shared primitives live in src/shared
  only if they are layer-agnostic (constants, branded scalars), never whole record shapes.

This last line was written and then not enforced, which is the same as not having it. Two files
under `src/shared/types` had grown into whole record shapes: `report.ts` was simultaneously the
mongoose document, the persistence record, the domain entity and the admin DTO, and
`subscription.ts` was both the entity and the persistence record. Each layer now declares its own,
and `persistence -> shared record type` in the architecture checker keeps `src/shared/types` out of
`src/models`, `src/repositories` and `src/interfaces/repositories`. Constants are still shareable
everywhere — that distinction is exactly what the rule is about, and there are meta-tests for both
halves of it.

Presentation-only shapes may still be shared within presentation: `src/shared/types/quiz-question.ts`
is read by DTOs and feature view models and by nothing in persistence, which is the intended use.

## When you add a field

1. Add it to the mongoose schema + persistence record (persistence layer).
2. Thread it through the repository mapper — typecheck now points at every gap.
3. Add it to the entity, then the service logic.
4. Add it to the DTO zod schema and the DTO mapper.
5. Expose it through the feature api/view-model if the UI needs it.
