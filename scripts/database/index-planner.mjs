import { createHash } from 'node:crypto';

import { INDEX_LIFECYCLE_STATUSES } from './index-contract.mjs';

const ACTIVE_LIFECYCLES = new Set(['required_active', 'candidate_active', 'emergency']);
const APPLY_ACTIONS = new Set(['create', 'hide', 'unhide', 'update_ttl', 'drop']);
const MIN_HIDDEN_BEFORE_DROP_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_TTL_SECONDS = 2_147_483_647;

export function canonicalizeKey(key) {
  if (!key || typeof key !== 'object' || Array.isArray(key)) return [];
  return Object.entries(key).map(([field, direction]) => [field, direction]);
}

export function canonicalizeIndexOptions(options = {}) {
  const expireAfterSeconds = options.expireAfterSeconds;

  return {
    unique: options.unique === true,
    sparse: options.sparse === true,
    hidden: options.hidden === true,
    expireAfterSeconds:
      expireAfterSeconds === undefined || expireAfterSeconds === null
        ? null
        : Number(expireAfterSeconds),
    partialFilterExpression: canonicalizeDocument(options.partialFilterExpression),
    collation: canonicalizeCollation(options.collation),
    wildcardProjection: canonicalizeDocument(options.wildcardProjection),
    weights: canonicalizeDocument(options.weights),
    defaultLanguage: options.default_language ?? options.defaultLanguage ?? null,
    languageOverride: options.language_override ?? options.languageOverride ?? null,
  };
}

export function validateIndexContract(contract) {
  const issues = [];
  const ids = new Set();
  const semanticKeys = new Set();

  for (const entry of contract) {
    if (!entry || typeof entry !== 'object') {
      issues.push(issue('invalid_entry', null, 'Every index contract entry must be an object'));
      continue;
    }

    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      issues.push(issue('missing_id', null, 'Index contract entry is missing a stable id'));
    } else if (ids.has(entry.id)) {
      issues.push(issue('duplicate_id', entry.id, `Duplicate index id: ${entry.id}`));
    } else {
      ids.add(entry.id);
    }

    if (typeof entry.collection !== 'string' || entry.collection.length === 0) {
      issues.push(issue('missing_collection', entry.id, 'Index collection must be non-empty'));
    }

    if (canonicalizeKey(entry.key).length === 0) {
      issues.push(issue('missing_key', entry.id, 'Index key must contain at least one field'));
    }

    if (!INDEX_LIFECYCLE_STATUSES.includes(entry.lifecycle)) {
      issues.push(
        issue('invalid_lifecycle', entry.id, `Unsupported index lifecycle: ${entry.lifecycle}`),
      );
    }

    const options = canonicalizeIndexOptions(entry.options);
    if (options.sparse && options.partialFilterExpression !== null) {
      issues.push(
        issue(
          'sparse_partial_conflict',
          entry.id,
          'MongoDB indexes cannot combine sparse and partialFilterExpression',
        ),
      );
    }
    if (
      options.expireAfterSeconds !== null &&
      (!Number.isFinite(options.expireAfterSeconds) ||
        options.expireAfterSeconds < 0 ||
        options.expireAfterSeconds > MAX_TTL_SECONDS)
    ) {
      issues.push(
        issue(
          'invalid_ttl',
          entry.id,
          `expireAfterSeconds must be between 0 and ${MAX_TTL_SECONDS}`,
        ),
      );
    }
    if (entry.nameIsContract === true && (!entry.name || typeof entry.name !== 'string')) {
      issues.push(
        issue('missing_contract_name', entry.id, 'nameIsContract requires a non-empty name'),
      );
    }

    const semanticKey = `${entry.collection}:${stableStringify(canonicalizeKey(entry.key))}`;
    if (semanticKeys.has(semanticKey)) {
      issues.push(
        issue(
          'duplicate_semantic_key',
          entry.id,
          `More than one lifecycle entry owns ${entry.collection} ${stableStringify(entry.key)}`,
        ),
      );
    } else {
      semanticKeys.add(semanticKey);
    }

    if (entry.lifecycle === 'emergency') {
      if (!nonEmpty(entry.owner) || !nonEmpty(entry.ticket) || !validDate(entry.expiresAt)) {
        issues.push(
          issue(
            'invalid_emergency_metadata',
            entry.id,
            'Emergency indexes require owner, ticket, and a valid expiresAt timestamp',
          ),
        );
      }
    }

    validateDropLifecycle(entry, issues);
  }

  return issues;
}

