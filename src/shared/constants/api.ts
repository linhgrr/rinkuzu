// API Constants - Endpoints, Query Params, Status Codes
export const API_ENDPOINTS = {
  QUIZ: {
    BASE: '/api/quizzes',
    BY_ID: (id: string) => `/api/quiz/${id}`,
    BY_SLUG: (slug: string) => `/api/quiz/${slug}`,
    ATTEMPT: (slug: string) => `/api/quiz/${slug}/attempt`,
    FLASHCARDS: (slug: string) => `/api/quiz/${slug}/flashcards`,
    DISCUSSIONS: (slug: string) => `/api/quiz/${slug}/discussions`,
    REPORT: (slug: string) => `/api/quiz/${slug}/report`,
    PREVIEW: '/api/quizzes/preview'
  },
  CATEGORY: {
    BASE: '/api/categories',
    BY_SLUG: (slug: string) => `/api/categories/${slug}`,
    STATS: '/api/categories/stats',
    SEARCH: '/api/categories/search'
  },
  USER: {
    ATTEMPTS: '/api/user/attempts'
  },
  BOOKMARK: {
    BASE: '/api/bookmarks',
    BY_ID: (id: string) => `/api/bookmarks/${id}`
  },
  ATTEMPT: {
    BY_ID: (id: string) => `/api/attempts/${id}`
  },
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register'
  }
} as const

export const QUERY_PARAMS = {
  STATUS: 'status',
  PAGE: 'page',
  LIMIT: 'limit',
  SEARCH: 'search',
  CATEGORY: 'category'
} as const

export const QUIZ_STATUS = {
  PUBLISHED: 'published',
  DRAFT: 'draft',
  PENDING: 'pending',
  REJECTED: 'rejected'
} as const

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const 