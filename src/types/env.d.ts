declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SITE_URL?: string;
    NEXT_PUBLIC_API_URL?: string;
    /**
     * Set only by `npm run build:e2e`. Declared here so it is read through dot
     * access, which is what Next inlines at build time — a bundle built without
     * it carries no bypass at all.
     */
    NEXT_PUBLIC_E2E?: string;
  }
}
