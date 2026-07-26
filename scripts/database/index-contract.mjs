export const INDEX_CONTRACT_VERSION = '2026-07-26.1';

export const INDEX_LIFECYCLE_STATUSES = Object.freeze([
  'required_active',
  'candidate_active',
  'deprecated_hidden',
  'externally_managed',
  'emergency',
]);

/**
 * The Mongoose schemas remain the desired runtime contract. A focused test
 * compares every active entry below with schema.indexes() so this executable
 * migration registry cannot silently drift away from the application models.
 *
 * Index names are intentionally not contractual unless `nameIsContract` is
 * explicitly set. No production query currently uses an index-name hint.
 */
export const INDEX_CONTRACT = Object.freeze([
  // attempts
  required('attempts.user-recent', 'attempts', { user: 1, takenAt: -1 }),
  required('attempts.guest-recent', 'attempts', { guestEmail: 1, takenAt: -1 }),
  required('attempts.quiz-recent', 'attempts', { quiz: 1, takenAt: -1 }),
  required('attempts.user-quiz', 'attempts', { user: 1, quiz: 1 }),
  required('attempts.recent', 'attempts', { takenAt: -1 }),
  required(
    'attempts.user-idempotency',
    'attempts',
    { user: 1, idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: {
        user: { $type: 'objectId' },
        idempotencyKey: { $type: 'string' },
      },
    },
  ),
  required(
    'attempts.guest-idempotency',
    'attempts',
    { guestEmail: 1, idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: {
        guestEmail: { $type: 'string' },
        idempotencyKey: { $type: 'string' },
      },
    },
  ),

  // auditlogs
  required('auditlogs.user', 'auditlogs', { userId: 1 }),
  required('auditlogs.event', 'auditlogs', { event: 1 }),
  required(
    'auditlogs.retention',
    'auditlogs',
    { createdAt: 1 },
    { expireAfterSeconds: 180 * 24 * 60 * 60 },
  ),

  // auth_rate_limits is owned by rate-limiter-flexible rather than Mongoose.
  // Production disables the library's request-path index creation, so these
  // indexes must be applied and verified by the deployment migration.
  required(
    'auth-rate-limits.expiration',
    'auth_rate_limits',
    { expire: -1 },
    { expireAfterSeconds: 0 },
  ),
  required('auth-rate-limits.key', 'auth_rate_limits', { key: 1 }, { unique: true }),

  // billingorders
  required('billingorders.public-id', 'billingorders', { publicId: 1 }, { unique: true }),
  required('billingorders.order-code', 'billingorders', { orderCode: 1 }, { unique: true }),
  required('billingorders.user-recent', 'billingorders', { user: 1, createdAt: -1 }),
  required('billingorders.fulfillment-work', 'billingorders', {
    fulfillmentStatus: 1,
    updatedAt: 1,
  }),

  // paymentattempts
  required('paymentattempts.order-recent', 'paymentattempts', { order: 1, createdAt: -1 }),
  required(
    'paymentattempts.active-checkout',
    'paymentattempts',
    { order: 1, activeForCheckout: 1 },
    { unique: true, partialFilterExpression: { activeForCheckout: true } },
  ),
  required(
    'paymentattempts.external-order',
    'paymentattempts',
    { provider: 1, providerAccountId: 1, environment: 1, externalOrderId: 1 },
    {
      unique: true,
      partialFilterExpression: { externalOrderId: { $type: 'string' } },
    },
  ),
  required(
    'paymentattempts.payment-link',
    'paymentattempts',
    { provider: 1, providerAccountId: 1, environment: 1, paymentLinkId: 1 },
    {
      unique: true,
      partialFilterExpression: { paymentLinkId: { $type: 'string' } },
    },
  ),
  required('paymentattempts.reconciliation', 'paymentattempts', {
    collectionStatus: 1,
    nextReconcileAt: 1,
  }),

  // paymenttransactions
  required(
    'paymenttransactions.provider-reference',
    'paymenttransactions',
    {
      provider: 1,
      providerAccountId: 1,
      environment: 1,
      transactionType: 1,
      externalReference: 1,
    },
    { unique: true },
  ),
  required('paymenttransactions.order-event', 'paymenttransactions', {
    order: 1,
    providerEventAt: 1,
  }),

  // Billing idempotency, promotions and eligibility.
  required(
    'idempotencyrecords.request-key',
    'idempotencyrecords',
    { user: 1, endpoint: 1, apiVersion: 1, idempotencyKey: 1 },
    { unique: true },
  ),
  required('promotions.normalized-code', 'promotions', { normalizedCode: 1 }, { unique: true }),
  required('promotions.availability', 'promotions', { active: 1, startsAt: 1, endsAt: 1 }),
  required(
    'promotionredemptions.promotion-order',
    'promotionredemptions',
    { promotion: 1, order: 1 },
    { unique: true },
  ),
  required('promotionredemptions.user-status', 'promotionredemptions', {
    promotion: 1,
    user: 1,
    status: 1,
  }),
  required('promotionredemptions.release-work', 'promotionredemptions', {
    status: 1,
    nextReleaseCheckAt: 1,
  }),
  required(
    'firstpurchaseclaims.user-class',
    'firstpurchaseclaims',
    { user: 1, eligibilityClass: 1 },
    { unique: true, partialFilterExpression: { status: 'reserved' } },
  ),
  required('firstpurchaseclaims.order', 'firstpurchaseclaims', { order: 1 }, { unique: true }),
  required(
    'firstpurchaseeligibilities.user-class',
    'firstpurchaseeligibilities',
    { user: 1, eligibilityClass: 1 },
    { unique: true },
  ),
  required(
    'promotionusercounters.user',
    'promotionusercounters',
    { promotion: 1, user: 1 },
    { unique: true },
  ),

  // Durable billing inbox and entitlement ledger.
  required(
    'paymentwebhookinboxes.dedup',
    'paymentwebhookinboxes',
    { provider: 1, providerAccountId: 1, environment: 1, dedupKey: 1 },
    { unique: true },
  ),
  required('paymentwebhookinboxes.work', 'paymentwebhookinboxes', {
    status: 1,
    nextAttemptAt: 1,
    leaseUntil: 1,
  }),
  required('entitlementaccounts.user', 'entitlementaccounts', { user: 1 }, { unique: true }),
  required('entitlementaccounts.expiration', 'entitlementaccounts', { currentEndAt: 1 }),
  required(
    'entitlementgrants.source',
    'entitlementgrants',
    { sourceType: 1, sourceId: 1 },
    { unique: true },
  ),
  required(
    'entitlementgrants.sequence',
    'entitlementgrants',
    { user: 1, sequence: 1 },
    { unique: true },
  ),
  required(
    'entitlementadjustments.source',
    'entitlementadjustments',
    { sourceType: 1, sourceId: 1 },
    { unique: true },
  ),
  required(
    'entitlementadjustments.sequence',
    'entitlementadjustments',
    { user: 1, sequence: 1 },
    { unique: true },
  ),
  required(
    'externalmoneyadjustments.provider-reference',
    'externalmoneyadjustments',
    {
      provider: 1,
      providerAccountId: 1,
      environment: 1,
      type: 1,
      externalReference: 1,
    },
    { unique: true },
  ),
  required('externalmoneyadjustments.order-event', 'externalmoneyadjustments', {
    order: 1,
    occurredAt: 1,
  }),
  required('internalrequestnonces.nonce', 'internalrequestnonces', { nonce: 1 }, { unique: true }),
  required(
    'internalrequestnonces.expiration',
    'internalrequestnonces',
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  ),

  // Observe-only abuse signals and auditable admin review.
  required('abusesignals.event', 'abusesignals', { eventId: 1 }, { unique: true }),
  required('abusesignals.identity-window', 'abusesignals', {
    signalType: 1,
    keyVersion: 1,
    hash: 1,
    validUntil: 1,
  }),
  required('abusesignals.user-window', 'abusesignals', { user: 1, validUntil: 1 }),
  required('abusecases.public-id', 'abusecases', { publicId: 1 }, { unique: true }),
  required('abusecases.user-status', 'abusecases', { users: 1, status: 1 }),
  required('abusecases.queue', 'abusecases', { status: 1, score: -1, updatedAt: -1 }),
  required('abuseadminaudits.event', 'abuseadminaudits', { eventId: 1 }, { unique: true }),
  required('abuseadminaudits.case-event', 'abuseadminaudits', {
    case: 1,
    occurredAt: -1,
  }),

  // Entitlement usage is owned by the application usage service rather than a
  // Mongoose schema; deployment owns its uniqueness and retention guarantees.
  required(
    'entitlement-usage-buckets.identity',
    'entitlement_usage_buckets',
    { userId: 1, capability: 1, window: 1, bucketStart: 1 },
    { unique: true },
  ),
  required(
    'entitlement-usage-buckets.expiration',
    'entitlement_usage_buckets',
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  ),
  required(
    'entitlement-usage-requests.idempotency',
    'entitlement_usage_requests',
    { userId: 1, capability: 1, requestId: 1 },
    { unique: true },
  ),
  required(
    'entitlement-usage-requests.retention',
    'entitlement_usage_requests',
    { retentionExpiresAt: 1 },
    { expireAfterSeconds: 0 },
  ),
  required('entitlement-usage-requests.telemetry', 'entitlement_usage_requests', {
    createdAt: -1,
    capability: 1,
    tier: 1,
    status: 1,
  }),

  // bookmarks
  required(
    'bookmarks.user-quiz-question',
    'bookmarks',
    { userId: 1, 'quiz.slug': 1, questionIndex: 1 },
    { unique: true },
  ),
  required('bookmarks.user-recent', 'bookmarks', { userId: 1, createdAt: -1 }),
  required('bookmarks.user-quiz-recent', 'bookmarks', {
    userId: 1,
    'quiz.slug': 1,
    createdAt: -1,
  }),

  // discussions, folders, folderquizzes
  required(
    'discussions.quiz-question',
    'discussions',
    { quiz: 1, questionIndex: 1 },
    { unique: true },
  ),
  required('folders.owner-name', 'folders', { owner: 1, name: 1 }, { unique: true }),
  required('folderquizzes.owner-quiz', 'folderquizzes', { owner: 1, quiz: 1 }, { unique: true }),
  required('folderquizzes.owner-folder', 'folderquizzes', { owner: 1, folder: 1 }),

  // questionprogresses
  required('questionprogresses.user', 'questionprogresses', { userId: 1 }),
  required('questionprogresses.lesson', 'questionprogresses', { lessonId: 1 }),
  required('questionprogresses.question', 'questionprogresses', { questionId: 1 }),
  required('questionprogresses.next-review', 'questionprogresses', { nextReviewDate: 1 }),
  required(
    'questionprogresses.user-quiz-question',
    'questionprogresses',
    { userId: 1, quizSlug: 1, questionId: 1 },
    { unique: true },
  ),
  required('questionprogresses.user-due', 'questionprogresses', {
    userId: 1,
    nextReviewDate: 1,
  }),
  required('questionprogresses.user-srs-level', 'questionprogresses', {
    userId: 1,
    srsLevel: 1,
  }),

  // quizzes
  required('quizzes.slug', 'quizzes', { slug: 1 }, { unique: true }),
  required('quizzes.recent', 'quizzes', { createdAt: -1 }),
  required('quizzes.visibility-recent', 'quizzes', { isPrivate: 1, createdAt: -1 }),
  required('quizzes.author-recent', 'quizzes', { author: 1, createdAt: -1 }),
  required('quizzes.author-visibility-recent', 'quizzes', {
    author: 1,
    isPrivate: 1,
    createdAt: -1,
  }),
  required('quizzes.author-folder-recent', 'quizzes', {
    author: 1,
    folder: 1,
    createdAt: -1,
  }),
  required(
    'quizzes.source-draft',
    'quizzes',
    { sourceDraftId: 1 },
    {
      unique: true,
      partialFilterExpression: { sourceDraftId: { $type: 'string' } },
    },
  ),

  // quizprogresses
  required('quizprogresses.user-quiz', 'quizprogresses', { userId: 1, quiz: 1 }, { unique: true }),
  required('quizprogresses.user-recent', 'quizprogresses', { userId: 1, updatedAt: -1 }),

  // reports
  required('reports.status-recent', 'reports', { status: 1, createdAt: -1 }),
  required('reports.recent', 'reports', { createdAt: -1 }),
  required('reports.quiz', 'reports', { quizId: 1 }),

  // subscriptions
  required('subscriptions.user-recent', 'subscriptions', { user: 1, createdAt: -1 }),
  required('subscriptions.status-recent', 'subscriptions', { status: 1, createdAt: -1 }),
  required('subscriptions.recent', 'subscriptions', { createdAt: -1 }),
  required('subscriptions.expiration-scan', 'subscriptions', {
    status: 1,
    isActive: 1,
    endDate: 1,
  }),
  required('subscriptions.payos-order', 'subscriptions', { payosOrderId: 1 }, { unique: true }),
  required(
    'subscriptions.payos-transaction',
    'subscriptions',
    { payosTransactionId: 1 },
    {
      unique: true,
      partialFilterExpression: { payosTransactionId: { $type: 'string' } },
    },
  ),

  // users
  required('users.email', 'users', { email: 1 }, { unique: true }),
  required('users.role-recent', 'users', { role: 1, createdAt: -1 }),
  required('users.recent', 'users', { createdAt: -1 }),
  /** Admin user list filtered by disable status, sorted by newest first. */
  required('users.disable-recent', 'users', { disable: 1, createdAt: -1 }),
  /** Active-admin invariant count: role + disable exact match. */
  required('users.role-disable', 'users', { role: 1, disable: 1 }),
  required(
    'users.auth-identity',
    'users',
    { 'authIdentities.provider': 1, 'authIdentities.subject': 1 },
    {
      unique: true,
      partialFilterExpression: {
        'authIdentities.provider': { $type: 'string' },
        'authIdentities.subject': { $type: 'string' },
      },
    },
  ),
  required(
    'users.password-reset-token',
    'users',
    { passwordResetTokenHash: 1 },
    { partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } } },
  ),
  required(
    'users.email-verification-token',
    'users',
    { emailVerificationTokenHash: 1 },
    { partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } } },
  ),
  required('users.locked-until', 'users', { lockedUntil: 1 }, { sparse: true }),
  required(
    'users.active-subscription-expiration',
    'users',
    { 'subscription.isActive': 1, 'subscription.endDate': 1 },
    { partialFilterExpression: { 'subscription.isActive': true } },
  ),
  // userprogresses
  required('userprogresses.user', 'userprogresses', { userId: 1 }, { unique: true }),

  // Historical indexes are hidden first. Dropping remains impossible until
  // hiddenSince, dropAfter, and workloadCycleEvidence are deliberately added.
  deprecated('bookmarks.legacy-user-id', 'bookmarks', { userId: 1 }),
  deprecated('bookmarks.legacy-user-email', 'bookmarks', { userEmail: 1 }),
  deprecated('bookmarks.legacy-user-email-recent', 'bookmarks', {
    userEmail: 1,
    createdAt: -1,
  }),
  deprecated('bookmarks.legacy-user-email-quiz-question', 'bookmarks', {
    userEmail: 1,
    'quiz.slug': 1,
    questionIndex: 1,
  }),
  deprecated('quizzes.legacy-status-recent', 'quizzes', { status: 1, createdAt: -1 }),
  deprecated('quizzes.legacy-status-public-category', 'quizzes', {
    status: 1,
    isPublic: 1,
    category: 1,
  }),
  deprecated('quizzes.legacy-creator-status', 'quizzes', { createdBy: 1, status: 1 }),
  deprecated('quizzes.legacy-category-status-private-recent', 'quizzes', {
    category: 1,
    status: 1,
    isPrivate: 1,
    createdAt: -1,
  }),
  deprecated('quizzes.legacy-category-status-recent', 'quizzes', {
    category: 1,
    status: 1,
    createdAt: -1,
  }),
  deprecated('quizzes.legacy-author-status-recent', 'quizzes', {
    author: 1,
    status: 1,
    createdAt: -1,
  }),
  deprecated('quizzes.legacy-status-private-recent', 'quizzes', {
    status: 1,
    isPrivate: 1,
    createdAt: -1,
  }),
  // MongoDB exposes text indexes through their internal key representation.
  // No production caller uses $text anymore, so evaluate removal by hiding it first.
  deprecated('quizzes.legacy-text-search', 'quizzes', { _fts: 'text', _ftsx: 1 }),
]);

function required(id, collection, key, options = {}) {
  return Object.freeze({
    id,
    collection,
    key: Object.freeze(key),
    options: Object.freeze(options),
    lifecycle: 'required_active',
  });
}

function deprecated(id, collection, key) {
  return Object.freeze({
    id,
    collection,
    key: Object.freeze(key),
    options: Object.freeze({}),
    lifecycle: 'deprecated_hidden',
  });
}
