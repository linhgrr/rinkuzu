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

¹ `check:architecture` scans every file under src/app/[locale] and src/components (`presentation -> dto`,
`presentation -> persistence`), and every non-boundary file under src/features (`feature client -> dto`,
`feature non-boundary -> dto`) for these imports. It does not scan for `@/entities` imports from
presentation code specifically — that ban is enforced only where DTOs themselves import entities
(`dto -> domain`) and for the quiz-builder client allowlist (`quiz builder client -> domain`). No
presentation file imports `@/entities` today, but a general presentation-wide `@/entities` scan is
not wired into the checker; treat the entities half of this cell as convention until it is.

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

## What else is in the duplication baseline, and why

The baseline is not exclusively deliberate design. As of the 2026-08-30 re-cut it holds 26 clones
in three groups, and only the first two are "not debt":

| group                                                             | count | status                                                                                                             |
| ----------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| Cross-layer shape echoes (the section above)                      | 9     | deliberate — do not "fix"                                                                                          |
| One explicit pair in `src/services/premium/PremiumQuizService.ts` | 1     | deliberate — two response shapes kept stated rather than hidden behind a helper that cost more lines than it saved |
| Controller boilerplate across `src/app/api/**/route.ts`           | 16    | **accepted debt, retirable**                                                                                       |

The third group is genuine duplication that is simply not yet retired. It is the same shape that
`src/lib/api/communication-mutation.ts` (`withCommunicationMutation`) and
`src/lib/api/billing-order-mutation.ts` (`withBillingOrderMutation`) already eliminated for the
communication and billing-order route families: the guard, the params/body schemas, the bail-out,
the `apiOk` wrap and the error-scope catch, restated per route. What remains sits in the
premium-quizzes, premium-submissions, credits and remaining billing route families.

It is baselined so the gate stays useful — a fingerprint-exact baseline still fails on any _new_
clone — but being in the baseline does not make it sanctioned. **A baselined clone is invisible in
the gate's failure output, so the only way to see this group is to read
`reports/jscpd/jscpd-report.json` directly.** Retiring it means extending the same wrapper pattern
to those families and re-cutting the baseline downward; the ratchet in
`scripts/check-duplication.mjs` only ever permits it to fall.

## Sharing IS allowed within a layer

- DTO layer: shared zod fragments (see src/dtos/quiz.ts `quizComposeBaseFields`).
- Persistence layer: shared field builders (see src/models/Communication.ts `leaseQueueFields`).
- Never share a runtime schema or type across layer boundaries; shared primitives live in src/shared
  only if they are layer-agnostic (constants, branded scalars), never whole record shapes.

## When you add a field

1. Add it to the mongoose schema + persistence record (persistence layer).
2. Thread it through the repository mapper — typecheck now points at every gap.
3. Add it to the entity, then the service logic.
4. Add it to the DTO zod schema and the DTO mapper.
5. Expose it through the feature api/view-model if the UI needs it.
