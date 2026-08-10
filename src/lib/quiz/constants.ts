import { MAX_PDF_UPLOAD_BYTES } from '@/lib/pdf-upload-policy';

// Technical safety ceiling shared by both PDF ingestion flows. Product limits
// remain page-based (30 Free / 100 Plus) and are resolved from entitlements.
// Mirrors FastAPI `quiz_extract_max_pdf_bytes` and `download_max_bytes`.
export const MAX_QUIZ_PDF_BYTES = MAX_PDF_UPLOAD_BYTES;
export const MAX_QUIZ_PDF_MB = MAX_QUIZ_PDF_BYTES / (1024 * 1024);
