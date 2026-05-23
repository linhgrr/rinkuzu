export const ADAPTIVE_ROUTES = {
  dashboard: '/adaptive',
  upload: '/adaptive/upload',
  processing: '/adaptive/processing',
  subject: (sessionId: string) => `/adaptive/subject/${sessionId}`,
  exercise: (sessionId: string) => `/adaptive/exercise/${sessionId}`,
  result: (sessionId: string) => `/adaptive/result/${sessionId}`,
} as const;
