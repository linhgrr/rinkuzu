'use client';

import useSWR from 'swr';
import { fetchProfileEntitlements } from '@/features/profile/api/profile-entitlements-api';
import { MAX_PDF_UPLOAD_BYTES } from '@/lib/pdf-upload-policy';
import type { EntitlementConstraint } from '@/types/entitlements';

export type PdfUploadPurpose = 'quiz' | 'adaptive';

const PAGE_CONSTRAINT: Record<PdfUploadPurpose, EntitlementConstraint> = {
  quiz: 'quiz_pdf_pages',
  adaptive: 'adaptive_pdf_pages',
};

export function usePdfUploadPolicy(purpose: PdfUploadPurpose) {
  const { data, error, isLoading } = useSWR('/api/entitlements', fetchProfileEntitlements, {
    revalidateOnFocus: false,
  });

  return {
    isLoading,
    error,
    maxPages: data?.constraints[PAGE_CONSTRAINT[purpose]] ?? 30,
    maxBytes: data?.constraints.pdf_upload_bytes ?? MAX_PDF_UPLOAD_BYTES,
  };
}
