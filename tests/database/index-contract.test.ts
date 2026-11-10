import { describe, expect, it } from 'vitest';

import { INDEX_CONTRACT } from '../../scripts/database/index-contract.mjs';
import {
  canonicalizeIndexOptions,
  canonicalizeKey,
  stableStringify,
  validateIndexContract,
} from '../../scripts/database/index-planner.mjs';
import Attempt from '@/models/Attempt';
import AuditLog from '@/models/AuditLog';
import {
  BillingAlert,
  BillingCounter,
  BillingOrder,
  EntitlementAccount,
  EntitlementAdjustment,
  EntitlementGrant,
  ExternalMoneyAdjustment,
  FirstPurchaseClaim,
  FirstPurchaseEligibility,
  IdempotencyRecord,
  InternalRequestNonce,
  PaymentAttempt,
  PaymentTransaction,
  PaymentWebhookInbox,
  Promotion,
  PromotionRedemption,
  PromotionUserCounter,
} from '@/models/Billing';
import Bookmark from '@/models/Bookmark';
import Discussion from '@/models/Discussion';
import Folder from '@/models/Folder';
import { IndexNowPendingUrl, IndexNowThrottle } from '@/models/IndexNowQueue';
import FolderQuiz from '@/models/FolderQuiz';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import QuizTopic from '@/models/QuizTopic';
import QuizTopicAssignment from '@/models/QuizTopicAssignment';
import CreditLedger from '@/models/CreditLedger';
import CreditWallet from '@/models/CreditWallet';
import GuestQuizDraft from '@/models/GuestQuizDraft';
import PremiumPlaySession from '@/models/PremiumPlaySession';
import PremiumQuizAccessGrant from '@/models/PremiumQuizAccessGrant';
import PremiumQuizSubmission from '@/models/PremiumQuizSubmission';
import Report from '@/models/Report';
import StarterQuiz from '@/models/StarterQuiz';
import User from '@/models/User';
import UserProgress from '@/models/UserProgress';

const MODELS = {
  attempts: Attempt,
  auditlogs: AuditLog,
  billingalerts: BillingAlert,
  billingcounters: BillingCounter,
  billingorders: BillingOrder,
  bookmarks: Bookmark,
  discussions: Discussion,
  entitlementaccounts: EntitlementAccount,
  entitlementadjustments: EntitlementAdjustment,
  entitlementgrants: EntitlementGrant,
  externalmoneyadjustments: ExternalMoneyAdjustment,
  firstpurchaseclaims: FirstPurchaseClaim,
  firstpurchaseeligibilities: FirstPurchaseEligibility,
  folders: Folder,
  folderquizzes: FolderQuiz,
  idempotencyrecords: IdempotencyRecord,
  indexnowpendingurls: IndexNowPendingUrl,
  indexnowthrottles: IndexNowThrottle,
  internalrequestnonces: InternalRequestNonce,
  paymentattempts: PaymentAttempt,
  paymenttransactions: PaymentTransaction,
  paymentwebhookinboxes: PaymentWebhookInbox,
  promotions: Promotion,
  promotionredemptions: PromotionRedemption,
  promotionusercounters: PromotionUserCounter,
  questionprogresses: QuestionProgress,
  creditledgers: CreditLedger,
  creditwallets: CreditWallet,
  guestquizdrafts: GuestQuizDraft,
  premiumplaysessions: PremiumPlaySession,
  premiumquizaccessgrants: PremiumQuizAccessGrant,
  premiumquizsubmissions: PremiumQuizSubmission,
  quizzes: Quiz,
  quizprogresses: QuizProgress,
  quiztopics: QuizTopic,
  quiztopicassignments: QuizTopicAssignment,
  reports: Report,
  starterquizzes: StarterQuiz,
  users: User,
  userprogresses: UserProgress,
};

describe('database index contract registry', () => {
  it('is internally valid', () => {
    expect(validateIndexContract(INDEX_CONTRACT)).toEqual([]);
  });

  it('matches every Mongoose schema index in both directions', () => {
    for (const [collection, model] of Object.entries(MODELS)) {
      const schemaIndexes = model.schema
        .indexes()
        .map(([key, options]) => signature(key, options))
        .sort();
      const registryIndexes = INDEX_CONTRACT.filter(
        (entry) =>
          entry.collection === collection &&
          ['required_active', 'candidate_active', 'emergency'].includes(entry.lifecycle),
      )
        .map((entry) => signature(entry.key, entry.options))
        .sort();

      expect(registryIndexes, `${collection} registry must exactly mirror its schema`).toEqual(
        schemaIndexes,
      );
    }
  });

  it('enforces attempt idempotency only for persisted string keys', () => {
    const expectedFilters = {
      'attempts.user-idempotency': {
        user: { $type: 'objectId' },
        idempotencyKey: { $type: 'string' },
      },
      'attempts.guest-idempotency': {
        guestEmail: { $type: 'string' },
        idempotencyKey: { $type: 'string' },
      },
    };

    for (const [indexId, partialFilterExpression] of Object.entries(expectedFilters)) {
      const entry = INDEX_CONTRACT.find(({ id }) => id === indexId);
      expect(entry, `${indexId} must remain in the runtime index contract`).toBeDefined();
      expect(entry?.options).toMatchObject({ unique: true, partialFilterExpression });
    }
  });

  it('keeps auth rate-limit indexes outside the request path', () => {
    expect(INDEX_CONTRACT).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'auth-rate-limits.expiration',
          collection: 'auth_rate_limits',
          key: { expire: -1 },
          options: { expireAfterSeconds: 0 },
        }),
        expect.objectContaining({
          id: 'auth-rate-limits.key',
          collection: 'auth_rate_limits',
          key: { key: 1 },
          options: { unique: true },
        }),
      ]),
    );
  });

  it('keeps every legacy removal in hide-before-drop lifecycle', () => {
    const deprecated = INDEX_CONTRACT.filter((entry) => entry.lifecycle === 'deprecated_hidden');

    expect(deprecated).toHaveLength(10);
    expect(deprecated.every((entry) => !('hiddenSince' in entry))).toBe(true);
    expect(deprecated.every((entry) => !('dropAfter' in entry))).toBe(true);
    expect(deprecated).toContainEqual(
      expect.objectContaining({
        id: 'quizzes.legacy-text-search',
        key: { _fts: 'text', _ftsx: 1 },
      }),
    );
  });
});

function signature(key: Record<string, unknown>, options: Record<string, unknown> = {}) {
  return stableStringify({
    key: canonicalizeKey(key),
    options: { ...canonicalizeIndexOptions(options), hidden: false },
  });
}
