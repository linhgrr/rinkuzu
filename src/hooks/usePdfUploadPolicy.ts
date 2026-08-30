'use client';

import { useEntitlementSnapshot } from '@/hooks/useEntitlementSnapshot';
import { MAX_PDF_UPLOAD_BYTES } from '@/lib/pdf-upload-policy';
import type { EntitlementConstraint } from '@/types/entitlements';

export type PdfUploadPurpose = 'quiz' | 'adaptive';

const PAGE_CONSTRAINT: Record<PdfUploadPurpose, EntitlementConstraint> = {
  quiz: 'quiz_pdf_pages',
  adaptive: 'adaptive_pdf_pages',
};

export function usePdfUploadPolicy(purpose: PdfUploadPurpose) {
  const { data, error, isLoading } = useEntitlementSnapshot();

  return {
    isLoading,
    error,
    maxPages: data?.constraints[PAGE_CONSTRAINT[purpose]] ?? 30,
    maxBytes: data?.constraints.pdf_upload_bytes ?? MAX_PDF_UPLOAD_BYTES,
  };
}