export function buildIndexPlan({
  contract,
  contractVersion,
  actualIndexesByCollection,
  databaseName,
  now = new Date(),
}) {
  const validationIssues = validateIndexContract(contract);
  const normalizedActual = normalizeActualSnapshot(actualIndexesByCollection);
  const actions = [];

  if (validationIssues.length > 0) {
    for (const validationIssue of validationIssues) {
      actions.push(
        action({
          type: 'manual',
          indexId: validationIssue.indexId ?? 'contract',
          collection: 'contract',
          reason: validationIssue.message,
          code: validationIssue.code,
        }),
      );
    }
    return finalizePlan({
      actions,
      actualIndexesByCollection: normalizedActual,
      contract,
      contractVersion,
      databaseName,
    });
  }

  const matchedActual = new Set();

  for (const entry of contract) {
    const collectionIndexes = normalizedActual[entry.collection] ?? [];
    const matching = collectionIndexes.filter((index) => sameKey(index.key, entry.key));

    if (entry.lifecycle === 'externally_managed') {
      for (const index of matching) matchedActual.add(actualIdentity(entry.collection, index));
      continue;
    }

    if (entry.lifecycle === 'deprecated_hidden') {
      for (const index of matching) {
        matchedActual.add(actualIdentity(entry.collection, index));
        if (!index.options.hidden) {
          actions.push(
            action({
              type: 'hide',
              indexId: entry.id,
              collection: entry.collection,
              actualName: index.name,
              key: entry.key,
              reason: 'Deprecated index must be hidden before any later drop',
            }),
          );
        } else if (isDropEligible(entry, now)) {
          actions.push(
            action({
              type: 'drop',
              indexId: entry.id,
              collection: entry.collection,
              actualName: index.name,
              key: entry.key,
              reason: 'Hide window and documented workload cycle are complete',
              sensitive: true,
            }),
          );
        }
      }
      continue;
    }

    if (!ACTIVE_LIFECYCLES.has(entry.lifecycle)) continue;

    if (entry.lifecycle === 'emergency' && new Date(entry.expiresAt).getTime() <= now.getTime()) {
      actions.push(
        action({
          type: 'manual',
          indexId: entry.id,
          collection: entry.collection,
          key: entry.key,
          reason: `Emergency index expired at ${entry.expiresAt}; transition its lifecycle explicitly`,
          code: 'expired_emergency',
        }),
      );
    }

    if (matching.length === 0) {
      const options = entry.options ?? {};
      actions.push(
        action({
          type: 'create',
          indexId: entry.id,
          collection: entry.collection,
          key: entry.key,
          options,
          contractName: entry.nameIsContract === true ? entry.name : undefined,
          reason: 'Required active index is missing',
          sensitive: options.unique === true || options.expireAfterSeconds !== undefined,
        }),
      );
      continue;
    }

    for (const index of matching) matchedActual.add(actualIdentity(entry.collection, index));

    if (matching.length > 1) {
      actions.push(
        action({
          type: 'manual',
          indexId: entry.id,
          collection: entry.collection,
          key: entry.key,
          reason: 'Multiple server indexes match one contract key; reconcile them manually',
          code: 'ambiguous_actual_indexes',
        }),
      );
      continue;
    }

    const actual = matching[0];
    if (entry.nameIsContract === true && actual.name !== entry.name) {
      actions.push(
        action({
          type: 'manual',
          indexId: entry.id,
          collection: entry.collection,
          actualName: actual.name,
          key: entry.key,
          reason: `Contractual index name must be ${entry.name}`,
          code: 'name_mismatch',
        }),
      );
      continue;
    }

    if (!sameOptionsIgnoringVisibility(actual.options, entry.options ?? {})) {
      const ttlSeconds = desiredTtlUpdate(actual.options, entry.options ?? {}, entry.key);
      if (ttlSeconds !== null) {
        actions.push(
          action({
            type: 'update_ttl',
            indexId: entry.id,
            collection: entry.collection,
            actualName: actual.name,
            key: entry.key,
            options: entry.options ?? {},
            actualOptions: actual.options,
            reason: 'Single-field TTL option differs and can be updated safely with collMod',
            sensitive: true,
          }),
        );
        continue;
      }

      actions.push(
        action({
          type: 'manual',
          indexId: entry.id,
          collection: entry.collection,
          actualName: actual.name,
          key: entry.key,
          options: entry.options ?? {},
          actualOptions: actual.options,
          reason: 'Index options differ; automatic drop/recreate is forbidden',
          code: 'options_mismatch',
        }),
      );
      continue;
    }

    if (actual.options.hidden) {
      actions.push(
        action({
          type: 'unhide',
          indexId: entry.id,
          collection: entry.collection,
          actualName: actual.name,
          key: entry.key,
          reason: 'Required active index is hidden',
        }),
      );
    }
  }

  for (const [collection, indexes] of Object.entries(normalizedActual)) {
    for (const index of indexes) {
      if (isImplicitIdIndex(index) || matchedActual.has(actualIdentity(collection, index)))
        continue;
      actions.push(
        action({
          type: 'manual',
          indexId: 'unauthorized',
          collection,
          actualName: index.name,
          key: Object.fromEntries(index.key),
          actualOptions: index.options,
          reason: 'Server index is not classified by the lifecycle registry',
          code: 'unauthorized_index',
        }),
      );
    }
  }

  return finalizePlan({
    actions,
    actualIndexesByCollection: normalizedActual,
    contract,
    contractVersion,
    databaseName,
  });
}

