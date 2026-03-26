# Dashboard Performance + i18n Refactor Plan

## Goals

- Make `/[locale]/dashboard` feel fast on first load by reducing hydration and shared client cost.
- Stop treating translations as a single locale blob and move to a namespace-based structure.
- Create a migration path toward route-scoped message delivery instead of sending the entire locale tree to every client page.

## Current Bottlenecks

- Dashboard entry fetches data on the server, but then hands the entire screen to one large client component.
- Root providers include draft-processing logic for routes that do not use PDF processing.
- Locale messages live in one file per language and are injected wholesale into the root `NextIntlClientProvider`.

## Refactor Scope In This Change

1. Dashboard becomes server-first.
   - Remove the monolithic dashboard client shell.
   - Keep only small interactive islands for share, week-switching heatmap, streak-freeze purchase, and optional 3D mascot.
   - Replace imperative `router.push` interactions with locale-aware links where possible.

2. Shared client cost is reduced.
   - Move `DraftSyncProvider` out of the root provider tree.
   - Load draft-sync logic only inside the deferred floating draft progress island.

3. i18n files are modularized.
   - Split `messages/en.json` and `messages/vi.json` into `messages/<locale>/<namespace>.json`.
   - Add a server-only loader that can return all namespaces or a scoped subset.

## Next i18n Migration Phases

### Phase 1

- Keep root behavior compatible by still loading all namespaces for now.
- Introduce `getScopedMessages(locale, namespaces)` and use it for new route-local client islands.

### Phase 2

- Add route-group layouts such as `(marketing)` and `(app)` so each group can provide only the namespaces it actually needs.
- Remove the root-level all-messages provider.

### Phase 3

- Convert more pages to server components with `getTranslations`.
- Reserve `NextIntlClientProvider` for client-heavy routes and client islands only.

## Success Criteria

- Dashboard route JS decreases measurably after build.
- Root provider no longer imports draft/PDF processing logic.
- Locale messages are no longer maintained as one large file per locale.
