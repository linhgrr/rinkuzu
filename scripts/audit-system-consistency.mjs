#!/usr/bin/env node

/**
 * Deterministic, read-only RinKuzu persistence consistency audit.
 *
 * Safety contract:
 * - performs only listCollections/find/count/aggregate operations;
 * - never prints MongoDB URIs, credentials, document payloads, email addresses, or tokens;
 * - samples are identifiers hashed to a short stable fingerprint;
 * - exits non-zero only for execution/configuration failure, not for discovered anomalies.
 */

import crypto from 'node:crypto';
import process from 'node:process';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });

const WEB_DB = process.env['AUDIT_WEB_DB'] || 'rinkuzu';
const AI_DB = process.env['AUDIT_AI_DB'] || 'adaptive_learning';
const WEB_URI = process.env['MONGODB_URI'];
const AI_URI = process.env['AI_MONGODB_URI'] || WEB_URI;
const SAMPLE_LIMIT = 5;

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function sanitizeErrorMessage(value) {
  return String(value)
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '<redacted-mongodb-uri>')
    .replace(/_mongodb\._tcp\.[^\s]+/gi, '<redacted-mongodb-srv>')
    .replace(/[a-z0-9.-]+\.mongodb\.net/gi, '<redacted-mongodb-host>');
}

function sampleIds(rows, selector = (row) => row?._id) {
  return rows
    .map(selector)
    .filter((value) => value !== undefined && value !== null)
    .map((value) => fingerprint(value))
    .sort()
    .slice(0, SAMPLE_LIMIT);
}

function anomaly(type, sources, rows, runtimeImpact, reconcile, selector) {
  return {
    type,
    count: rows.length,
    sources: [...sources].sort(),
    sampleIds: sampleIds(rows, selector),
    runtimeImpact,
    reconcile,
  };
}

async function existingCollections(db) {
  return new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name),
  );
}

async function safeFind(collections, db, name, filter = {}, options = {}) {
  if (!collections.has(name)) return [];
  return db.collection(name).find(filter, options).toArray();
}

async function safeAggregate(collections, db, name, pipeline) {
  if (!collections.has(name)) return [];
  return db.collection(name).aggregate(pipeline, { allowDiskUse: false }).toArray();
}

async function collectionInventory(db, collections) {
  const rows = [];
  for (const name of [...collections].sort()) {
    rows.push({ name, count: await db.collection(name).estimatedDocumentCount() });
  }
  return rows;
}

async function auditDirectReferences(collections, db, definitions) {
  const results = [];
  for (const definition of definitions) {
    if (!collections.has(definition.collection) || !collections.has(definition.target)) continue;
    const rows = await safeAggregate(collections, db, definition.collection, [
      {
        $match: {
          [definition.field]: {
            $exists: true,
            $ne: null,
          },
        },
      },
      {
        $lookup: {
          from: definition.target,
          localField: definition.field,
          foreignField: definition.targetField || '_id',
          as: 'targetDoc',
        },
      },
      { $match: { targetDoc: { $size: 0 } } },
      { $project: { _id: 1 } },
    ]);
    results.push(
      anomaly(
        `orphan_${definition.collection}_${definition.field.replaceAll('.', '_')}`,
        [`${definition.collection}.${definition.field}`, definition.target],
        rows,
        definition.runtimeImpact,
        definition.reconcile,
      ),
    );
  }
  return results;
}

