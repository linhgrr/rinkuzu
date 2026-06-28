// Frontend Routes - Navigation paths
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  REGISTER: '/register',
  CREATE_QUIZ: '/create',
  BOOKMARKS: '/profile', // Consolidated
  HISTORY: '/profile', // Consolidated
  EXPLORE: '/explore',
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

  HISTORY_DETAIL: (attemptId: string) => `/history/${attemptId}`,

  PAYMENT: {
    SUCCESS: '/payment/success',
    CANCEL: '/payment/cancel',
  },

  // Admin routes
  ADMIN: {
    PLANS: '/admin/plans',
    QUIZZES: '/admin/quizzes',
    REPORTS: '/admin/reports',
    STATS: '/admin/stats',
    SUBSCRIPTIONS: '/admin/subscriptions',
    USERS: '/admin/users',
  },
} as const;
