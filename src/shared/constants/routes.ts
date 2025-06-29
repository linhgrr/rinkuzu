// Frontend Routes - Navigation paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  CREATE_QUIZ: '/create',
  PENDING_QUIZZES: '/pending',
  CATEGORIES: '/categories',
  BOOKMARKS: '/bookmarks',
  HISTORY: '/history',
  SUBSCRIPTION: '/subscription',
  SETUP: '/setup',
  
  // Dynamic routes
  QUIZ: {
    VIEW: (slug: string) => `/quiz/${slug}`,
    FLASHCARDS: (slug: string) => `/quiz/${slug}/flashcards`,
    RESULT: (slug: string) => `/quiz/${slug}/result`
  },
  
  CATEGORY: {
    VIEW: (slug: string) => `/category/${slug}`
  },
  
  EDIT: {
    QUIZ: (id: string) => `/edit/${id}`
  },
  
  HISTORY_DETAIL: (attemptId: string) => `/history/${attemptId}`,
  
  PAYMENT: {
    SUCCESS: '/payment/success',
    CANCEL: '/payment/cancel'
  },
  
  // Admin routes
  ADMIN: {
    CATEGORIES: '/admin/categories',
    PLANS: '/admin/plans',
    QUEUE: '/admin/queue',
    REPORTS: '/admin/reports',
    STATS: '/admin/stats',
    SUBSCRIPTIONS: '/admin/subscriptions',
    USERS: '/admin/users'
  }
} as const 