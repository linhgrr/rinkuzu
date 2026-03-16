export const ADAPTIVE_ROUTES = {
    dashboard: '/adaptive-learning',
    upload: '/adaptive-learning/upload',
    processing: '/adaptive-learning/processing',
    subject: (sessionId: string) => `/adaptive-learning/subject/${sessionId}`,
    exercise: (sessionId: string) => `/adaptive-learning/exercise/${sessionId}`,
    result: (sessionId: string) => `/adaptive-learning/result/${sessionId}`,
} as const;
