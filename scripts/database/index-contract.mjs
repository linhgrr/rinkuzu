export const INDEX_CONTRACT_VERSION = '2026-08-27.1';

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
  required('attempts.premium-submission-recent', 'attempts', {
    premiumSubmission: 1,
    takenAt: -1,
  }),
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

  // billing_rate_limits is owned by rate-limiter-flexible, same contract as
  // auth_rate_limits: production disables request-path index creation.
  required(
    'billing-rate-limits.expiration',
    'billing_rate_limits',
    { expire: -1 },
    { expireAfterSeconds: 0 },
  ),
  required('billing-rate-limits.key', 'billing_rate_limits', { key: 1 }, { unique: true }),

  // billingorders
  required('billingorders.public-id', 'billingorders', { publicId: 1 }, { unique: true }),
  required('billingorders.order-code', 'billingorders', { orderCode: 1 }, { unique: true }),
  required('billingorders.user-recent', 'billingorders', { user: 1, createdAt: -1 }),
  required('billingorders.fulfillment-work', 'billingorders', {
    fulfillmentStatus: 1,
    updatedAt: 1,
  }),
  // The fulfillment drain claims the oldest due order: it filters on
  // fulfillmentStatus and ranges on fulfillmentNextAttemptAt, then sorts by the
  // same field, so the range key must follow the equality key.
  required('billingorders.fulfillment-due', 'billingorders', {
    fulfillmentStatus: 1,
    fulfillmentNextAttemptAt: 1,
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
  // The attempt drain claims by lease: it filters on collectionStatus, ranges
  // on nextReconcileAt and then requires the lease to have lapsed, so the
  // lease field has to be in the key or every claim pays a fetch to discard a
  // row another worker already holds.
  required('paymentattempts.reconciliation', 'paymentattempts', {
    collectionStatus: 1,
    nextReconcileAt: 1,
    reconcileLeaseUntil: 1,
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
  // The operator diagnostics read model: newest first, optionally narrowed to
  // one verification class.
  required('paymentwebhookinboxes.diagnostics', 'paymentwebhookinboxes', {
    verificationClass: 1,
    createdAt: -1,
  }),
  // The same read with no class chosen, which is how the panel opens. The
  // compound index cannot serve it — an unnarrowed sort on `createdAt` would
  // scan every row the endpoint has ever accepted, and that count is set by
  // whoever is posting to it rather than by how many payments were taken.
  required('paymentwebhookinboxes.recent', 'paymentwebhookinboxes', { createdAt: -1 }),
  // Retained bodies age out on their own so an unauthenticated door cannot
  // become an unbounded store of attacker-controlled text. Accounting rows
  // carry no `retainUntil`, and the partial filter leaves them alone.
  required(
    'paymentwebhookinboxes.retention',
    'paymentwebhookinboxes',
    { retainUntil: 1 },
    { expireAfterSeconds: 0, partialFilterExpression: { retainUntil: { $type: 'date' } } },
  ),
  // billingalerts
  // One row per condition, which is the deduplication: raising is a conditional
  // upsert against this key, so a scheduler running every minute announces a
  // standing backlog once per cooldown and two schedulers racing announce it
  // once between them.
  required('billingalerts.key', 'billingalerts', { key: 1 }, { unique: true }),
  // The delivery sweep reads what is still undelivered, oldest first, then
  // narrows to what is past its retry backoff. `dispatchedAt` is the selective
  // half; the unique key index above holds this collection to one row per alert
  // key, so the residual narrowing wants no index of its own.
  required('billingalerts.pending', 'billingalerts', { dispatchedAt: 1, raisedAt: 1 }),

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
  required('quizzes.slug-aliases', 'quizzes', { slugAliases: 1 }, { sparse: true }),
  required('quizzes.recent', 'quizzes', { createdAt: -1 }),
  required('quizzes.visibility-recent', 'quizzes', { visibility: 1, createdAt: -1 }),
  required('quizzes.author-recent', 'quizzes', { author: 1, createdAt: -1 }),
  required('quizzes.author-visibility-recent', 'quizzes', {
    author: 1,
    visibility: 1,
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

  // Premium quiz submissions, reviews, credits, and protected play sessions
  required('premium-submissions.author-recent', 'premiumquizsubmissions', {
    author: 1,
    createdAt: -1,
  }),
  required('premium-submissions.review-queue', 'premiumquizsubmissions', {
    status: 1,
    createdAt: 1,
  }),
  required(
    'premium-submissions.source-version',
    'premiumquizsubmissions',
    { sourceQuiz: 1, version: 1 },
    { unique: true },
  ),
  required(
    'premium-submissions.source-snapshot',
    'premiumquizsubmissions',
    { sourceQuiz: 1, snapshotHash: 1 },
    { unique: true },
  ),
  required('premium-submissions.snapshot-status', 'premiumquizsubmissions', {
    snapshotHash: 1,
    status: 1,
  }),
  required('premium-submissions.question-status', 'premiumquizsubmissions', {
    questionHashes: 1,
    status: 1,
  }),
  required('premium-submissions.document-status', 'premiumquizsubmissions', {
    documentFingerprint: 1,
    status: 1,
  }),
  required(
    'premium-submissions.active-publication',
    'premiumquizsubmissions',
    { sourceQuiz: 1, active: 1 },
    { unique: true, partialFilterExpression: { active: true } },
  ),
  required('credit-wallets.user', 'creditwallets', { user: 1 }, { unique: true }),
  required('credit-ledgers.user-recent', 'creditledgers', { user: 1, createdAt: -1 }),
  required('credit-ledgers.idempotency', 'creditledgers', { idempotencyKey: 1 }, { unique: true }),
  required('credit-ledgers.reference', 'creditledgers', {
    referenceType: 1,
    referenceId: 1,
    type: 1,
  }),
  required(
    'premium-access-grants.user-quiz',
    'premiumquizaccessgrants',
    { user: 1, quiz: 1 },
    { unique: true },
  ),
  required('premium-access-grants.quiz-recent', 'premiumquizaccessgrants', {
    quiz: 1,
    createdAt: -1,
  }),
  required('premium-play-sessions.user-quiz-recent', 'premiumplaysessions', {
    user: 1,
    quiz: 1,
    createdAt: -1,
  }),
  required(
    'premium-play-sessions.retention-expiration',
    'premiumplaysessions',
    { purgeAt: 1 },
    { expireAfterSeconds: 0 },
  ),

  // quizprogresses
  required('quizprogresses.user-quiz', 'quizprogresses', { userId: 1, quiz: 1 }, { unique: true }),
  required('quizprogresses.user-recent', 'quizprogresses', { userId: 1, updatedAt: -1 }),

  // reports
  required('reports.status-recent', 'reports', { status: 1, createdAt: -1 }),
  required('reports.recent', 'reports', { createdAt: -1 }),
  required('reports.quiz', 'reports', { quizId: 1 }),

  // Support, feedback outreach and marketing communications.
  required('supporttickets.user-recent', 'supporttickets', { userId: 1, lastMessageAt: -1 }),
  required('supporttickets.user-created', 'supporttickets', { userId: 1, createdAt: -1 }),
  required('supporttickets.queue', 'supporttickets', { status: 1, lastMessageAt: -1 }),
  required('supportmessages.thread', 'supportmessages', { ticketId: 1, createdAt: 1 }),
  required(
    'supportmessages.idempotency',
    'supportmessages',
    { ticketId: 1, clientMessageId: 1 },
    { unique: true },
  ),
  required(
    'supportattachments.storage-key',
    'supportattachments',
    { storageKey: 1 },
    { unique: true },
  ),
  required('supportattachments.expiration', 'supportattachments', { expiresAt: 1 }),
  required(
    'feedbackoutreachpreferences.user',
    'feedbackoutreachpreferences',
    { userId: 1 },
    { unique: true },
  ),
  required(
    'feedbackconversations.reply-token',
    'feedbackconversations',
    { replyTokenHash: 1 },
    { unique: true },
  ),
  // Inbound Resend replies are routed by this hash, so it is a read hot path.
  required(
    'feedbackconversations.reply-address-token',
    'feedbackconversations',
    { replyAddressTokenHash: 1 },
    { unique: true, partialFilterExpression: { replyAddressTokenHash: { $type: 'string' } } },
  ),
  required('feedbackconversations.user-recent', 'feedbackconversations', {
    userId: 1,
    createdAt: -1,
  }),
  required('feedbackconversations.user-sent', 'feedbackconversations', {
    userId: 1,
    sentAt: -1,
  }),
  required('feedbackconversations.sent', 'feedbackconversations', { sentAt: -1 }),
  required('feedbackconversations.queue', 'feedbackconversations', {
    status: 1,
    lastMessageAt: -1,
  }),
  required('feedbackconversations.expiration', 'feedbackconversations', {
    status: 1,
    expiresAt: 1,
  }),
  required('feedbackmessages.thread', 'feedbackmessages', { conversationId: 1, createdAt: 1 }),
  required(
    'feedbackmessages.idempotency',
    'feedbackmessages',
    { conversationId: 1, clientMessageId: 1 },
    { unique: true },
  ),
  required(
    'feedbackmessages.email',
    'feedbackmessages',
    { emailId: 1 },
    { unique: true, partialFilterExpression: { emailId: { $type: 'string' } } },
  ),
  required('marketingpreferences.user', 'marketingpreferences', { userId: 1 }, { unique: true }),
  required('marketingconsentevents.user-topic-recent', 'marketingconsentevents', {
    userId: 1,
    topic: 1,
    createdAt: -1,
  }),
  required(
    'marketingconsentevents.retention',
    'marketingconsentevents',
    { createdAt: 1 },
    { expireAfterSeconds: 5 * 365 * 24 * 60 * 60 },
  ),
  required(
    'marketingcontactstates.user',
    'marketingcontactstates',
    { userId: 1 },
    { unique: true },
  ),
  required('marketingcontactstates.email', 'marketingcontactstates', { email: 1 }),
  required('emailcampaigns.schedule', 'emailcampaigns', { status: 1, scheduledAt: 1 }),
  required('emailcampaigns.recent', 'emailcampaigns', { createdAt: -1 }),
  required(
    'emailcampaigns.broadcast',
    'emailcampaigns',
    { resendBroadcastId: 1 },
    { sparse: true },
  ),
  required(
    'emailcampaignaudiences.member',
    'emailcampaignaudiences',
    { campaignId: 1, userId: 1 },
    { unique: true },
  ),
  required('emailcampaignaudiences.work', 'emailcampaignaudiences', {
    campaignId: 1,
    status: 1,
    availableAt: 1,
    leaseUntil: 1,
  }),
  required(
    'emaildeliveryevents.email-type',
    'emaildeliveryevents',
    { emailId: 1, eventType: 1 },
    { unique: true, partialFilterExpression: { emailId: { $type: 'string' } } },
  ),
  required(
    'emaildeliveryevents.external-event',
    'emaildeliveryevents',
    { externalEventId: 1 },
    { unique: true },
  ),
  required(
    'emaildeliveryevents.expiration',
    'emaildeliveryevents',
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  ),
  required('emailoutboxes.dedupe', 'emailoutboxes', { dedupeKey: 1 }, { unique: true }),
  required('emailoutboxes.work', 'emailoutboxes', {
    status: 1,
    availableAt: 1,
    leaseUntil: 1,
  }),
  required(
    'emailoutboxes.external-email',
    'emailoutboxes',
    { externalEmailId: 1 },
    { sparse: true },
  ),
  required(
    'emailoutboxes.user-reminders',
    'emailoutboxes',
    { userId: 1, kind: 1, updatedAt: -1 },
    { partialFilterExpression: { userId: { $type: 'objectId' } } },
  ),
  required('webhookevents.external-event', 'webhookevents', { externalId: 1 }, { unique: true }),
  required(
    'webhookevents.expiration',
    'webhookevents',
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  ),
  required('webhookevents.work', 'webhookevents', { status: 1, leaseUntil: 1 }),
  required('adminactionaudits.actor-recent', 'adminactionaudits', {
    actorId: 1,
    createdAt: -1,
  }),
  required('adminactionaudits.entity-recent', 'adminactionaudits', {
    entityType: 1,
    entityId: 1,
    createdAt: -1,
  }),
  required(
    'adminactionaudits.expiration',
    'adminactionaudits',
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
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
  // MongoDB exposes text indexes through their internal key representation.
  // No production caller uses $text anymore, so evaluate removal by hiding it first.
  deprecated('quizzes.legacy-text-search', 'quizzes', { _fts: 'text', _ftsx: 1 }),

  // Indexes that exist in production but belong to no Mongoose schema. They are
  // recorded here so the planner stops reporting them as unclassified drift and
  // the migration can run; classifying them does not create, hide or drop
  // anything. Whether either should be retired is a separate decision that needs
  // query evidence, and moving one to `deprecated` is what starts that path.
  externallyManaged('quizzes.manual-author-folder-recent', 'quizzes', {
    author: 1,
    folder: 1,
    createdAt: -1,
  }),
  externallyManaged('users.manual-legacy-subscription-window', 'users', {
    'subscription.isActive': 1,
    'subscription.endDate': 1,
  }),
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

function externallyManaged(id, collection, key) {
  return Object.freeze({
    id,
    collection,
    key: Object.freeze(key),
    options: Object.freeze({}),
    lifecycle: 'externally_managed',
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
