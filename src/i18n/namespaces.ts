// Only namespaces listed here reach the client. Server components read through
// `getRequestConfig`, which loads every file in `messages/<locale>`, so a
// namespace missing from these lists still resolves on the server and fails
// only once a client component asks for it. `i18n-namespace-coverage.test.ts`
// is what keeps the two in step.

// `/feedback/preferences` renders a client component from the communications
// feature, so the marketing tree needs that namespace too. Login, register and
// verify-email render API errors through `useApiErrorMessage` (`errors.api.*`).
export const MARKETING_MESSAGE_NAMESPACES = [
  'auth',
  'common',
  'communications',
  'errors',
  'guestDraft',
  'landing',
  'nav',
  'pwa',
] as const;

export const APP_MESSAGE_NAMESPACES = [
  'adaptiveLearning',
  'admin',
  'adminPromotions',
  'attemptDetail',
  'auth',
  'common',
  'communications',
  'checkout',
  'create',
  'dashboard',
  'discussion',
  'draft',
  'errors',
  'explore',
  'flashcard',
  'guestDraft',
  'landing',
  'nav',
  'premium',
  'pricing',
  'profile',
  'pwa',
  'quiz',
  'quizPreview',
  'quizzes',
  'report',
  'review',
  'statsModal',
  'subscription',
  'upload',
] as const;
