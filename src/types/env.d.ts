declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SITE_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
    NEXT_PUBLIC_PREMIUM_CONTRIBUTION_ENABLED?: 'true' | 'false';
  }
}
