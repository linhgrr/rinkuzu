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

² Enforced for src/app, src/services, src/interfaces/services, src/dtos, and the quiz-builder
client allowlist (all forbidden from importing `@/models`). It is not enforced for every corner of
the codebase: `src/lib/audit.ts` and `src/lib/communication/*.ts` import `@/models` directly today,
outside the repository layer and outside any checker ratchet. That is pre-existing debt this
standard does not paper over — new code should still go through a repository, and closing the
`src/lib` gap is tracked separately, not by this document.

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