export function computeActionFingerprint(value) {
  return sha256(
    stableStringify({
      type: value.type,
      indexId: value.indexId,
      collection: value.collection,
      actualName: value.actualName ?? null,
      key: canonicalizeKey(value.key),
      options: canonicalizeIndexOptions(value.options),
    }),
  );
}

export function stableStringify(value) {
  return JSON.stringify(canonicalizeDocument(value));
}

export function isApplicableAction(value) {
  return APPLY_ACTIONS.has(value.type);
}

function finalizePlan({
  actions,
  actualIndexesByCollection,
  contract,
  contractVersion,
  databaseName,
}) {
  const sortedActions = actions
    .map((value) => ({ ...value, fingerprint: computeActionFingerprint(value) }))
    .sort(compareActions);
  const planCore = {
    contractVersion,
    databaseName,
    contract: contract.map(canonicalizeContractEntry).sort((a, b) => a.id.localeCompare(b.id)),
    actualIndexesByCollection,
    actions: sortedActions,
  };
  const planSha = sha256(stableStringify(planCore));

  return {
    contractVersion,
    databaseName,
    status: sortedActions.length === 0 ? 'clean' : 'drift',
    planSha,
    blockingCount: sortedActions.length,
    manualCount: sortedActions.filter((value) => !isApplicableAction(value)).length,
    sensitiveCount: sortedActions.filter((value) => value.sensitive === true).length,
    actions: sortedActions,
  };
}

function normalizeActualSnapshot(actualIndexesByCollection = {}) {
  return Object.fromEntries(
    Object.entries(actualIndexesByCollection)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([collection, indexes]) => [
        collection,
        indexes
          .map((index) => ({
            name: String(index.name ?? ''),
            key: canonicalizeKey(index.key),
            options: canonicalizeIndexOptions(index),
          }))
          .sort((left, right) => {
            const keyOrder = stableStringify(left.key).localeCompare(stableStringify(right.key));
            return keyOrder || left.name.localeCompare(right.name);
          }),
      ]),
  );
}

function canonicalizeContractEntry(entry) {
  return {
    id: entry.id,
    collection: entry.collection,
    key: canonicalizeKey(entry.key),
    options: canonicalizeIndexOptions(entry.options),
    lifecycle: entry.lifecycle,
    name: entry.nameIsContract === true ? entry.name : null,
    nameIsContract: entry.nameIsContract === true,
    owner: entry.owner ?? null,
    ticket: entry.ticket ?? null,
    expiresAt: entry.expiresAt ?? null,
    hiddenSince: entry.hiddenSince ?? null,
    dropAfter: entry.dropAfter ?? null,
    workloadCycleEvidence: canonicalizeDocument(entry.workloadCycleEvidence),
  };
}

function canonicalizeDocument(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalizeDocument);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalizeDocument(child)]),
  );
}

