/**
 * Format date using predefined formats
 */
export const formatDisplayDate = (dateString: string, locale?: string): string => {
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
