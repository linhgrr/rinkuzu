type AdaptiveRoutes = {
  readonly dashboard: '/adaptive';
  readonly upload: '/adaptive/upload';
  readonly processing: '/adaptive/processing';
  readonly subject: (sessionId: string) => string;
  readonly exercise: (sessionId: string) => string;
  readonly result: (sessionId: string) => string;
};

export const ADAPTIVE_ROUTES: AdaptiveRoutes = {
  dashboard: '/adaptive',
  upload: '/adaptive/upload',
  processing: '/adaptive/processing',
  subject: (sessionId: string) => `/adaptive/subject/${sessionId}`,
  exercise: (sessionId: string) => `/adaptive/exercise/${sessionId}`,
  result: (sessionId: string) => `/adaptive/result/${sessionId}`,
};
