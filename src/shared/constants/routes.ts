/**
 * App route paths for next-intl `Link` / `useRouter` / server `redirect({ href })`.
 * Always locale-unprefixed — next-intl (and middleware) apply the locale.
 * For full-document / NextAuth URLs, wrap with `toBrowserPath(path, locale)`.
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  REGISTER: '/register',
  CREATE_QUIZ: '/create',
  CREATE_QUIZ_PDF: '/create/pdf',
  ADAPTIVE_PIPELINE_DEBUG: '/adaptive/pipeline-debug',
  BOOKMARKS: '/profile', // Consolidated
  HISTORY: '/profile', // Consolidated
  EXPLORE: '/explore',
  QUIZZES: '/quizzes',
  SUBSCRIPTION: '/subscription',

  // Dynamic routes
  QUIZ: {
    VIEW: (slug: string) => `/quiz/${slug}`,
    FLASHCARDS: (slug: string) => `/quiz/${slug}/flashcards`,
    RESULT: (slug: string) => `/quiz/${slug}/result`,
  },

  USER: {
    PROFILE: (userId: string) => `/users/${userId}`,
  },

  EDIT: {
    QUIZ: (id: string) => `/edit/${id}`,
  },

  DRAFT: {
    EDIT: (id: string) => `/draft/${id}/edit`,
  },

  HISTORY_DETAIL: (attemptId: string) => `/history/${attemptId}`,

  PAYMENT: {
    SUCCESS: '/payment/success',
    CANCEL: '/payment/cancel',
  },

  // Admin routes
  ADMIN: {
    PLANS: '/admin/plans',
    PROMOTIONS: '/admin/promotions',
    QUIZZES: '/admin/quizzes',
    REPORTS: '/admin/reports',
    STATS: '/admin/stats',
    SUBSCRIPTIONS: '/admin/subscriptions',
    USERS: '/admin/users',
    AI_SETTINGS: '/admin/ai-settings',
  },
} as const;
