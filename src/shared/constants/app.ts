// Application Constants - General app configuration
export const APP_CONFIG = {
  NAME: 'RinKuzu',
  DESCRIPTION: 'Interactive Quiz Platform',
  VERSION: '1.0.0'
} as const

export const EXTERNAL_APIS = {
  NEKOS_BEST: {
    BASE_URL: 'https://nekos.best/api/v2',
    ENDPOINTS: {
      EMOTION: (emotion: string) => `https://nekos.best/api/v2/${emotion}`
    }
  }
} as const

export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: ['application/pdf']
  },
  CHUNK_SIZE: 4, // pages per chunk
  OVERLAP_PAGES: 1,
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000,
  RETRY_DELAY_MULTIPLIER: 2,
  MAX_CONCURRENT_CHUNKS: 3
} as const

export const DATE_FORMATS = {
  DISPLAY: {
    SHORT: 'MMM d, yyyy',
    LONG: 'MMMM d, yyyy',
    WITH_TIME: 'MMM d, yyyy HH:mm'
  },
  API: {
    ISO: 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\''
  }
} as const

export const VALIDATION = {
  EMAIL: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 254,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true
  },
  QUIZ: {
    TITLE: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 200
    },
    DESCRIPTION: {
      MIN_LENGTH: 10,
      MAX_LENGTH: 1000
    },
    MIN_QUESTIONS: 1,
    MAX_QUESTIONS: 100
  }
} as const

export const MESSAGES = {
  SUCCESS: {
    QUIZ_CREATED: 'Quiz created successfully!',
    QUIZ_UPDATED: 'Quiz updated successfully!',
    QUIZ_DELETED: 'Quiz deleted successfully!',
    LOGIN: 'Welcome back!',
    REGISTER: 'Account created successfully!'
  },
  ERROR: {
    GENERIC: 'Something went wrong. Please try again.',
    NETWORK: 'Network error. Please check your connection.',
    UNAUTHORIZED: 'You need to log in to access this feature.',
    FORBIDDEN: 'You don\'t have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION: 'Please check your input and try again.'
  },
  LOADING: {
    QUIZ: 'Loading quiz...',
    CATEGORIES: 'Loading categories...',
    SAVING: 'Saving...',
    DELETING: 'Deleting...'
  }
} as const 