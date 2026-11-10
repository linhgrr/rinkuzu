import { GUEST_DRAFT_MAX_PAGES, GUEST_DRAFT_MAX_PDF_BYTES } from '@/shared/constants/guest-draft';

/**
 * The trial limits as the copy names them. The size is the server's real ceiling (4 MB:
 * Vercel's request body cap, CTO decision on RIN-1446), not the spec's 10 MB.
 */
export const GUEST_DRAFT_LIMIT_COPY = {
  pages: GUEST_DRAFT_MAX_PAGES,
  mb: GUEST_DRAFT_MAX_PDF_BYTES / (1024 * 1024),
} as const;
