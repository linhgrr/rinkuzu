// Shared quiz-builder upload limits. Mirrors the FastAPI
// `quiz_extract_max_pdf_bytes` setting (default 5MB). Keep in sync.
export const MAX_QUIZ_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_QUIZ_PDF_MB = MAX_QUIZ_PDF_BYTES / (1024 * 1024);