function canonicalizeCollation(collation) {
  if (!collation || typeof collation !== 'object') return null;
  return {
    locale: collation.locale,
    caseLevel: collation.caseLevel ?? false,
    caseFirst: collation.caseFirst ?? 'off',
    strength: collation.strength ?? 3,
    numericOrdering: collation.numericOrdering ?? false,
    alternate: collation.alternate ?? 'non-ignorable',
    maxVariable: collation.maxVariable ?? 'punct',
    normalization: collation.normalization ?? false,
    backwards: collation.backwards ?? false,
  };
}

function validateDropLifecycle(entry, issues) {
  const values = [entry.hiddenSince, entry.dropAfter, entry.workloadCycleEvidence];
  const hasAny = values.some((value) => value !== undefined && value !== null);
  if (!hasAny) return;

  if (entry.lifecycle !== 'deprecated_hidden') {
    issues.push(
      issue(
        'drop_metadata_on_active_index',
        entry.id,
        'Drop lifecycle metadata is only valid for deprecated_hidden indexes',
      ),
    );
    return;
  }

  const evidence = entry.workloadCycleEvidence;
  if (
    !validDate(entry.hiddenSince) ||
    !validDate(entry.dropAfter) ||
    !evidence ||
    !nonEmpty(evidence.reference) ||
    !validDate(evidence.observedAt)
  ) {
    issues.push(
      issue(
        'incomplete_drop_evidence',
        entry.id,
        'Drop requires hiddenSince, dropAfter, and workloadCycleEvidence { reference, observedAt }',
      ),
    );
    return;
  }

  const hiddenAt = new Date(entry.hiddenSince).getTime();
  const dropAt = new Date(entry.dropAfter).getTime();
  const observedAt = new Date(evidence.observedAt).getTime();
  if (dropAt - hiddenAt < MIN_HIDDEN_BEFORE_DROP_MS) {
    issues.push(
      issue('hide_window_too_short', entry.id, 'An index must remain hidden for at least 7 days'),
    );
  }
  if (observedAt < hiddenAt) {
    issues.push(
      issue(
        'workload_evidence_too_early',
        entry.id,
        'Workload-cycle evidence must be observed after the index was hidden',
      ),
    );
  }
}

function isDropEligible(entry, now) {
  return (
    validDate(entry.hiddenSince) &&
    validDate(entry.dropAfter) &&
    entry.workloadCycleEvidence &&
    nonEmpty(entry.workloadCycleEvidence.reference) &&
    validDate(entry.workloadCycleEvidence.observedAt) &&
    new Date(entry.dropAfter).getTime() <= now.getTime()
  );
}

function sameKey(left, right) {
  const normalizedLeft = Array.isArray(left) ? left : canonicalizeKey(left);
  return stableStringify(normalizedLeft) === stableStringify(canonicalizeKey(right));
}

function sameOptionsIgnoringVisibility(actualOptions, desiredOptions) {
  const actual = { ...canonicalizeIndexOptions(actualOptions), hidden: false };
  const desired = { ...canonicalizeIndexOptions(desiredOptions), hidden: false };
  return stableStringify(actual) === stableStringify(desired);
}

function desiredTtlUpdate(actualOptions, desiredOptions, key) {
  if (canonicalizeKey(key).length !== 1) return null;

  const actual = { ...canonicalizeIndexOptions(actualOptions), hidden: false };
  const desired = { ...canonicalizeIndexOptions(desiredOptions), hidden: false };
  const desiredTtl = desired.expireAfterSeconds;
  if (desiredTtl === null || actual.expireAfterSeconds === desiredTtl) return null;

  const actualWithoutTtl = { ...actual, expireAfterSeconds: null };
  const desiredWithoutTtl = { ...desired, expireAfterSeconds: null };
  return stableStringify(actualWithoutTtl) === stableStringify(desiredWithoutTtl)
    ? desiredTtl
    : null;
}

function isImplicitIdIndex(index) {
  return index.name === '_id_' && stableStringify(index.key) === stableStringify([['_id', 1]]);
}

function actualIdentity(collection, index) {
  return `${collection}:${index.name}:${stableStringify(index.key)}`;
}

function action(value) {
  return {
    ...value,
    blocking: true,
    sensitive: value.sensitive === true,
  };
}

function compareActions(left, right) {
  return (
    left.collection.localeCompare(right.collection) ||
    left.indexId.localeCompare(right.indexId) ||
    left.type.localeCompare(right.type) ||
    String(left.actualName ?? '').localeCompare(String(right.actualName ?? ''))
  );
}

function issue(code, indexId, message) {
  return { code, indexId, message };
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