async function auditWeb(db) {
  const collections = await existingCollections(db);
  const anomalies = [];

  anomalies.push(
    ...(await auditDirectReferences(collections, db, [
      {
        collection: 'quizzes',
        field: 'author',
        target: 'users',
        runtimeImpact: 'A published quiz has no canonical owner.',
        reconcile:
          'Restore the owner explicitly or quarantine the quiz; never infer ownership from snapshots.',
      },
      {
        collection: 'quizzes',
        field: 'folder',
        target: 'folders',
        runtimeImpact: 'An embedded quiz folder pointer references no canonical folder.',
        reconcile:
          'Migrate placement to folderquizzes and remove the embedded folder field after verification.',
      },
      {
        collection: 'folders',
        field: 'owner',
        target: 'users',
        runtimeImpact: 'A folder has no canonical account owner.',
        reconcile: 'Quarantine the folder until account retention and ownership are resolved.',
      },
      {
        collection: 'folderquizzes',
        field: 'owner',
        target: 'users',
        runtimeImpact: 'A folder membership has no canonical account owner.',
        reconcile: 'Remove only after the owning account deletion is proven.',
      },
      {
        collection: 'folderquizzes',
        field: 'folder',
        target: 'folders',
        runtimeImpact: 'A folder membership points to a missing folder.',
        reconcile: 'Remove the orphan join fact after retention validation.',
      },
      {
        collection: 'folderquizzes',
        field: 'quiz',
        target: 'quizzes',
        runtimeImpact: 'A folder membership points to a missing quiz.',
        reconcile: 'Remove the orphan join fact after quiz deletion is confirmed.',
      },
      {
        collection: 'quizprogresses',
        field: 'userId',
        target: 'users',
        runtimeImpact: 'Resumable quiz state has no canonical account owner.',
        reconcile: 'Purge only after account deletion/retention is confirmed.',
      },
      {
        collection: 'quizprogresses',
        field: 'quiz',
        target: 'quizzes',
        runtimeImpact: 'Resumable quiz state cannot resolve its current quiz.',
        reconcile:
          'Quarantine stale resume state; an attempt snapshot must not become current quiz authority.',
      },
      {
        collection: 'discussions',
        field: 'quiz',
        target: 'quizzes',
        runtimeImpact: 'A discussion has no current quiz owner.',
        reconcile: 'Apply the documented discussion retention rule before deleting it.',
      },
      {
        collection: 'premiumquizsubmissions',
        field: 'sourceQuiz',
        target: 'quizzes',
        runtimeImpact: 'A Premium submission cannot resolve its source quiz.',
        reconcile:
          'Preserve the immutable submission snapshot but repair/quarantine workflow ownership explicitly.',
      },
      {
        collection: 'premiumquizsubmissions',
        field: 'author',
        target: 'users',
        runtimeImpact: 'A Premium submission cannot resolve its author.',
        reconcile: 'Resolve account retention before any reward or publication action.',
      },
      {
        collection: 'premiumreviewjobs',
        field: 'submission',
        target: 'premiumquizsubmissions',
        runtimeImpact: 'A review job cannot resolve its canonical submission.',
        reconcile:
          'Fail the operational job and retain audit evidence; do not recreate a submission from AI state.',
      },
      {
        collection: 'premiumreviewjobs',
        field: 'requestedBy',
        target: 'users',
        runtimeImpact: 'A review job cannot resolve the requesting admin.',
        reconcile: 'Retain audit identity evidence and quarantine the job.',
      },
      {
        collection: 'premiumquizaccessgrants',
        field: 'user',
        target: 'users',
        runtimeImpact: 'A Premium unlock fact has no account owner.',
        reconcile: 'Preserve the fact until account deletion and credit retention are reconciled.',
      },
      {
        collection: 'premiumquizaccessgrants',
        field: 'quiz',
        target: 'quizzes',
        runtimeImpact: 'A Premium unlock fact points to a missing quiz.',
        reconcile: 'Preserve financial history and remove access projection only after review.',
      },
      {
        collection: 'premiumquizaccessgrants',
        field: 'ledgerEntry',
        target: 'creditledgers',
        runtimeImpact: 'An unlock exists without its canonical credit debit fact.',
        reconcile: 'Quarantine access; never synthesize a debit without idempotency evidence.',
      },
      {
        collection: 'premiumplaysessions',
        field: 'user',
        target: 'users',
        runtimeImpact: 'A Premium play session has no account owner.',
        reconcile: 'Allow TTL cleanup after confirming no attempt write is pending.',
      },
      {
        collection: 'premiumplaysessions',
        field: 'quiz',
        target: 'quizzes',
        runtimeImpact: 'A Premium play session cannot resolve its quiz.',
        reconcile:
          'Expire the session; never promote the stored session payload to current quiz authority.',
      },
      {
        collection: 'premiumplaysessions',
        field: 'submission',
        target: 'premiumquizsubmissions',
        runtimeImpact: 'A Premium play session cannot resolve its immutable submission snapshot.',
        reconcile: 'Expire the session after checking for a pending attempt.',
      },
      {
        collection: 'billingorders',
        field: 'user',
        target: 'users',
        runtimeImpact: 'A financial order has no canonical account owner.',
        reconcile: 'Retain financial evidence and resolve account identity manually.',
      },
      {
        collection: 'paymentattempts',
        field: 'order',
        target: 'billingorders',
        runtimeImpact: 'A provider attempt has no canonical billing order.',
        reconcile: 'Quarantine provider state and reconcile by verified external identifiers.',
      },
      {
        collection: 'paymenttransactions',
        field: 'attempt',
        target: 'paymentattempts',
        runtimeImpact: 'A money fact has no provider attempt.',
        reconcile: 'Retain the transaction and reconcile using provider evidence.',
      },
      {
        collection: 'paymenttransactions',
        field: 'order',
        target: 'billingorders',
        runtimeImpact: 'A money fact has no canonical billing order.',
        reconcile: 'Retain the transaction and reconcile using provider evidence.',
      },
      {
        collection: 'entitlementaccounts',
        field: 'user',
        target: 'users',
        runtimeImpact: 'The entitlement projection has no canonical account owner.',
        reconcile: 'Rebuild or remove only after ledger and account retention are resolved.',
      },
      {
        collection: 'entitlementgrants',
        field: 'user',
        target: 'users',
        runtimeImpact: 'An entitlement fact has no canonical account owner.',
        reconcile: 'Retain the fact and reconcile identity; never reassign automatically.',
      },
      {
        collection: 'entitlementadjustments',
        field: 'grant',
        target: 'entitlementgrants',
        runtimeImpact: 'An entitlement adjustment cannot resolve the grant it modifies.',
        reconcile:
          'Quarantine the adjustment and restore ledger integrity from audited source evidence.',
      },
      {
        collection: 'creditwallets',
        field: 'user',
        target: 'users',
        runtimeImpact: 'A credit projection has no canonical account owner.',
        reconcile: 'Rebuild/remove only after canonical credit ledger retention is resolved.',
      },
      {
        collection: 'creditledgers',
        field: 'user',
        target: 'users',
        runtimeImpact: 'A credit fact has no canonical account owner.',
        reconcile: 'Retain the fact and reconcile identity manually.',
      },
    ])),
  );

  const now = new Date();
  const embeddedSubscriptions = await safeFind(
    collections,
    db,
    'users',
    { subscription: { $exists: true } },
    { projection: { _id: 1 } },
  );
  anomalies.push(
    anomaly(
      'legacy_user_subscription_present',
      ['users.subscription'],
      embeddedSubscriptions,
      'A retired entitlement snapshot can be mistaken for current Premium authority.',
      'Remove the embedded snapshot; entitlement grants and their account projection are canonical.',
    ),
  );

  const legacyCanonicalEntitlementDrift = await safeAggregate(collections, db, 'users', [
    { $match: { subscription: { $exists: true } } },
    {
      $lookup: {
        from: 'entitlementaccounts',
        localField: '_id',
        foreignField: 'user',
        as: 'account',
      },
    },
    { $set: { account: { $first: '$account' } } },
    {
      $set: {
        legacyActive: {
          $and: [
            { $eq: ['$subscription.isActive', true] },
            { $gt: ['$subscription.endDate', now] },
          ],
        },
        canonicalActive: {
          $or: [{ $eq: ['$account.perpetual', true] }, { $gt: ['$account.currentEndAt', now] }],
        },
      },
    },
    {
      $match: {
        $expr: {
          $or: [
            { $ne: ['$legacyActive', '$canonicalActive'] },
            {
              $and: [
                '$legacyActive',
                '$canonicalActive',
                {
                  $or: [
                    { $ne: ['$subscription.planId', '$account.planId'] },
                    { $ne: ['$subscription.startDate', '$account.currentStartAt'] },
                    { $ne: ['$subscription.endDate', '$account.currentEndAt'] },
                    { $eq: ['$account.perpetual', true] },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'legacy_user_subscription_disagrees_with_entitlement_projection',
      ['users.subscription', 'entitlementaccounts'],
      legacyCanonicalEntitlementDrift,
      'Different readers grant different Premium state to the same account.',
      'Backfill and verify the entitlement ledger/projection, then remove users.subscription from runtime and storage.',
    ),
  );

  const embeddedFolderAuthority = await safeFind(
    collections,
    db,
    'quizzes',
    { folder: { $type: 'objectId' } },
    { projection: { _id: 1 } },
  );
  anomalies.push(
    anomaly(
      'owned_quiz_embedded_folder_authority',
      ['quizzes.folder', 'folderquizzes'],
      embeddedFolderAuthority,
      'Owned and external quizzes use different persistence authorities for the same folder-placement feature.',
      'Backfill one folderquizzes fact for every valid placement, cut all readers/writers to the join, then unset quizzes.folder.',
    ),
  );

  const folderOwnerMismatch = await safeAggregate(collections, db, 'folderquizzes', [
    { $lookup: { from: 'folders', localField: 'folder', foreignField: '_id', as: 'folderDoc' } },
    { $set: { folderDoc: { $first: '$folderDoc' } } },
    { $match: { $expr: { $ne: ['$owner', '$folderDoc.owner'] } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'folder_membership_owner_mismatch',
      ['folderquizzes.owner', 'folders.owner'],
      folderOwnerMismatch,
      'A user can receive placement state inside another account folder.',
      'Repair ownership from the canonical folder owner; never infer it from the quiz author.',
    ),
  );

  const duplicateEmails = await safeAggregate(collections, db, 'users', [
    { $match: { email: { $type: 'string' } } },
    { $project: { normalized: { $toLower: { $trim: { input: '$email' } } } } },
    { $group: { _id: '$normalized', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'duplicate_canonical_email',
      ['users'],
      duplicateEmails,
      'Authentication/account ownership can resolve the same human identity inconsistently.',
      'Merge/canonicalize identities with the dedicated dry-run email migration before enforcing uniqueness.',
    ),
  );

  const expiredEmbeddedSubscriptions = await safeFind(
    collections,
    db,
    'users',
    {
      'subscription.isActive': true,
      'subscription.endDate': { $type: 'date', $lte: new Date() },
    },
    { projection: { _id: 1 } },
  );
  anomalies.push(
    anomaly(
      'active_embedded_subscription_is_expired',
      ['users.subscription'],
      expiredEmbeddedSubscriptions,
      'Legacy entitlement readers can grant Premium after the entitlement interval ended.',
      'Stop using users.subscription as authority; validate canonical entitlement projection and remove the snapshot after migration.',
    ),
  );

  const paidUnfulfilled = await safeFind(
    collections,
    db,
    'billingorders',
    {
      collectionStatus: { $in: ['paid', 'overpaid'] },
      fulfillmentStatus: { $ne: 'fulfilled' },
    },
    { projection: { _id: 1 } },
  );
  anomalies.push(
    anomaly(
      'paid_order_not_fulfilled',
      ['billingorders'],
      paidUnfulfilled,
      'Money is collected while Premium may not be granted.',
      'Run billing reconciliation in dry-run, diagnose provider/order state, then approve targeted fulfillment repair.',
    ),
  );

  const fulfilledWithoutGrant = await safeAggregate(collections, db, 'billingorders', [
    { $match: { fulfillmentStatus: 'fulfilled', collectionStatus: { $in: ['paid', 'overpaid'] } } },
    {
      $lookup: {
        from: 'entitlementgrants',
        let: { orderId: { $toString: '$_id' } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$sourceType', 'billing_order'] },
                  { $eq: ['$sourceId', '$$orderId'] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'grant',
      },
    },
    { $match: { grant: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'fulfilled_order_without_entitlement_grant',
      ['billingorders', 'entitlementgrants'],
      fulfilledWithoutGrant,
      'Billing says fulfillment completed but the canonical entitlement ledger has no fact to replay.',
      'Backfill one idempotent billing_order grant per validated paid order, then rebuild entitlementaccounts.',
    ),
  );

  const grantWithoutOrder = await safeAggregate(collections, db, 'entitlementgrants', [
    { $match: { sourceType: 'billing_order' } },
    {
      $addFields: {
        sourceObjectId: {
          $convert: { input: '$sourceId', to: 'objectId', onError: null, onNull: null },
        },
      },
    },
    {
      $lookup: {
        from: 'billingorders',
        localField: 'sourceObjectId',
        foreignField: '_id',
        as: 'order',
      },
    },
    { $match: { order: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'billing_entitlement_grant_without_order',
      ['entitlementgrants', 'billingorders'],
      grantWithoutOrder,
      'Premium can be granted from a billing source that cannot be proved.',
      'Quarantine the grant for manual reconciliation; never synthesize an order without provider evidence.',
    ),
  );

  const orphanEntitlementUsers = await safeAggregate(collections, db, 'entitlementaccounts', [
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
    { $match: { userDoc: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'entitlement_account_orphan_user',
      ['entitlementaccounts', 'users'],
      orphanEntitlementUsers,
      'Entitlement projection cannot be owned by a valid account.',
      'Delete only after approved production reconciliation proves the user was removed and no ledger/legal retention requires it.',
    ),
  );

  const walletDrift = await safeAggregate(collections, db, 'creditwallets', [
    {
      $lookup: {
        from: 'creditledgers',
        localField: 'user',
        foreignField: 'user',
        as: 'ledger',
      },
    },
    { $addFields: { ledgerBalance: { $sum: '$ledger.amount' } } },
    { $match: { $expr: { $ne: ['$balance', '$ledgerBalance'] } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'credit_wallet_balance_drift',
      ['creditwallets', 'creditledgers'],
      walletDrift,
      'Users can gain/lose unlock power independently of the canonical credit ledger.',
      'Rebuild wallet balance from ordered ledger facts; investigate any impossible negative/intermediate history first.',
    ),
  );

  const orphanBookmarks = await safeAggregate(collections, db, 'bookmarks', [
    {
      $addFields: {
        userObjectId: {
          $convert: { input: '$userId', to: 'objectId', onError: null, onNull: null },
        },
      },
    },
    { $lookup: { from: 'users', localField: 'userObjectId', foreignField: '_id', as: 'userDoc' } },
    { $lookup: { from: 'quizzes', localField: 'quiz.slug', foreignField: 'slug', as: 'quizDoc' } },
    { $match: { $or: [{ userDoc: { $size: 0 } }, { quizDoc: { $size: 0 } }] } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'bookmark_orphan_reference',
      ['bookmarks', 'users', 'quizzes'],
      orphanBookmarks,
      'Bookmark lists can return entries whose owner or quiz no longer exists.',
      'Remove orphan bookmarks only after validating retention rules; keep bookmarks as the sole bookmark authority.',
    ),
  );

  const orphanFolderMembership = await safeAggregate(collections, db, 'folderquizzes', [
    { $lookup: { from: 'folders', localField: 'folder', foreignField: '_id', as: 'folderDoc' } },
    { $lookup: { from: 'quizzes', localField: 'quiz', foreignField: '_id', as: 'quizDoc' } },
    { $match: { $or: [{ folderDoc: { $size: 0 } }, { quizDoc: { $size: 0 } }] } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'folder_membership_orphan_reference',
      ['folderquizzes', 'folders', 'quizzes'],
      orphanFolderMembership,
      'Folder contents can contain dead membership edges.',
      'Delete only orphan join facts after owner/quiz deletion is confirmed.',
    ),
  );

  const orphanAttempts = await safeAggregate(collections, db, 'attempts', [
    { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
    { $lookup: { from: 'quizzes', localField: 'quiz', foreignField: '_id', as: 'quizDoc' } },
    {
      $match: {
        $or: [
          { quizDoc: { $size: 0 } },
          { $and: [{ user: { $type: 'objectId' } }, { userDoc: { $size: 0 } }] },
        ],
      },
    },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'attempt_orphan_reference',
      ['attempts', 'users', 'quizzes'],
      orphanAttempts,
      'History/progress reconciliation cannot resolve an attempt owner or source quiz.',
      'Preserve historical attempt snapshots where retention requires them; repair identity/reference ownership explicitly.',
    ),
  );

  const questionBookmarkDrift = await safeAggregate(collections, db, 'questionprogresses', [
    { $match: { isBookmarked: { $type: 'bool' } } },
    {
      $lookup: {
        from: 'bookmarks',
        let: {
          userId: '$userId',
          quizSlug: '$quizSlug',
          questionText: '$questionRef.text',
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$userId'] },
                  { $eq: ['$quiz.slug', '$$quizSlug'] },
                  { $eq: ['$question.text', '$$questionText'] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'bookmarkDoc',
      },
    },
    { $addFields: { canonicalBookmarked: { $gt: [{ $size: '$bookmarkDoc' }, 0] } } },
    { $match: { $expr: { $ne: ['$isBookmarked', '$canonicalBookmarked'] } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'bookmark_projection_drift',
      ['questionprogresses.isBookmarked', 'bookmarks'],
      questionBookmarkDrift,
      'Different screens can disagree about bookmark state.',
      'Use bookmarks as authority and remove/rebuild the embedded boolean after cutover.',
    ),
  );

  return {
    database: WEB_DB,
    collections: await collectionInventory(db, collections),
    anomalies: anomalies.sort((a, b) => a.type.localeCompare(b.type)),
  };
}

async function auditAi(db) {
  const collections = await existingCollections(db);
  const anomalies = [];

  const orphanSubjectProgress = await safeAggregate(collections, db, 'al_subject_progress', [
    {
      $lookup: {
        from: 'al_pipeline_jobs',
        localField: 'job_id',
        foreignField: 'job_id',
        as: 'jobDoc',
      },
    },
    { $match: { jobDoc: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'adaptive_progress_without_pipeline_job',
      ['al_subject_progress', 'al_pipeline_jobs'],
      orphanSubjectProgress,
      'Adaptive learning state cannot resolve its source subject/pipeline result.',
      'Reconcile the job reference; do not infer a new job from cached artifacts.',
    ),
  );

  const orphanChunks = await safeAggregate(collections, db, 'al_document_chunks', [
    {
      $lookup: {
        from: 'al_pipeline_jobs',
        localField: 'job_id',
        foreignField: 'job_id',
        as: 'jobDoc',
      },
    },
    { $match: { jobDoc: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'document_chunk_without_pipeline_job',
      ['al_document_chunks', 'al_pipeline_jobs'],
      orphanChunks,
      'Document chunks can outlive the job that owns their lifecycle and storage keys.',
      'Validate retention and remove/reassign only through an approved cleanup; Chroma must remain derived.',
    ),
  );

  const orphanAskRinMessages = await safeAggregate(collections, db, 'ask_rin_messages', [
    {
      $lookup: {
        from: 'ask_rin_conversations',
        localField: 'conversation_id',
        foreignField: 'conversation_id',
        as: 'conversationDoc',
      },
    },
    { $match: { conversationDoc: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'ask_rin_message_without_conversation',
      ['ask_rin_messages', 'ask_rin_conversations'],
      orphanAskRinMessages,
      'Conversation history can contain messages with no owning conversation.',
      'Reconcile by canonical conversation_id; never rebuild ownership from UI transcript state.',
    ),
  );

  const configStateWithoutRevision = await safeAggregate(collections, db, 'llm_config_state', [
    {
      $lookup: {
        from: 'llm_config_revisions',
        localField: 'active_revision',
        foreignField: 'revision',
        as: 'revisionDoc',
      },
    },
    { $match: { active_revision: { $ne: null }, revisionDoc: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  anomalies.push(
    anomaly(
      'llm_active_pointer_missing_revision',
      ['llm_config_state', 'llm_config_revisions'],
      configStateWithoutRevision,
      'LLM routing can point to configuration that cannot be loaded deterministically.',
      'Restore a valid revision pointer from audited revision history; do not fall back to environment provider config silently.',
    ),
  );

  return {
    database: AI_DB,
    collections: await collectionInventory(db, collections),
    anomalies: anomalies.sort((a, b) => a.type.localeCompare(b.type)),
  };
}

async function main() {
  if (!WEB_URI) throw new Error('MONGODB_URI is required for read-only audit');
  if (!AI_URI) throw new Error('AI_MONGODB_URI or MONGODB_URI is required for read-only audit');

  const webClient = new MongoClient(WEB_URI, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
    retryWrites: false,
  });
  const aiClient =
    AI_URI === WEB_URI
      ? webClient
      : new MongoClient(AI_URI, {
          serverSelectionTimeoutMS: 8_000,
          connectTimeoutMS: 8_000,
          retryWrites: false,
        });

  try {
    await webClient.connect();
    if (aiClient !== webClient) await aiClient.connect();

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      mode: 'read-only',
      databases: {
        web: WEB_DB,
        ai: AI_DB,
      },
      web: await auditWeb(webClient.db(WEB_DB)),
      ai: await auditAi(aiClient.db(AI_DB)),
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await Promise.allSettled([
      webClient.close(),
      aiClient === webClient ? Promise.resolve() : aiClient.close(),
    ]);
  }
}

main().catch((error) => {
  const safeMessage = sanitizeErrorMessage(
    error instanceof Error ? error.message : 'Unknown audit error',
  );
  process.stderr.write(`${JSON.stringify({ mode: 'read-only', error: safeMessage })}\n`);
  process.exitCode = 1;
});
