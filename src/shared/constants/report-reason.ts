export const REPORT_REASONS = ['copyright', 'personal_data', 'wrong_content', 'offensive'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Reasons that hold a public quiz out of the search index while pending (RIN-1336). */
export const INDEX_HOLD_REPORT_REASONS = ['copyright', 'personal_data'] as const;

export function holdsQuizIndex(reason: ReportReason | undefined): boolean {
  return reason === 'copyright' || reason === 'personal_data';
}

export const REPORT_SOURCES = ['quiz_page'] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];
